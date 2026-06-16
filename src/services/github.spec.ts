import { describe, expect, it, vi } from 'vitest'
import { createGithubClient, MAX_SEARCH_RESULTS } from './github'
import { GithubError, isAbortError } from './errors'

const rawRepo = {
  id: 1,
  name: 'core',
  full_name: 'vuejs/core',
  owner: { login: 'vuejs', avatar_url: 'https://avatars/vuejs.png', html_url: 'https://github.com/vuejs' },
  description: 'The heart of Vue',
  stargazers_count: 100,
  language: 'TypeScript',
  html_url: 'https://github.com/vuejs/core',
  updated_at: '2024-01-01T00:00:00Z',
}

const rawDetail = {
  ...rawRepo,
  forks_count: 5,
  open_issues_count: 3,
  watchers_count: 100,
  topics: ['vue', 'framework'],
  homepage: 'https://vuejs.org',
  license: { name: 'MIT License' },
  default_branch: 'main',
  created_at: '2020-01-01T00:00:00Z',
  pushed_at: '2024-06-01T00:00:00Z',
}

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function mockFetch(impl: () => Promise<Response>) {
  return vi.fn(impl) as unknown as typeof fetch & ReturnType<typeof vi.fn>
}

function firstCall(fetchMock: ReturnType<typeof vi.fn>): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls.at(0)
  if (!call) throw new Error('fetch was not called')
  return { url: String(call[0]), init: (call[1] ?? {}) as RequestInit }
}

describe('createGithubClient', () => {
  describe('searchRepositories', () => {
    it('maps results and builds the query string', async () => {
      const fetchMock = mockFetch(async () => ok({ total_count: 2, incomplete_results: false, items: [rawRepo] }))
      const client = createGithubClient({ fetch: fetchMock })

      const result = await client.searchRepositories({ query: 'vue', page: 2, perPage: 10 })

      const { url } = firstCall(fetchMock)
      expect(url).toContain('/search/repositories?')
      expect(url).toContain('q=vue')
      expect(url).toContain('page=2')
      expect(url).toContain('per_page=10')
      expect(result.total).toBe(2)
      expect(result.items[0]).toMatchObject({
        fullName: 'vuejs/core',
        stars: 100,
        owner: { login: 'vuejs', avatarUrl: 'https://avatars/vuejs.png' },
      })
    })

    it('returns an empty list when nothing matches', async () => {
      const fetchMock = mockFetch(async () => ok({ total_count: 0, incomplete_results: false, items: [] }))
      const client = createGithubClient({ fetch: fetchMock })

      const result = await client.searchRepositories({ query: 'zzzznope' })

      expect(result.total).toBe(0)
      expect(result.items).toEqual([])
    })

    it('clamps per_page to the API maximum', async () => {
      const fetchMock = mockFetch(async () => ok({ total_count: 0, incomplete_results: false, items: [] }))
      const client = createGithubClient({ fetch: fetchMock })

      await client.searchRepositories({ query: 'vue', perPage: 500 })

      expect(firstCall(fetchMock).url).toContain('per_page=100')
    })

    it('sends an Authorization header only when a token is provided', async () => {
      const withToken = mockFetch(async () => ok({ total_count: 0, incomplete_results: false, items: [] }))
      await createGithubClient({ token: 'secret', fetch: withToken }).searchRepositories({ query: 'vue' })
      const authed = (firstCall(withToken).init.headers ?? {}) as Record<string, string>
      expect(authed.Authorization).toBe('Bearer secret')

      const withoutToken = mockFetch(async () => ok({ total_count: 0, incomplete_results: false, items: [] }))
      await createGithubClient({ token: '', fetch: withoutToken }).searchRepositories({ query: 'vue' })
      const anon = (firstCall(withoutToken).init.headers ?? {}) as Record<string, string>
      expect(anon.Authorization).toBeUndefined()
    })

    it('maps an exhausted rate limit to a rateLimit error with a retry time', async () => {
      const reset = Math.floor(Date.now() / 1000) + 60
      const fetchMock = mockFetch(
        async () =>
          new Response('{"message":"rate limited"}', {
            status: 403,
            headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) },
          }),
      )
      const client = createGithubClient({ fetch: fetchMock })

      await expect(client.searchRepositories({ query: 'vue' })).rejects.toMatchObject({ kind: 'rateLimit' })

      const error = await client.searchRepositories({ query: 'vue' }).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(GithubError)
      if (error instanceof GithubError) {
        expect(error.retryAt?.getTime()).toBe(reset * 1000)
      }
    })

    it('maps a secondary rate limit (429 with Retry-After) to a rateLimit error', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
      const fetchMock = mockFetch(
        async () => new Response('{}', { status: 429, headers: { 'retry-after': '30', 'x-ratelimit-remaining': '57' } }),
      )
      const client = createGithubClient({ fetch: fetchMock })

      const error = await client.searchRepositories({ query: 'vue' }).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(GithubError)
      if (error instanceof GithubError) {
        expect(error.kind).toBe('rateLimit')
        expect(error.retryAt?.getTime()).toBe(new Date('2024-01-01T00:00:30Z').getTime())
      }
      vi.useRealTimers()
    })

    it('maps a non-rate-limit 403 to an access error rather than a silent unknown failure', async () => {
      const fetchMock = mockFetch(async () => new Response('{}', { status: 403, headers: { 'x-ratelimit-remaining': '57' } }))
      const client = createGithubClient({ fetch: fetchMock })

      const error = await client.searchRepositories({ query: 'vue' }).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(GithubError)
      if (error instanceof GithubError) {
        expect(error.kind).toBe('unknown')
        expect(error.message).toMatch(/denied/i)
      }
    })

    it('maps a 422 to a validation error', async () => {
      const fetchMock = mockFetch(async () => new Response('{}', { status: 422 }))
      const client = createGithubClient({ fetch: fetchMock })

      await expect(client.searchRepositories({ query: 'a' })).rejects.toMatchObject({ kind: 'validation' })
    })

    it('maps a fetch rejection to a network error', async () => {
      const fetchMock = mockFetch(async () => {
        throw new TypeError('Failed to fetch')
      })
      const client = createGithubClient({ fetch: fetchMock })

      await expect(client.searchRepositories({ query: 'vue' })).rejects.toMatchObject({ kind: 'network' })
    })

    it('re-throws abort errors instead of wrapping them', async () => {
      const abort = new DOMException('Aborted', 'AbortError')
      const fetchMock = mockFetch(async () => {
        throw abort
      })
      const client = createGithubClient({ fetch: fetchMock })

      await expect(client.searchRepositories({ query: 'vue' })).rejects.toBe(abort)
      expect(isAbortError(abort)).toBe(true)
    })
  })

  describe('getRepository', () => {
    it('maps repository detail fields', async () => {
      const fetchMock = mockFetch(async () => ok(rawDetail))
      const client = createGithubClient({ fetch: fetchMock })

      const detail = await client.getRepository('vuejs', 'core')

      expect(detail).toMatchObject({
        fullName: 'vuejs/core',
        forks: 5,
        openIssues: 3,
        topics: ['vue', 'framework'],
        license: 'MIT License',
        defaultBranch: 'main',
      })
    })

    it('defaults missing topics to an empty array', async () => {
      const { topics: _topics, ...withoutTopics } = rawDetail
      const fetchMock = mockFetch(async () => ok(withoutTopics))
      const client = createGithubClient({ fetch: fetchMock })

      const detail = await client.getRepository('vuejs', 'core')

      expect(detail.topics).toEqual([])
    })

    it('maps a 404 to a notFound error', async () => {
      const fetchMock = mockFetch(async () => new Response('{}', { status: 404 }))
      const client = createGithubClient({ fetch: fetchMock })

      await expect(client.getRepository('owner', 'missing')).rejects.toMatchObject({ kind: 'notFound' })
    })
  })

  it('exposes the search result cap', () => {
    expect(MAX_SEARCH_RESULTS).toBe(1000)
  })
})
