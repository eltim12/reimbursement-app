<script setup>
import { cn } from "@/lib/utils";
import Button from "../Button.vue";

defineProps({
  isActive: Boolean,
  disabled: Boolean,
  size: {
    type: String,
    default: "icon",
  },
  class: {
    type: [String, Object, Array],
    default: "",
  },
});

defineEmits(["click"]);
</script>

<template>
  <Button
    type="button"
    :variant="isActive ? 'outline' : 'ghost'"
    :size="size"
    :disabled="disabled"
    :aria-current="isActive ? 'page' : undefined"
    data-slot="pagination-link"
    :data-active="isActive ? true : undefined"
    :class="cn($props.class)"
    @click="$emit('click', $event)"
  >
    <slot />
  </Button>
</template>
