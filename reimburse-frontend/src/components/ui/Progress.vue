<script setup>
import { computed, provide } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps({
  /** 0–100; omit / null + indeterminate for unknown progress */
  value: {
    type: Number,
    default: undefined,
  },
  indeterminate: Boolean,
  class: {
    type: [String, Object, Array],
    default: "",
  },
  indicatorClass: {
    type: [String, Object, Array],
    default: "",
  },
  /** Accessible name when no ProgressLabel is used */
  "aria-label": {
    type: String,
    default: undefined,
  },
});

const isIndeterminate = computed(
  () => props.indeterminate || props.value == null,
);

const percentage = computed(() => {
  if (isIndeterminate.value) return undefined;
  return Math.max(0, Math.min(100, Number(props.value) || 0));
});

const valueText = computed(() =>
  percentage.value == null ? undefined : `${Math.round(percentage.value)}%`,
);

provide("progress", {
  percentage,
  isIndeterminate,
  valueText,
});

const indicatorWidth = computed(() => {
  if (isIndeterminate.value) return "40%";
  return `${percentage.value ?? 0}%`;
});
</script>

<template>
  <div
    data-slot="progress"
    role="progressbar"
    :aria-label="props['aria-label']"
    :aria-valuenow="percentage ?? undefined"
    :aria-valuemin="0"
    :aria-valuemax="100"
    :aria-valuetext="valueText"
    :data-indeterminate="isIndeterminate || undefined"
    :class="cn('flex w-full flex-wrap items-center gap-x-3 gap-y-1.5', $props.class)"
  >
    <slot />
    <span
      data-slot="progress-track"
      class="relative flex h-1 w-full basis-full items-center overflow-x-hidden rounded-full bg-neutral-200"
    >
      <span
        data-slot="progress-indicator"
        :class="
          cn(
            'h-full bg-neutral-900 transition-all duration-300 ease-out',
            isIndeterminate && 'animate-pulse',
            $props.indicatorClass,
          )
        "
        :style="{ width: indicatorWidth }"
      />
    </span>
  </div>
</template>
