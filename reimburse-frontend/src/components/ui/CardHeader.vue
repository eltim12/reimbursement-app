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
  <div :class="cn('flex flex-col gap-1.5 p-6', $props.class)">
    <slot />
  </div>
</template>
