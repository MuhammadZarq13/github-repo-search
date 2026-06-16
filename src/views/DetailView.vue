<script setup lang="ts">
import { mdiArrowLeft } from '@mdi/js'
import { useRoute } from 'vue-router'

const route = useRoute()
const owner = String(route.params.owner)
const repo = String(route.params.repo)
</script>

<template>
  <div class="app-container py-6">
    <v-btn :prepend-icon="mdiArrowLeft" variant="text" to="/" class="mb-4">Back to search</v-btn>
    <h1 class="text-h5">{{ owner }}/{{ repo }}</h1>
  </div>
</template>
