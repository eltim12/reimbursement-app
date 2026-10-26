<script setup>
import { MoreHorizontal } from "@lucide/vue";

defineProps({
  label: {
    type: String,
    default: "More pages",
  },
});
</script>

<template>
  <span
    aria-hidden="true"
    data-slot="pagination-ellipsis"
    class="flex h-9 w-9 items-center justify-center text-neutral-500"
  >
    <MoreHorizontal class="h-4 w-4" />
    <span class="sr-only">{{ label }}</span>
  </span>
</template>
