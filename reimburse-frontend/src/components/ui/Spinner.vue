<script setup>
import ThinkingOrb from "./ThinkingOrb.vue";
import { cn } from "@/lib/utils";

const props = defineProps({
  class: {
    type: [String, Object, Array],
    default: "",
  },
  /** Override orb animation state */
  state: {
    type: String,
    default: "working",
  },
  /** 20 inline | 32 compact | 64 page */
  size: {
    type: Number,
    default: 20,
  },
});
</script>

<template>
  <ThinkingOrb
    data-slot="spinner"
    :state="props.state"
    :size="props.size"
    theme="light"
    aria-label="Loading"
    :class="cn('text-neutral-500', $props.class)"
  />
</template>
