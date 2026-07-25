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
  <h3 :class="cn('text-base font-medium leading-none', $props.class)">
    <slot />
  </h3>
</template>
