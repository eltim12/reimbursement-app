<script setup>
import { computed, useAttrs } from "vue";
import { cn } from "@/lib/utils";

defineOptions({ inheritAttrs: false });

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: "",
  },
  type: {
    type: String,
    default: "text",
  },
  placeholder: String,
  disabled: Boolean,
  required: Boolean,
  class: {
    type: [String, Object, Array],
    default: "",
  },
});

defineEmits(["update:modelValue"]);

const attrs = useAttrs();

const isInvalid = computed(() => {
  const v = attrs["aria-invalid"];
  return v === true || v === "" || v === "true";
});
</script>

<template>
  <input
    v-bind="attrs"
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :required="required"
    :aria-invalid="isInvalid || undefined"
    :class="
      cn(
        'flex h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:cursor-not-allowed disabled:opacity-50',
        isInvalid &&
          'border-red-500 focus-visible:ring-red-500 aria-invalid:border-red-500 aria-invalid:ring-red-500/20',
        $props.class,
      )
    "
    @input="$emit('update:modelValue', $event.target.value)"
  />
</template>
