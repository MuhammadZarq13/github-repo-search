<script setup lang="ts">
import { computed } from 'vue'
import { mdiStar } from '@mdi/js'
import type { RepoSummary } from '@/types/github'
import { compactNumber, relativeTime } from '@/utils/format'

const props = defineProps<{ repo: RepoSummary }>()

const to = computed(() => `/repos/${props.repo.owner.login}/${props.repo.name}`)
</script>

<template>
  <v-card :to="to" :aria-label="`${repo.fullName} repository`" variant="outlined" class="repo-card">
    <div class="repo-card__body">
      <v-avatar size="40" rounded="md" class="repo-card__avatar">
        <v-img :src="repo.owner.avatarUrl" alt="" />
      </v-avatar>

      <div class="repo-card__content">
        <span class="repo-card__name">{{ repo.fullName }}</span>
        <p v-if="repo.description" class="repo-card__desc">{{ repo.description }}</p>

        <div class="repo-card__meta text-medium-emphasis">
          <span class="repo-card__stat">
            <v-icon :icon="mdiStar" size="16" aria-hidden="true" />
            {{ compactNumber(repo.stars) }}
          </span>
          <span v-if="repo.language" class="repo-card__stat">
            <span class="repo-card__dot" aria-hidden="true" />
            {{ repo.language }}
          </span>
          <span class="repo-card__stat">Updated {{ relativeTime(repo.updatedAt) }}</span>
        </div>
      </div>
    </div>
  </v-card>
</template>

<style scoped lang="scss">
@use '../styles/tokens' as *;

.repo-card {
  &__body {
    display: flex;
    gap: $space-4;
    padding: $space-4;
  }

  &__avatar {
    flex: 0 0 auto;
  }

  &__content {
    min-width: 0;
  }

  &__name {
    display: block;
    font-weight: $fw-semibold;
    font-size: $fs-md;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__desc {
    margin: $space-1 0 0;
    font-size: $fs-sm;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: $space-4;
    margin-top: $space-3;
    font-size: $fs-sm;
    font-variant-numeric: tabular-nums;
  }

  &__stat {
    display: inline-flex;
    align-items: center;
    gap: $space-1;
  }

  &__dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: rgb(var(--v-theme-primary));
  }
}
</style>
