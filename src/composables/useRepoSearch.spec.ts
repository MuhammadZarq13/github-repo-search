import { effectScope, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useRepoSearch } from './useRepoSearch'
import type { GithubClient, SearchParams } from '@/services/github'
import type { RepoSummary, SearchResult } from '@/types/github'
import { GithubError } from '@/services/errors'

const summary: RepoSummary = {
  id: 1,
  name: 'core',
  fullName: 'vuejs/core',
  owner: { login: 'vuejs', avatarUrl: 'a', htmlUrl: 'h' },
  description: null,
  stars: 1,
  language: null,
  htmlUrl: 'h',
  updatedAt: '2024-01-01T00:00:00Z',
}

function result(total: number, items: RepoSummary[] = []): SearchResult {
  return { total, incomplete: false, items }
}

function makeClient(search: GithubClient['searchRepositories']): GithubClient {
  return { searchRepositories: search, getRepository: vi.fn() }
}

function mount(client: GithubClient) {
  const scope = effectScope()
  const api = scope.run(() => useRepoSearch(client))
  if (!api) throw new Error('composable did not initialize')
  return { ...api, dispose: () => scope.stop() }
}

async function settle(ms = 350) {
  await nextTick()
  await vi.advanceTimersByTimeAsync(ms)
}

afterEach(() => {
  vi.useRealTimers()
})

describe('useRepoSearch', () => {
  it('debounces input before searching', async () => {
    vi.useFakeTimers()
    const search = vi.fn(async () => result(1, [summary]))
    const s = mount(makeClient(search))

    s.query.value = 'vue'
    await nextTick()
    expect(search).not.toHaveBeenCalled()
    expect(s.state.value.status).toBe('loading')

    await vi.advanceTimersByTimeAsync(350)
    expect(search).toHaveBeenCalledTimes(1)
    expect(s.state.value).toMatchObject({ status: 'success', data: { total: 1 } })
  })

  it('coalesces rapid typing into a single request for the last term', async () => {
    vi.useFakeTimers()
    const search = vi.fn(async (_params: SearchParams) => result(0))
    const s = mount(makeClient(search))

    s.query.value = 'v'
    await nextTick()
    s.query.value = 'vu'
    await nextTick()
    s.query.value = 'vue'
    await settle()

    expect(search).toHaveBeenCalledTimes(1)
    expect(search.mock.calls[0]?.[0].query).toBe('vue')
  })

  it('maps zero results to the empty state', async () => {
    vi.useFakeTimers()
    const s = mount(makeClient(vi.fn(async () => result(0))))

    s.query.value = 'zzzz'
    await settle()

    expect(s.state.value.status).toBe('empty')
  })

  it('returns to idle when the query is cleared', async () => {
    vi.useFakeTimers()
    const s = mount(makeClient(vi.fn(async () => result(1, [summary]))))

    s.query.value = 'vue'
    await settle()
    expect(s.state.value.status).toBe('success')

    s.query.value = ''
    await nextTick()
    expect(s.state.value.status).toBe('idle')
  })

  it('aborts a superseded in-flight request and keeps the newest result', async () => {
    vi.useFakeTimers()
    const signals: (AbortSignal | undefined)[] = []
    const search = vi.fn(async ({ signal }: SearchParams) => {
      signals.push(signal)
      if (signals.length === 1) return new Promise<SearchResult>(() => {})
      return result(1, [summary])
    })
    const s = mount(makeClient(search))

    s.query.value = 'a'
    await settle()
    s.query.value = 'b'
    await settle()

    expect(signals[0]?.aborted).toBe(true)
    expect(s.state.value).toMatchObject({ status: 'success' })
  })

  it('maps a rate-limit error to the rateLimited state with a retry time', async () => {
    vi.useFakeTimers()
    const retryAt = new Date('2024-01-01T00:01:00Z')
    const search = vi.fn(async () => {
      throw new GithubError('rateLimit', 'slow down', { retryAt })
    })
    const s = mount(makeClient(search))

    s.query.value = 'vue'
    await settle()

    expect(s.state.value).toMatchObject({ status: 'rateLimited', retryAt })
  })

  it('maps other failures to the error state with the error kind', async () => {
    vi.useFakeTimers()
    const search = vi.fn(async () => {
      throw new GithubError('network', 'offline')
    })
    const s = mount(makeClient(search))

    s.query.value = 'vue'
    await settle()

    expect(s.state.value).toMatchObject({ status: 'error', kind: 'network' })
  })

  it('clamps pagination to the 1000-result cap', async () => {
    vi.useFakeTimers()
    const search = vi.fn(async (_params: SearchParams) => result(5000, [summary]))
    const s = mount(makeClient(search))

    s.query.value = 'vue'
    await settle()
    expect(s.maxPage.value).toBe(33)
    expect(s.capped.value).toBe(true)

    s.goToPage(999)
    await vi.advanceTimersByTimeAsync(0)
    expect(s.page.value).toBe(33)
    expect(search.mock.calls.at(-1)?.[0].page).toBe(33)
  })

  it('ignores pagination while a search is in flight', async () => {
    vi.useFakeTimers()
    const search = vi.fn(async (_params: SearchParams) => result(5000, [summary]))
    const s = mount(makeClient(search))

    s.query.value = 'vue'
    await nextTick()
    expect(s.state.value.status).toBe('loading')

    s.goToPage(2)
    expect(s.page.value).toBe(1)

    await settle()
    expect(s.state.value.status).toBe('success')
    expect(search.mock.calls.at(-1)?.[0].page).toBe(1)
  })

  it('resets to the first page when the query changes', async () => {
    vi.useFakeTimers()
    const search = vi.fn(async (_params: SearchParams) => result(5000, [summary]))
    const s = mount(makeClient(search))

    s.query.value = 'vue'
    await settle()
    s.goToPage(5)
    await vi.advanceTimersByTimeAsync(0)
    expect(s.page.value).toBe(5)

    s.query.value = 'react'
    await settle()
    expect(s.page.value).toBe(1)
    expect(search.mock.calls.at(-1)?.[0].page).toBe(1)
  })

  it('retries after an error and can recover', async () => {
    vi.useFakeTimers()
    const search = vi.fn(async (_params: SearchParams) => result(1, [summary]))
    search.mockRejectedValueOnce(new GithubError('network', 'offline'))
    const s = mount(makeClient(search))

    s.query.value = 'vue'
    await settle()
    expect(s.state.value).toMatchObject({ status: 'error', kind: 'network' })

    s.retry()
    await vi.advanceTimersByTimeAsync(0)
    expect(s.state.value.status).toBe('success')
  })

  it('does not retry from a non-error state', async () => {
    vi.useFakeTimers()
    const search = vi.fn(async (_params: SearchParams) => result(1, [summary]))
    const s = mount(makeClient(search))

    s.retry()
    await vi.advanceTimersByTimeAsync(0)
    expect(search).not.toHaveBeenCalled()
  })

  it('restores a query and page immediately without debouncing', async () => {
    vi.useFakeTimers()
    const search = vi.fn(async (_params: SearchParams) => result(5000, [summary]))
    const s = mount(makeClient(search))

    s.restore('vue', 3)
    await vi.advanceTimersByTimeAsync(0)

    expect(search).toHaveBeenCalledTimes(1)
    expect(search.mock.calls[0]?.[0]).toMatchObject({ query: 'vue', page: 3 })
    expect(s.page.value).toBe(3)
  })

  it('clamps a restored page to the reachable cap', async () => {
    vi.useFakeTimers()
    const search = vi.fn(async (_params: SearchParams) => result(5000, [summary]))
    const s = mount(makeClient(search))

    s.restore('vue', 999)
    await vi.advanceTimersByTimeAsync(0)

    expect(s.page.value).toBe(33)
    expect(search.mock.calls.at(-1)?.[0].page).toBe(33)
  })

  it('aborts any in-flight request when the scope is disposed', async () => {
    vi.useFakeTimers()
    let captured: AbortSignal | undefined
    const search = vi.fn(async ({ signal }: SearchParams) => {
      captured = signal
      return new Promise<SearchResult>(() => {})
    })
    const s = mount(makeClient(search))

    s.query.value = 'vue'
    await settle()
    expect(captured?.aborted).toBe(false)

    s.dispose()
    expect(captured?.aborted).toBe(true)
  })
})
