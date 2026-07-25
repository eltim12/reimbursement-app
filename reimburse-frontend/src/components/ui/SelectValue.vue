<script setup>
import { inject } from "vue";
import { cn } from "@/lib/utils";

defineProps({
  placeholder: String,
  class: {
    type: [String, Object, Array],
    default: "",
  },
});

const select = inject("select");
</script>

<template>
  <span
    :class="
      cn(
        select.selectedLabel.value ? 'text-neutral-900' : 'text-neutral-400',
        $props.class,
      )
    "
  >
    {{ select.selectedLabel.value || placeholder || select.placeholder.value }}
  </span>
</template>
