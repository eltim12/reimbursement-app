<script setup>
import Spinner from "./Spinner.vue";
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
  <div
    role="status"
    :class="
      cn(
        'flex flex-col items-center justify-center gap-3 py-12 text-sm text-neutral-500',
        $props.class,
      )
    "
  >
    <Spinner class="size-6 text-neutral-400" />
    <p v-if="label">{{ label }}</p>
    <slot v-else />
  </div>
</template>
