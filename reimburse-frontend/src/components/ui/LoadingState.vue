<script setup>
import ThinkingOrb from "./ThinkingOrb.vue";
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
  state: {
    type: String,
    default: "working",
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
    <ThinkingOrb :state="state" :size="64" theme="light" aria-label="Loading" />
    <p v-if="label">{{ label }}</p>
    <slot v-else />
  </div>
</template>
