import type { GithubErrorKind } from '@/services/errors'

export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'success'; data: T }
  | { status: 'rateLimited'; retryAt: Date; message: string }
  | { status: 'error'; message: string; kind: GithubErrorKind }
