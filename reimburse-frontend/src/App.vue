<template>
  <div id="app-root" class="flex h-full min-h-0 flex-col">
    <router-view />
    <Toaster />
  </div>
</template>

<script setup>
import Toaster from "@/components/ui/Toaster.vue";
</script>
