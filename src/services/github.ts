import type { RepoDetail, RepoOwner, RepoSummary, SearchResult } from '@/types/github'
import { GithubError, isAbortError } from './errors'

const DEFAULT_BASE_URL = 'https://api.github.com'
const MAX_PER_PAGE = 100

export const MAX_SEARCH_RESULTS = 1000

interface RawOwner {
  login: string
  avatar_url: string
  html_url: string
}

interface RawRepo {
  id: number
  name: string
  full_name: string
  owner: RawOwner
  description: string | null
  stargazers_count: number
  language: string | null
  html_url: string
  updated_at: string
}

interface RawRepoDetail extends RawRepo {
  forks_count: number
  open_issues_count: number
  watchers_count: number
  topics?: string[]
  homepage: string | null
  license: { name: string } | null
  default_branch: string
  created_at: string
  pushed_at: string
}

interface RawSearchResponse {
  total_count: number
  incomplete_results: boolean
  items: RawRepo[]
}

export interface SearchParams {
  query: string
  page?: number
  perPage?: number
  signal?: AbortSignal
}

export interface RequestOptions {
  signal?: AbortSignal
}

export interface GithubClient {
  searchRepositories(params: SearchParams): Promise<SearchResult>
  getRepository(owner: string, repo: string, options?: RequestOptions): Promise<RepoDetail>
}

export interface GithubClientOptions {
  token?: string
  baseUrl?: string
  fetch?: typeof fetch
}

function mapOwner(raw: RawOwner): RepoOwner {
  return { login: raw.login, avatarUrl: raw.avatar_url, htmlUrl: raw.html_url }
}

function mapSummary(raw: RawRepo): RepoSummary {
  return {
    id: raw.id,
    name: raw.name,
    fullName: raw.full_name,
    owner: mapOwner(raw.owner),
    description: raw.description,
    stars: raw.stargazers_count,
    language: raw.language,
    htmlUrl: raw.html_url,
    updatedAt: raw.updated_at,
  }
}

function mapDetail(raw: RawRepoDetail): RepoDetail {
  return {
    ...mapSummary(raw),
    forks: raw.forks_count,
    openIssues: raw.open_issues_count,
    watchers: raw.watchers_count,
    topics: raw.topics ?? [],
    homepage: raw.homepage && raw.homepage.length > 0 ? raw.homepage : null,
    license: raw.license?.name ?? null,
    defaultBranch: raw.default_branch,
    createdAt: raw.created_at,
    pushedAt: raw.pushed_at,
  }
}

function rateLimitRetryAt(response: Response): Date {
  const retryAfter = response.headers.get('retry-after')
  if (retryAfter !== null) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds)) return new Date(Date.now() + seconds * 1000)
  }
  const reset = response.headers.get('x-ratelimit-reset')
  if (reset !== null) {
    const epoch = Number(reset)
    if (Number.isFinite(epoch)) return new Date(epoch * 1000)
  }
  return new Date(Date.now() + 60_000)
}

function errorFromResponse(response: Response): GithubError {
  const { status } = response
  const remaining = response.headers.get('x-ratelimit-remaining')
  const retryAfter = response.headers.get('retry-after')

  const primaryLimit = (status === 403 || status === 429) && remaining === '0'
  const secondaryLimit = status === 429 || (status === 403 && retryAfter !== null)
  if (primaryLimit || secondaryLimit) {
    return new GithubError('rateLimit', 'GitHub API rate limit reached.', {
      status,
      retryAt: rateLimitRetryAt(response),
    })
  }
  if (status === 404) {
    return new GithubError('notFound', 'Repository not found.', { status })
  }
  if (status === 422) {
    return new GithubError('validation', 'GitHub could not process this search.', { status })
  }
  if (status === 403) {
    return new GithubError('unknown', 'Access to GitHub was denied. Your token may be invalid.', { status })
  }
  return new GithubError('unknown', `GitHub request failed (${status}).`, { status })
}

export function createGithubClient(options: GithubClientOptions = {}): GithubClient {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL
  const token = options.token ?? import.meta.env.VITE_GITHUB_TOKEN
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis)

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
    let response: Response
    try {
      response = await doFetch(`${baseUrl}${path}`, { headers, signal })
    } catch (error) {
      if (isAbortError(error)) throw error
      throw new GithubError('network', 'Could not reach GitHub. Check your connection.')
    }
    if (!response.ok) throw errorFromResponse(response)
    return (await response.json()) as T
  }

  return {
    async searchRepositories({ query, page = 1, perPage = 30, signal }) {
      const params = new URLSearchParams({
        q: query,
        page: String(page),
        per_page: String(Math.min(Math.max(perPage, 1), MAX_PER_PAGE)),
      })
      const raw = await request<RawSearchResponse>(`/search/repositories?${params.toString()}`, signal)
      return {
        total: raw.total_count,
        incomplete: raw.incomplete_results,
        items: raw.items.map(mapSummary),
      }
    },

    async getRepository(owner, repo, requestOptions = {}) {
      const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
      const raw = await request<RawRepoDetail>(path, requestOptions.signal)
      return mapDetail(raw)
    },
  }
}

export const github = createGithubClient()
