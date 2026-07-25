<script setup>
import { useToast } from "@/composables/useToast";
import { cn } from "@/lib/utils";

const { toast } = useToast();
</script>

<template>
  <Teleport to="body">
    <div
      v-if="toast.show"
      :class="
        cn(
          'fixed top-4 right-4 z-50 max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg',
          toast.type === 'error' || toast.type === 'destructive'
            ? 'border-red-200 bg-red-50 text-red-800'
            : toast.type === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : toast.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-neutral-200 bg-white text-neutral-900',
        )
      "
    >
      {{ toast.message }}
    </div>
  </Teleport>
</template>
