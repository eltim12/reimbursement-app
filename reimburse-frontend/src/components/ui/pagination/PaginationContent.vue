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
  <ul
    data-slot="pagination-content"
    :class="cn('flex flex-row items-center gap-1', $props.class)"
  >
    <slot />
  </ul>
</template>
