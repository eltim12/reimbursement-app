<script setup>
import { ChevronLeft } from "@lucide/vue";
import { cn } from "@/lib/utils";
import PaginationLink from "./PaginationLink.vue";

defineProps({
  disabled: Boolean,
  label: {
    type: String,
    default: "Previous",
  },
  class: {
    type: [String, Object, Array],
    default: "",
  },
});

defineEmits(["click"]);
</script>

<template>
  <PaginationLink
    size="sm"
    :disabled="disabled"
    :aria-label="label"
    :class="cn('h-9 gap-1 px-2.5', $props.class)"
    @click="$emit('click', $event)"
  >
    <ChevronLeft class="h-4 w-4" aria-hidden="true" />
    <span class="hidden sm:inline">{{ label }}</span>
  </PaginationLink>
</template>
