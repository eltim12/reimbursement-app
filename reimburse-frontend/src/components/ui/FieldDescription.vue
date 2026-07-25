<script setup>
import { cn } from "@/lib/utils";

defineProps({
  class: {
    type: [String, Object, Array],
    default: "",
  },
});
</script>

<template>
  <p
    data-slot="field-description"
    :class="
      cn(
        'text-xs text-neutral-500 group-data-[invalid]/field:text-red-600',
        $props.class,
      )
    "
  >
    <slot />
  </p>
</template>
