import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { vuetify } from '@/plugins/vuetify'
import RepoCard from './RepoCard.vue'
import type { RepoSummary } from '@/types/github'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/repos/:owner/:repo', component: { template: '<div />' } },
  ],
})

const repo: RepoSummary = {
  id: 1,
  name: 'core',
  fullName: 'vuejs/core',
  owner: { login: 'vuejs', avatarUrl: 'https://avatars/vuejs.png', htmlUrl: 'h' },
  description: 'The heart of Vue',
  stars: 12300,
  language: 'TypeScript',
  htmlUrl: 'https://github.com/vuejs/core',
  updatedAt: '2024-01-01T00:00:00Z',
}

function render(props: { repo: RepoSummary }) {
  return mount(RepoCard, { props, global: { plugins: [vuetify, router] } })
}

describe('RepoCard', () => {
  it('renders the name, compact stars, and language', () => {
    const wrapper = render({ repo })
    expect(wrapper.text()).toContain('vuejs/core')
    expect(wrapper.text()).toContain('12.3K')
    expect(wrapper.text()).toContain('TypeScript')
  })

  it('links to the detail route', () => {
    const wrapper = render({ repo })
    expect(wrapper.find('a').attributes('href')).toBe('/repos/vuejs/core')
  })

  it('gives the card link a clean accessible name', () => {
    const wrapper = render({ repo })
    expect(wrapper.find('a').attributes('aria-label')).toBe('vuejs/core repository')
  })

  it('omits the description when there is none', () => {
    const wrapper = render({ repo: { ...repo, description: null } })
    expect(wrapper.find('.repo-card__desc').exists()).toBe(false)
  })

  it('hides the language stat when language is null', () => {
    const wrapper = render({ repo: { ...repo, language: null } })
    expect(wrapper.text()).not.toContain('TypeScript')
  })
})
