<script setup lang="ts">
defineProps<{ icon: string; title: string; message?: string }>()
</script>

<template>
  <div class="state-panel">
    <v-icon :icon="icon" size="48" class="state-panel__icon" aria-hidden="true" />
    <h2 class="text-h6 mt-3">{{ title }}</h2>
    <p v-if="message" class="text-medium-emphasis mt-1">{{ message }}</p>
    <div v-if="$slots.default" class="mt-4">
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/tokens' as *;

.state-panel {
  text-align: center;
  padding: $space-7 $space-4;
  max-width: 36rem;
  margin-inline: auto;

  &__icon {
    opacity: 0.45;
  }
}
</style>
