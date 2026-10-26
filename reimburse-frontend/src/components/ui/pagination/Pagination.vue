<script setup>
import { cn } from "@/lib/utils";

defineProps({
  label: {
    type: String,
    default: "",
  },
  class: {
    type: [String, Object, Array],
    default: "",
  },
});
</script>

<template>
  <nav
    role="navigation"
    data-slot="pagination"
    :aria-label="label"
    :class="cn('mx-auto flex w-full justify-center', $props.class)"
  >
    <slot />
  </nav>
</template>
