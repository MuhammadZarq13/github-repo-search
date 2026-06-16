export type GithubErrorKind =
  | 'network'
  | 'rateLimit'
  | 'notFound'
  | 'validation'
  | 'unknown'

interface GithubErrorOptions {
  status?: number
  retryAt?: Date
}

export class GithubError extends Error {
  readonly kind: GithubErrorKind
  readonly status?: number
  readonly retryAt?: Date

  constructor(kind: GithubErrorKind, message: string, options: GithubErrorOptions = {}) {
    super(message)
    this.name = 'GithubError'
    this.kind = kind
    this.status = options.status
    this.retryAt = options.retryAt
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
