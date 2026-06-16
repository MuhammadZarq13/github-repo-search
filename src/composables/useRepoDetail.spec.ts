import { effectScope, nextTick, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { useRepoDetail } from './useRepoDetail'
import type { GithubClient } from '@/services/github'
import type { RepoDetail } from '@/types/github'
import { GithubError } from '@/services/errors'

const detail: RepoDetail = {
  id: 1,
  name: 'core',
  fullName: 'vuejs/core',
  owner: { login: 'vuejs', avatarUrl: 'a', htmlUrl: 'h' },
  description: 'The heart of Vue',
  stars: 12300,
  language: 'TypeScript',
  htmlUrl: 'https://github.com/vuejs/core',
  updatedAt: '2024-01-01T00:00:00Z',
  forks: 5,
  openIssues: 3,
  watchers: 12300,
  topics: ['vue', 'framework'],
  homepage: 'https://vuejs.org',
  license: 'MIT License',
  defaultBranch: 'main',
  createdAt: '2020-01-01T00:00:00Z',
  pushedAt: '2024-06-01T00:00:00Z',
}

function makeClient(getRepository: GithubClient['getRepository']): GithubClient {
  return { searchRepositories: vi.fn(), getRepository }
}

describe('useRepoDetail', () => {
  it('loads the repository immediately and maps success', async () => {
    const get = vi.fn(async () => detail)
    const scope = effectScope()
    const api = scope.run(() => useRepoDetail('vuejs', 'core', makeClient(get)))
    if (!api) throw new Error('composable did not initialize')

    expect(api.state.value.status).toBe('loading')
    await flushPromises()

    expect(api.state.value).toMatchObject({ status: 'success', data: { fullName: 'vuejs/core' } })
    expect(get).toHaveBeenCalledWith('vuejs', 'core', expect.anything())
    scope.stop()
  })

  it('maps a 404 to a not-found error', async () => {
    const get = vi.fn(async () => {
      throw new GithubError('notFound', 'not found', { status: 404 })
    })
    const scope = effectScope()
    const api = scope.run(() => useRepoDetail('vuejs', 'ghost', makeClient(get)))
    if (!api) throw new Error('composable did not initialize')

    await flushPromises()
    expect(api.state.value).toMatchObject({ status: 'error', kind: 'notFound' })
    scope.stop()
  })

  it('refetches when the parameters change', async () => {
    const repo = ref('core')
    const get = vi.fn(async () => detail)
    const scope = effectScope()
    scope.run(() => useRepoDetail('vuejs', repo, makeClient(get)))

    await flushPromises()
    expect(get).toHaveBeenCalledTimes(1)

    repo.value = 'vitepress'
    await nextTick()
    await flushPromises()
    expect(get).toHaveBeenCalledTimes(2)
    expect(get).toHaveBeenLastCalledWith('vuejs', 'vitepress', expect.anything())
    scope.stop()
  })

  it('aborts the in-flight request on dispose', async () => {
    let captured: AbortSignal | undefined
    const get = vi.fn(async (_owner: string, _repo: string, options?: { signal?: AbortSignal }) => {
      captured = options?.signal
      return new Promise<RepoDetail>(() => {})
    })
    const scope = effectScope()
    scope.run(() => useRepoDetail('vuejs', 'core', makeClient(get)))

    await flushPromises()
    expect(captured?.aborted).toBe(false)

    scope.stop()
    expect(captured?.aborted).toBe(true)
  })
})
