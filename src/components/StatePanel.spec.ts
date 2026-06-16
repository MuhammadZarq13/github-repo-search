import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { vuetify } from '@/plugins/vuetify'
import StatePanel from './StatePanel.vue'

describe('StatePanel', () => {
  it('renders the title and message', () => {
    const wrapper = mount(StatePanel, {
      props: { icon: 'M3 3h2', title: 'No results', message: 'Try a broader term' },
      global: { plugins: [vuetify] },
    })
    expect(wrapper.text()).toContain('No results')
    expect(wrapper.text()).toContain('Try a broader term')
  })

  it('renders default slot actions', () => {
    const wrapper = mount(StatePanel, {
      props: { icon: 'M3 3h2', title: 'Something went wrong' },
      slots: { default: '<button>Retry</button>' },
      global: { plugins: [vuetify] },
    })
    expect(wrapper.find('button').text()).toBe('Retry')
  })
})
