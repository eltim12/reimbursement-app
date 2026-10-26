<script setup>
import { computed } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps({
  variant: {
    type: String,
    default: "secondary",
  },
  class: {
    type: [String, Object, Array],
    default: "",
  },
});

const classes = computed(() =>
  cn(
    "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
    {
      "border-transparent bg-neutral-900 text-white": props.variant === "default",
      "border-transparent bg-neutral-100 text-neutral-700":
        props.variant === "secondary",
      "border-transparent bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300":
        props.variant === "destructive" || props.variant === "red",
      "border-transparent bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300":
        props.variant === "green",
      "border-transparent bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300":
        props.variant === "blue",
      "border-transparent bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300":
        props.variant === "sky",
      "border-transparent bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300":
        props.variant === "purple",
      "border-transparent bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300":
        props.variant === "amber",
      "border-neutral-200 text-neutral-700": props.variant === "outline",
    },
    props.class,
  ),
);
</script>

<template>
  <span :class="classes">
    <slot />
  </span>
</template>
