import { createRouter, createWebHistory } from 'vue-router'
import SearchView from '@/views/SearchView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'search', component: SearchView },
    {
      path: '/repos/:owner/:repo',
      name: 'repo',
      component: () => import('@/views/DetailView.vue'),
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
