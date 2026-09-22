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
  <span
    data-slot="progress-label"
    :class="cn('text-sm font-medium text-neutral-900', $props.class)"
  >
    <slot />
  </span>
</template>
