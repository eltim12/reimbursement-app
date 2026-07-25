<script setup>
import { cn } from "@/lib/utils";

defineProps({
  invalid: Boolean,
  class: {
    type: [String, Object, Array],
    default: "",
  },
});
</script>

<template>
  <div
    data-slot="field"
    :data-invalid="invalid ? '' : undefined"
    :class="cn('group/field grid gap-2', $props.class)"
  >
    <slot />
  </div>
</template>
