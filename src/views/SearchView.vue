<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import {
  mdiAlertCircleOutline,
  mdiClockAlertOutline,
  mdiGithub,
  mdiMagnify,
  mdiMagnifyClose,
} from '@mdi/js'
import { useRepoSearch } from '@/composables/useRepoSearch'
import { compactNumber, relativeTime } from '@/utils/format'
import RepoCard from '@/components/RepoCard.vue'
import StatePanel from '@/components/StatePanel.vue'

const { query, page, state, maxPage, capped, perPage, goToPage, retry, restore } = useRepoSearch()
const { smAndDown } = useDisplay()
const route = useRoute()
const router = useRouter()

function paramsFromState(): Record<string, string> {
  const params: Record<string, string> = {}
  const term = query.value.trim()
  if (term) params.q = term
  if (page.value > 1) params.page = String(page.value)
  return params
}

function readQuery() {
  const term = typeof route.query.q === 'string' ? route.query.q : ''
  const targetPage = Math.max(1, Number(route.query.page) || 1)
  return { term, targetPage }
}

watch(
  () => state.value.status,
  (status) => {
    if (status === 'loading') return
    const params = paramsFromState()
    const current = readQuery()
    if (current.term === (params.q ?? '') && current.targetPage === Number(params.page ?? 1)) return
    void router.replace({ query: params })
  },
)

watch(
  () => route.query,
  () => {
    const { term, targetPage } = readQuery()
    if (term === query.value.trim() && targetPage === page.value) return
    if (!term) {
      query.value = ''
      return
    }
    restore(term, targetPage)
  },
)

const initial = readQuery()
if (initial.term) restore(initial.term, initial.targetPage)

const status = computed(() => state.value.status)
const items = computed(() => (state.value.status === 'success' ? state.value.data.items : []))
const total = computed(() => (state.value.status === 'success' ? state.value.data.total : 0))
const errorMessage = computed(() => (state.value.status === 'error' ? state.value.message : ''))
const reachable = computed(() => maxPage.value * perPage)
const pageButtons = computed(() => (smAndDown.value ? 3 : 5))

const rateLimitMessage = computed(() =>
  state.value.status === 'rateLimited'
    ? `You've hit GitHub's rate limit. Try again ${relativeTime(state.value.retryAt.toISOString())}.`
    : '',
)

const announcement = computed(() => {
  switch (state.value.status) {
    case 'loading':
      return 'Searching repositories'
    case 'empty':
      return 'No repositories found'
    case 'error':
      return state.value.message
    case 'rateLimited':
      return 'Rate limit reached'
    case 'success':
      return `${compactNumber(state.value.data.total)} repositories found`
    default:
      return ''
  }
})
</script>

<template>
  <div class="app-container py-6">
    <h1 class="sr-only">Search GitHub repositories</h1>

    <v-text-field
      v-model="query"
      :prepend-inner-icon="mdiMagnify"
      label="Search repositories"
      placeholder="e.g. vue, react, tensorflow"
      :loading="status === 'loading'"
      clearable
      autofocus
    />

    <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>

    <div>
      <StatePanel
        v-if="status === 'idle'"
        :icon="mdiGithub"
        title="Search public repositories"
        message="Find any project on GitHub by name, topic, or keyword."
      />

      <div v-else-if="status === 'loading'" class="results" aria-busy="true">
        <v-skeleton-loader v-for="n in 6" :key="n" type="list-item-avatar-two-line" />
      </div>

      <StatePanel
        v-else-if="status === 'empty'"
        :icon="mdiMagnifyClose"
        title="No repositories found"
        :message="`Nothing matched “${query}”. Try a broader term.`"
      />

      <StatePanel
        v-else-if="status === 'rateLimited'"
        :icon="mdiClockAlertOutline"
        title="Rate limit reached"
        :message="rateLimitMessage"
      >
        <v-btn variant="tonal" @click="retry">Try again</v-btn>
      </StatePanel>

      <StatePanel
        v-else-if="status === 'error'"
        :icon="mdiAlertCircleOutline"
        title="Something went wrong"
        :message="errorMessage"
      >
        <v-btn variant="tonal" @click="retry">Try again</v-btn>
      </StatePanel>

      <template v-else-if="status === 'success'">
        <p class="text-medium-emphasis text-body-2 mb-3">
          {{ compactNumber(total) }} repositories
          <span v-if="capped"> · showing the first {{ compactNumber(reachable) }}</span>
        </p>

        <ul class="results">
          <li v-for="repo in items" :key="repo.id">
            <RepoCard :repo="repo" />
          </li>
        </ul>

        <v-pagination
          v-if="maxPage > 1"
          :model-value="page"
          :length="maxPage"
          :total-visible="pageButtons"
          density="comfortable"
          class="mt-4"
          @update:model-value="goToPage"
        />
      </template>
    </div>
  </div>
</template>
