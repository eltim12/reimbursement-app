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
  <p :class="cn('text-sm text-neutral-500', $props.class)">
    <slot />
  </p>
</template>
