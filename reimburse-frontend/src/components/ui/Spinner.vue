<script setup>
import { Loader } from "@lucide/vue";
import { cn } from "@/lib/utils";

defineProps({
  class: {
    type: [String, Object, Array],
    default: "",
  },
});
</script>

<template>
  <Loader
    data-slot="spinner"
    role="status"
    aria-label="Loading"
    :class="cn('size-4 animate-spin', $props.class)"
  />
</template>
