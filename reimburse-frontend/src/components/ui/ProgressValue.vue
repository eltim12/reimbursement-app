<script setup>
import { inject, computed, unref } from "vue";
import { cn } from "@/lib/utils";

defineProps({
  class: {
    type: [String, Object, Array],
    default: "",
  },
});

const progress = inject("progress", null);
const text = computed(() => unref(progress?.valueText) ?? "");
</script>

<template>
  <span
    data-slot="progress-value"
    :class="
      cn('ml-auto text-sm tabular-nums text-neutral-500', $props.class)
    "
  >
    <slot :value="text">{{ text }}</slot>
  </span>
</template>
