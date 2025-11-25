<template>
  <v-app>
    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<script setup>
</script>

<style>
/* Ensure app background is dark */
.v-application__wrap {
  background: var(--color-background) !important;
  min-height: 100vh;
}
</style>

