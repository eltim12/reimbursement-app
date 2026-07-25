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
    :class="
      cn(
        'rounded-xl border border-neutral-200 bg-white text-neutral-900 shadow-sm',
        $props.class,
      )
    "
  >
    <slot />
  </div>
</template>
