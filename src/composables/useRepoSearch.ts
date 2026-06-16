import { computed, onScopeDispose, ref, watch } from 'vue'
import type { AsyncState } from '@/types/async-state'
import type { SearchResult } from '@/types/github'
import type { GithubClient } from '@/services/github'
import { MAX_SEARCH_RESULTS, github } from '@/services/github'
import { GithubError, isAbortError } from '@/services/errors'

const PER_PAGE = 30
const DEBOUNCE_MS = 350
const MAX_PAGE = Math.floor(MAX_SEARCH_RESULTS / PER_PAGE)
const REACHABLE_RESULTS = MAX_PAGE * PER_PAGE

function toErrorState(error: unknown): AsyncState<SearchResult> {
  if (error instanceof GithubError) {
    if (error.kind === 'rateLimit' && error.retryAt) {
      return { status: 'rateLimited', retryAt: error.retryAt, message: error.message }
    }
    return { status: 'error', message: error.message, kind: error.kind }
  }
  return { status: 'error', message: 'Something went wrong.', kind: 'unknown' }
}

export function useRepoSearch(client: GithubClient = github) {
  const query = ref('')
  const page = ref(1)
  const state = ref<AsyncState<SearchResult>>({ status: 'idle' })

  let controller: AbortController | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  const maxPage = computed(() => {
    if (state.value.status !== 'success') return 1
    const totalPages = Math.ceil(state.value.data.total / PER_PAGE)
    return Math.max(1, Math.min(totalPages, MAX_PAGE))
  })

  const capped = computed(
    () => state.value.status === 'success' && state.value.data.total > REACHABLE_RESULTS,
  )

  async function run(): Promise<void> {
    const term = query.value.trim()
    controller?.abort()

    if (!term) {
      controller = null
      state.value = { status: 'idle' }
      return
    }

    const current = new AbortController()
    controller = current
    state.value = { status: 'loading' }

    try {
      const result = await client.searchRepositories({
        query: term,
        page: page.value,
        perPage: PER_PAGE,
        signal: current.signal,
      })
      if (current.signal.aborted) return
      state.value = result.total === 0 ? { status: 'empty' } : { status: 'success', data: result }
    } catch (error) {
      if (isAbortError(error) || current.signal.aborted) return
      state.value = toErrorState(error)
    }
  }

  watch(query, (value) => {
    clearTimeout(debounceTimer)
    if (!value.trim()) {
      controller?.abort()
      controller = null
      state.value = { status: 'idle' }
      return
    }
    state.value = { status: 'loading' }
    debounceTimer = setTimeout(() => {
      page.value = 1
      void run()
    }, DEBOUNCE_MS)
  })

  function goToPage(next: number): void {
    if (state.value.status !== 'success') return
    const target = Math.min(Math.max(Math.trunc(next), 1), maxPage.value)
    if (target === page.value) return
    page.value = target
    void run()
  }

  function retry(): void {
    if (state.value.status !== 'error' && state.value.status !== 'rateLimited') return
    void run()
  }

  onScopeDispose(() => {
    clearTimeout(debounceTimer)
    controller?.abort()
  })

  return { query, page, state, maxPage, capped, perPage: PER_PAGE, goToPage, retry }
}
