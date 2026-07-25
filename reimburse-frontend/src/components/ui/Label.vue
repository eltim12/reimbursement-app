<script setup>
import { cn } from "@/lib/utils";

defineProps({
  for: String,
  class: {
    type: [String, Object, Array],
    default: "",
  },
});
</script>

<template>
  <label
    :for="$props.for"
    :class="cn('text-xs font-medium text-neutral-500', $props.class)"
  >
    <slot />
  </label>
</template>
