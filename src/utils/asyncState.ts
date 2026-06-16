import type { AsyncState } from '@/types/async-state'
import { GithubError } from '@/services/errors'

export function toErrorState<T>(error: unknown): AsyncState<T> {
  if (error instanceof GithubError) {
    if (error.kind === 'rateLimit' && error.retryAt) {
      return { status: 'rateLimited', retryAt: error.retryAt, message: error.message }
    }
    return { status: 'error', message: error.message, kind: error.kind }
  }
  return { status: 'error', message: 'Something went wrong.', kind: 'unknown' }
}
