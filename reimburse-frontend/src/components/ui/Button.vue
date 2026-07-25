<script setup>
import { computed } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps({
  variant: {
    type: String,
    default: "default",
  },
  size: {
    type: String,
    default: "default",
  },
  type: {
    type: String,
    default: "button",
  },
  disabled: Boolean,
  loading: Boolean,
  class: {
    type: [String, Object, Array],
    default: "",
  },
});

const classes = computed(() =>
  cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:pointer-events-none disabled:opacity-50",
    {
      "bg-neutral-900 text-white hover:bg-neutral-800": props.variant === "default",
      "border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50":
        props.variant === "outline",
      "bg-neutral-100 text-neutral-900 hover:bg-neutral-200":
        props.variant === "secondary",
      "hover:bg-neutral-100 text-neutral-700": props.variant === "ghost",
      "bg-red-600 text-white hover:bg-red-700": props.variant === "destructive",
      "text-neutral-900 underline-offset-4 hover:underline":
        props.variant === "link",
      "h-11 px-4 py-2": props.size === "default",
      "h-10 px-3": props.size === "sm",
      "h-9 w-9 p-0": props.size === "icon",
      "h-8 w-8 p-0": props.size === "icon-sm",
    },
    props.class,
  ),
);
</script>

<template>
  <button :type="type" :class="classes" :disabled="disabled || loading">
    <span
      v-if="loading"
      class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
    <slot />
  </button>
</template>
