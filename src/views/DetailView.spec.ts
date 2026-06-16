import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { vuetify } from '@/plugins/vuetify'
import DetailView from './DetailView.vue'
import { githubClientKey } from '@/composables/useRepoSearch'
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
  forks: 5000,
  openIssues: 300,
  watchers: 12300,
  topics: ['vue', 'framework'],
  homepage: 'https://vuejs.org',
  license: 'MIT License',
  defaultBranch: 'main',
  createdAt: '2020-01-01T00:00:00Z',
  pushedAt: '2024-06-01T00:00:00Z',
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/repos/:owner/:repo', component: DetailView },
  ],
})

let wrapper: ReturnType<typeof mount> | undefined

async function render(getRepository: GithubClient['getRepository']) {
  const client: GithubClient = { searchRepositories: vi.fn(), getRepository }
  router.push('/repos/vuejs/core')
  await router.isReady()
  wrapper = mount(DetailView, {
    global: { plugins: [vuetify, router], provide: { [githubClientKey as symbol]: client } },
  })
  await flushPromises()
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('DetailView', () => {
  it('renders the repository details on success', async () => {
    const w = await render(vi.fn(async () => detail))
    expect(w.text()).toContain('vuejs/core')
    expect(w.text()).toContain('The heart of Vue')
    expect(w.text()).toContain('12.3K')
    expect(w.text()).toContain('vue')
    expect(w.find('a[href="https://github.com/vuejs/core"]').exists()).toBe(true)
    expect(w.find('a[href="https://vuejs.org"]').exists()).toBe(true)
  })

  it('normalises a scheme-less homepage into a valid link', async () => {
    const w = await render(vi.fn(async () => ({ ...detail, homepage: 'vuejs.org' })))
    expect(w.find('a[href="https://vuejs.org"]').exists()).toBe(true)
  })

  it('shows a not-found state with a way back', async () => {
    const w = await render(
      vi.fn(async () => {
        throw new GithubError('notFound', 'not found', { status: 404 })
      }),
    )
    expect(w.text()).toContain('Repository not found')
    expect(w.text()).toContain('Back to search')
  })

  it('shows the rate-limit state with a retry action', async () => {
    const w = await render(
      vi.fn(async () => {
        throw new GithubError('rateLimit', 'slow down', { retryAt: new Date(Date.now() + 60_000) })
      }),
    )
    expect(w.text()).toContain('Rate limit reached')
    expect(w.text()).toContain('Try again')
  })

  it('shows an error state with retry on failure', async () => {
    const w = await render(
      vi.fn(async () => {
        throw new GithubError('network', 'offline')
      }),
    )
    expect(w.text()).toContain('Something went wrong')
    expect(w.text()).toContain('Try again')
  })
})
