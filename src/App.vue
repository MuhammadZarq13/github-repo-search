<script setup lang="ts">
import { mdiGithub } from '@mdi/js'
</script>

<template>
  <v-app>
    <v-app-bar flat density="comfortable">
      <div class="app-container d-flex align-center">
        <v-icon :icon="mdiGithub" class="me-2" />
        <v-app-bar-title class="text-h6">Repo Search</v-app-bar-title>
      </div>
    </v-app-bar>

    <v-main>
      <div class="app-container py-6">
        <p class="text-medium-emphasis">Repository search coming soon.</p>
      </div>
    </v-main>
  </v-app>
</template>
