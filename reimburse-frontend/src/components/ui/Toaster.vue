<script setup>
import { computed } from "vue";
import {
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
  X,
} from "@lucide/vue";
import { useToast } from "@/composables/useToast";
import { cn } from "@/lib/utils";

const { toast, toastApi } = useToast();

const typeIcon = computed(() => {
  switch (toast.value.type) {
    case "success":
      return CircleCheck;
    case "info":
      return Info;
    case "warning":
      return TriangleAlert;
    case "error":
    case "destructive":
      return CircleAlert;
    default:
      return null;
  }
});

const typeStyles = computed(() => {
  switch (toast.value.type) {
    case "success":
      return {
        root: "border-emerald-200 bg-white text-neutral-900",
        icon: "text-emerald-600",
      };
    case "info":
      return {
        root: "border-sky-200 bg-white text-neutral-900",
        icon: "text-sky-600",
      };
    case "warning":
      return {
        root: "border-amber-200 bg-white text-neutral-900",
        icon: "text-amber-600",
      };
    case "error":
    case "destructive":
      return {
        root: "border-red-200 bg-white text-neutral-900",
        icon: "text-red-600",
      };
    default:
      return {
        root: "border-neutral-200 bg-white text-neutral-900",
        icon: "text-neutral-500",
      };
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
      enter-to-class="translate-y-0 opacity-100 sm:translate-x-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="toast.show"
        role="status"
        :aria-live="toast.priority === 'high' ? 'assertive' : 'polite'"
        :class="
          cn(
            'fixed top-4 right-4 z-50 flex w-full max-w-sm items-start gap-3 rounded-xl border p-4 shadow-lg',
            typeStyles.root,
          )
        "
      >
        <component
          :is="typeIcon"
          v-if="typeIcon"
          :class="cn('mt-0.5 h-5 w-5 shrink-0', typeStyles.icon)"
        />
        <div class="min-w-0 flex-1 space-y-1">
          <p
            v-if="toast.title"
            class="text-sm font-medium leading-none text-neutral-900"
          >
            {{ toast.title }}
          </p>
          <p
            v-if="toast.description"
            class="text-sm text-neutral-600 whitespace-pre-line"
          >
            {{ toast.description }}
          </p>
        </div>
        <button
          type="button"
          class="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          :aria-label="'Close'"
          @click="toastApi.close()"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>
