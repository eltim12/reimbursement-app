<script setup>
import { inject } from "vue";
import { ChevronDown } from "@lucide/vue";
import { cn } from "@/lib/utils";

defineProps({
  class: {
    type: [String, Object, Array],
    default: "",
  },
});

const select = inject("select");
</script>

<template>
  <button
    type="button"
    role="combobox"
    :aria-expanded="select.open.value"
    :disabled="select.disabled.value"
    :class="
      cn(
        'flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:cursor-not-allowed disabled:opacity-50',
        $props.class,
      )
    "
    @click="select.setOpen(!select.open.value)"
  >
    <span class="min-w-0 flex-1 truncate text-left">
      <slot />
    </span>
    <ChevronDown class="h-4 w-4 shrink-0 opacity-50" />
  </button>
</template>
