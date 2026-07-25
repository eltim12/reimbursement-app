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
      "border-transparent bg-red-100 text-red-700":
        props.variant === "destructive",
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
