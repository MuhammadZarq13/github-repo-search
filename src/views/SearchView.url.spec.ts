import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { vuetify } from '@/plugins/vuetify'
import SearchView from './SearchView.vue'
import { githubClientKey } from '@/composables/useRepoSearch'
import type { GithubClient } from '@/services/github'
import type { SearchResult } from '@/types/github'

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

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: SearchView },
    { path: '/repos/:owner/:repo', component: { template: '<div />' } },
  ],
})

let wrapper: ReturnType<typeof mount> | undefined

async function renderAt(path: string, search: GithubClient['searchRepositories']) {
  const client: GithubClient = { searchRepositories: search, getRepository: vi.fn() }
  await router.push(path)
  await router.isReady()
  wrapper = mount(SearchView, {
    global: { plugins: [vuetify, router], provide: { [githubClientKey as symbol]: client } },
  })
  return wrapper
}

afterEach(async () => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
  vi.useRealTimers()
  await router.push('/')
})

describe('SearchView URL sync', () => {
  it('runs a search seeded from the URL query', async () => {
    vi.useFakeTimers()
    const search = vi.fn(async () => result)
    const w = await renderAt('/?q=vue&page=2', search)
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()

    expect(search).toHaveBeenCalledWith(expect.objectContaining({ query: 'vue', page: 2 }))
    expect(w.text()).toContain('vuejs/core')
  })

  it('writes the searched term to the URL', async () => {
    vi.useFakeTimers()
    const search = vi.fn(async () => result)
    const w = await renderAt('/', search)

    await w.find('input').setValue('vue')
    await vi.advanceTimersByTimeAsync(350)
    await flushPromises()

    expect(router.currentRoute.value.query.q).toBe('vue')
  })

  it('re-runs the search when the route query changes (back/forward)', async () => {
    vi.useFakeTimers()
    const search = vi.fn(async () => result)
    await renderAt('/?q=vue', search)
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()
    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'vue' }))

    await router.push('/?q=react')
    await flushPromises()

    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'react' }))
  })

  it('clears the URL query when the search is cleared', async () => {
    vi.useFakeTimers()
    const search = vi.fn(async () => result)
    const w = await renderAt('/?q=vue', search)
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()

    await w.find('input').setValue('')
    await flushPromises()

    expect(router.currentRoute.value.query.q).toBeUndefined()
  })

  it('does not rewrite the URL when seeded from a matching deep-link', async () => {
    const replace = vi.spyOn(router, 'replace')
    vi.useFakeTimers()
    await renderAt('/?q=vue', vi.fn(async () => result))
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()

    expect(replace).not.toHaveBeenCalled()
  })

  it('writes the URL exactly once per committed search (no feedback loop)', async () => {
    vi.useFakeTimers()
    const w = await renderAt('/', vi.fn(async () => result))
    const replace = vi.spyOn(router, 'replace')

    await w.find('input').setValue('vue')
    await vi.advanceTimersByTimeAsync(350)
    await flushPromises()

    expect(replace).toHaveBeenCalledTimes(1)
  })

  it('restores the query and page when navigating back to a search URL', async () => {
    vi.useFakeTimers()
    const search = vi.fn(async () => result)
    await renderAt('/?q=vue&page=2', search)
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()
    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'vue', page: 2 }))

    await router.push('/repos/vuejs/core')
    await flushPromises()
    await router.push('/?q=vue&page=2')
    await flushPromises()

    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'vue', page: 2 }))
  })

  it('rewrites an out-of-range deep-link page to the reachable cap', async () => {
    vi.useFakeTimers()
    await renderAt('/?q=vue&page=999', vi.fn(async () => result))
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()

    expect(router.currentRoute.value.query.page).toBe('33')
  })
})
