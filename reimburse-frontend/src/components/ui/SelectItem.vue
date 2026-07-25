<script setup>
import { computed, inject } from "vue";
import { Check } from "@lucide/vue";
import { cn } from "@/lib/utils";

const props = defineProps({
  value: {
    type: [String, Number, null],
    required: true,
  },
  disabled: Boolean,
  class: {
    type: [String, Object, Array],
    default: "",
  },
});

const select = inject("select");

const isSelected = computed(() => select.modelValue.value === props.value);

const onSelect = () => {
  if (props.disabled || props.value == null) return;
  select.setValue(props.value);
};
</script>

<template>
  <button
    type="button"
    role="option"
    :aria-selected="isSelected"
    :disabled="disabled || value == null"
    :class="
      cn(
        'relative flex w-full cursor-default items-center rounded-md py-2 pr-8 pl-2 text-left text-sm outline-none select-none',
        disabled || value == null
          ? 'cursor-not-allowed text-neutral-400'
          : 'hover:bg-neutral-100 focus:bg-neutral-100',
        isSelected && 'bg-neutral-100',
        $props.class,
      )
    "
    @click="onSelect"
  >
    <span class="truncate"><slot /></span>
    <span
      v-if="isSelected"
      class="absolute right-2 flex h-3.5 w-3.5 items-center justify-center"
    >
      <Check class="h-4 w-4" />
    </span>
  </button>
</template>
