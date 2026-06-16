<script setup lang="ts">
import { mdiGithub } from '@mdi/js'
</script>

<template>
  <v-app>
    <v-app-bar flat density="comfortable" border="b">
      <div class="app-container d-flex align-center">
        <router-link to="/" class="brand">
          <v-icon :icon="mdiGithub" class="me-2" />
          <span class="text-h6">Repo Search</span>
        </router-link>
      </div>
    </v-app-bar>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<style scoped lang="scss">
.brand {
  display: inline-flex;
  align-items: center;
  color: inherit;
  text-decoration: none;
}
</style>
