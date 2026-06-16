import { computed, inject, onScopeDispose, ref, watch, type InjectionKey } from 'vue'
import type { AsyncState } from '@/types/async-state'
import type { SearchResult } from '@/types/github'
import type { GithubClient } from '@/services/github'
import { MAX_SEARCH_RESULTS, github } from '@/services/github'
import { isAbortError } from '@/services/errors'
import { toErrorState } from '@/utils/asyncState'

export const githubClientKey: InjectionKey<GithubClient> = Symbol('github-client')

const PER_PAGE = 30
const DEBOUNCE_MS = 350
const MAX_PAGE = Math.floor(MAX_SEARCH_RESULTS / PER_PAGE)
const REACHABLE_RESULTS = MAX_PAGE * PER_PAGE

export function useRepoSearch(client: GithubClient = inject(githubClientKey, github)) {
  const query = ref('')
  const page = ref(1)
  const state = ref<AsyncState<SearchResult>>({ status: 'idle' })

  let controller: AbortController | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let skipNextWatch = false

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
      state.value = toErrorState<SearchResult>(error)
    }
  }

  watch(query, (value) => {
    if (skipNextWatch) {
      skipNextWatch = false
      return
    }
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

  function restore(term: string, targetPage = 1): void {
    clearTimeout(debounceTimer)
    page.value = Math.min(Math.max(Math.trunc(targetPage), 1), MAX_PAGE)
    if (query.value !== term) {
      skipNextWatch = true
      query.value = term
    }
    void run()
  }

  onScopeDispose(() => {
    clearTimeout(debounceTimer)
    controller?.abort()
  })

  return { query, page, state, maxPage, capped, perPage: PER_PAGE, goToPage, retry, restore }
}
