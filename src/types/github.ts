export interface RepoOwner {
  login: string
  avatarUrl: string
  htmlUrl: string
}

export interface RepoSummary {
  id: number
  name: string
  fullName: string
  owner: RepoOwner
  description: string | null
  stars: number
  language: string | null
  htmlUrl: string
  updatedAt: string
}

export interface RepoDetail extends RepoSummary {
  forks: number
  openIssues: number
  watchers: number
  topics: string[]
  homepage: string | null
  license: string | null
  defaultBranch: string
  createdAt: string
  pushedAt: string
}

export interface SearchResult {
  total: number
  incomplete: boolean
  items: RepoSummary[]
}
