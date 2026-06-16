import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { vuetify } from '@/plugins/vuetify'
import SearchView from './SearchView.vue'
import { githubClientKey } from '@/composables/useRepoSearch'
import type { GithubClient } from '@/services/github'
import type { SearchResult } from '@/types/github'
import { GithubError } from '@/services/errors'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: SearchView },
    { path: '/repos/:owner/:repo', component: { template: '<div />' } },
  ],
})

const result: SearchResult = {
  total: 1,
  incomplete: false,
  items: [
    {
      id: 1,
      name: 'core',
      fullName: 'vuejs/core',
      owner: { login: 'vuejs', avatarUrl: 'a', htmlUrl: 'h' },
      description: null,
      stars: 1,
      language: null,
      htmlUrl: 'h',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ],
}

let wrapper: ReturnType<typeof mount> | undefined

function render(search: GithubClient['searchRepositories']) {
  const client: GithubClient = { searchRepositories: search, getRepository: vi.fn() }
  wrapper = mount(SearchView, {
    global: { plugins: [vuetify, router], provide: { [githubClientKey as symbol]: client } },
  })
  return wrapper
}

async function type(target: ReturnType<typeof mount>, term: string) {
  await target.find('input').setValue(term)
  await vi.advanceTimersByTimeAsync(350)
  await flushPromises()
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
})

describe('SearchView', () => {
  it('shows the idle prompt before any search', () => {
    expect(render(vi.fn()).text()).toContain('Search public repositories')
  })

  it('renders results once a search resolves', async () => {
    vi.useFakeTimers()
    const w = render(vi.fn(async () => result))
    await type(w, 'vue')
    expect(w.text()).toContain('vuejs/core')
  })

  it('shows the empty state when nothing matches', async () => {
    vi.useFakeTimers()
    const w = render(vi.fn(async () => ({ total: 0, incomplete: false, items: [] })))
    await type(w, 'zzzznope')
    expect(w.text()).toContain('No repositories found')
  })

  it('shows an error state with a retry action on failure', async () => {
    vi.useFakeTimers()
    const w = render(
      vi.fn(async () => {
        throw new GithubError('network', 'offline')
      }),
    )
    await type(w, 'vue')
    expect(w.text()).toContain('Something went wrong')
    expect(w.text()).toContain('Try again')
  })

  it('shows the rate-limit state with a retry action', async () => {
    vi.useFakeTimers()
    const w = render(
      vi.fn(async () => {
        throw new GithubError('rateLimit', 'slow down', { retryAt: new Date(Date.now() + 60_000) })
      }),
    )
    await type(w, 'vue')
    expect(w.text()).toContain('Rate limit reached')
    expect(w.text()).toContain('Try again')
  })

  it('notes the result cap and paginates large result sets', async () => {
    vi.useFakeTimers()
    const w = render(vi.fn(async () => ({ total: 5000, incomplete: false, items: result.items })))
    await type(w, 'vue')
    expect(w.text()).toContain('showing the first 990')
    expect(w.find('.v-pagination').exists()).toBe(true)
  })
})
