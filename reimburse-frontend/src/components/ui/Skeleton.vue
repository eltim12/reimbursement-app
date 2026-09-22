<script setup>
import { cn } from "@/lib/utils";

defineProps({
  class: {
    type: [String, Object, Array],
    default: "",
  },
});
</script>

<template>
  <div
    data-slot="skeleton"
    :class="cn('animate-pulse rounded-md bg-neutral-200', $props.class)"
  />
</template>
