import { inject, onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import type { AsyncState } from '@/types/async-state'
import type { RepoDetail } from '@/types/github'
import type { GithubClient } from '@/services/github'
import { github } from '@/services/github'
import { isAbortError } from '@/services/errors'
import { toErrorState } from '@/utils/asyncState'
import { githubClientKey } from './useRepoSearch'

export function useRepoDetail(
  owner: MaybeRefOrGetter<string>,
  repo: MaybeRefOrGetter<string>,
  client: GithubClient = inject(githubClientKey, github),
) {
  const state = ref<AsyncState<RepoDetail>>({ status: 'loading' })
  let controller: AbortController | null = null

  async function run(): Promise<void> {
    controller?.abort()
    const current = new AbortController()
    controller = current
    state.value = { status: 'loading' }

    try {
      const data = await client.getRepository(toValue(owner), toValue(repo), {
        signal: current.signal,
      })
      if (current.signal.aborted) return
      state.value = { status: 'success', data }
    } catch (error) {
      if (isAbortError(error) || current.signal.aborted) return
      state.value = toErrorState<RepoDetail>(error)
    }
  }

  watch(() => [toValue(owner), toValue(repo)], () => void run(), { immediate: true })

  onScopeDispose(() => controller?.abort())

  function retry(): void {
    void run()
  }

  return { state, retry }
}
