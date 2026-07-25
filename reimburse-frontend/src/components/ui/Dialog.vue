<script setup>
import { cn } from "@/lib/utils";

defineProps({
  open: Boolean,
  title: String,
  description: String,
  class: {
    type: [String, Object, Array],
    default: "",
  },
  actionsClass: {
    type: [String, Object, Array],
    default: "",
  },
});

defineEmits(["update:open"]);
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        class="absolute inset-0 bg-black/40"
        @click="$emit('update:open', false)"
      />
      <div
        :class="
          cn(
            'relative z-10 flex max-h-[90vh] w-full max-w-sm flex-col rounded-xl border border-neutral-200 bg-white shadow-lg',
            $props.class,
          )
        "
      >
        <div class="shrink-0 border-b border-neutral-100 px-6 py-4">
          <h3 class="text-base font-medium text-neutral-900">{{ title }}</h3>
          <p v-if="description" class="mt-1 text-sm text-neutral-500">
            {{ description }}
          </p>
        </div>
        <div
          v-if="$slots.default"
          class="min-h-0 flex-1 overflow-y-auto px-6 py-4"
        >
          <slot />
        </div>
        <div
          v-if="$slots.actions"
          :class="
            cn(
              'flex shrink-0 justify-end gap-2 border-t border-neutral-100 px-6 py-4',
              $props.actionsClass,
            )
          "
        >
          <slot name="actions" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
