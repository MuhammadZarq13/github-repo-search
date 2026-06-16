<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  mdiAlertCircleOutline,
  mdiArrowLeft,
  mdiClockAlertOutline,
  mdiFileSearchOutline,
  mdiOpenInNew,
  mdiSourceFork,
  mdiStarOutline,
} from '@mdi/js'
import { useRepoDetail } from '@/composables/useRepoDetail'
import { compactNumber, formatDate, relativeTime } from '@/utils/format'
import StatePanel from '@/components/StatePanel.vue'

const route = useRoute()
const owner = computed(() => String(route.params.owner))
const repo = computed(() => String(route.params.repo))

const { state, retry } = useRepoDetail(owner, repo)

const status = computed(() => state.value.status)
const data = computed(() => (state.value.status === 'success' ? state.value.data : null))
const errorKind = computed(() => (state.value.status === 'error' ? state.value.kind : null))
const errorMessage = computed(() => (state.value.status === 'error' ? state.value.message : ''))

const rateLimitMessage = computed(() =>
  state.value.status === 'rateLimited'
    ? `You've hit GitHub's rate limit. Try again ${relativeTime(state.value.retryAt.toISOString())}.`
    : '',
)

const homepageHref = computed(() => {
  const home = data.value?.homepage?.trim()
  if (!home) return null
  return /^https?:\/\//i.test(home) ? home : `https://${home}`
})

const stats = computed(() => {
  const repoData = data.value
  if (!repoData) return []
  return [
    { label: 'Stars', value: compactNumber(repoData.stars), icon: mdiStarOutline },
    { label: 'Forks', value: compactNumber(repoData.forks), icon: mdiSourceFork },
    { label: 'Open issues', value: compactNumber(repoData.openIssues), icon: mdiAlertCircleOutline },
  ]
})

const announcement = computed(() => {
  switch (state.value.status) {
    case 'loading':
      return 'Loading repository'
    case 'success':
      return `Loaded ${state.value.data.fullName}`
    case 'rateLimited':
      return 'Rate limit reached'
    case 'error':
      return state.value.kind === 'notFound' ? 'Repository not found' : state.value.message
    default:
      return ''
  }
})
</script>

<template>
  <div class="app-container py-6">
    <v-btn :prepend-icon="mdiArrowLeft" variant="text" to="/" class="mb-4">Back to search</v-btn>

    <h1 v-if="status !== 'success'" class="sr-only">{{ owner }}/{{ repo }}</h1>
    <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>

    <v-skeleton-loader
      v-if="status === 'loading'"
      type="avatar, heading, paragraph, chip@3, actions"
    />

    <StatePanel
      v-else-if="errorKind === 'notFound'"
      :icon="mdiFileSearchOutline"
      title="Repository not found"
      :message="`We couldn't find ${owner}/${repo} on GitHub.`"
    >
      <v-btn variant="tonal" to="/">Back to search</v-btn>
    </StatePanel>

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

    <article v-else-if="data" class="detail">
      <header class="detail__header">
        <v-avatar size="56" rounded="md">
          <v-img :src="data.owner.avatarUrl" alt="" />
        </v-avatar>
        <div class="detail__heading">
          <h1 class="text-h5">{{ data.fullName }}</h1>
          <p v-if="data.description" class="text-medium-emphasis mt-1">{{ data.description }}</p>
        </div>
      </header>

      <dl class="detail__stats">
        <div v-for="stat in stats" :key="stat.label" class="detail__stat">
          <v-icon :icon="stat.icon" size="20" aria-hidden="true" />
          <dt class="detail__stat-label">{{ stat.label }}</dt>
          <dd class="detail__stat-value">{{ stat.value }}</dd>
        </div>
      </dl>

      <div v-if="data.topics.length" class="detail__topics">
        <v-chip v-for="topic in data.topics" :key="topic" size="small" variant="tonal">
          {{ topic }}
        </v-chip>
      </div>

      <dl class="detail__meta">
        <div v-if="data.language" class="detail__meta-row">
          <dt>Language</dt>
          <dd>{{ data.language }}</dd>
        </div>
        <div v-if="data.license" class="detail__meta-row">
          <dt>License</dt>
          <dd>{{ data.license }}</dd>
        </div>
        <div class="detail__meta-row">
          <dt>Default branch</dt>
          <dd>{{ data.defaultBranch }}</dd>
        </div>
        <div class="detail__meta-row">
          <dt>Created</dt>
          <dd>{{ formatDate(data.createdAt) }}</dd>
        </div>
        <div class="detail__meta-row">
          <dt>Last push</dt>
          <dd>{{ relativeTime(data.pushedAt) }}</dd>
        </div>
      </dl>

      <div class="detail__links">
        <v-btn
          :href="data.htmlUrl"
          :append-icon="mdiOpenInNew"
          target="_blank"
          rel="noopener noreferrer"
          color="primary"
          variant="flat"
        >
          View on GitHub<span class="sr-only"> (opens in new tab)</span>
        </v-btn>
        <v-btn
          v-if="homepageHref"
          :href="homepageHref"
          :append-icon="mdiOpenInNew"
          target="_blank"
          rel="noopener noreferrer"
          variant="outlined"
        >
          Homepage<span class="sr-only"> (opens in new tab)</span>
        </v-btn>
      </div>
    </article>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/tokens' as *;

.detail {
  display: flex;
  flex-direction: column;
  gap: $space-5;

  &__header {
    display: flex;
    gap: $space-4;
    align-items: flex-start;
  }

  &__heading {
    min-width: 0;

    h1 {
      overflow-wrap: anywhere;
    }
  }

  &__stats {
    display: flex;
    flex-wrap: wrap;
    gap: $space-5;
    margin: 0;
  }

  &__stat {
    display: inline-flex;
    align-items: baseline;
    gap: $space-2;
  }

  &__stat .v-icon {
    order: 0;
    align-self: center;
  }

  &__stat-value {
    order: 1;
    margin: 0;
    font-weight: $fw-semibold;
    font-variant-numeric: tabular-nums;
  }

  &__stat-label {
    order: 2;
    color: rgba(var(--v-theme-on-surface), 0.7);
    font-size: $fs-sm;
  }

  &__topics {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
  }

  &__meta {
    display: flex;
    flex-direction: column;
    gap: $space-2;
    margin: 0;
    font-size: $fs-sm;
  }

  &__meta-row {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: $space-3;

    dt {
      color: rgba(var(--v-theme-on-surface), 0.7);
    }

    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
  }

  &__links {
    display: flex;
    flex-wrap: wrap;
    gap: $space-3;
  }
}
</style>
