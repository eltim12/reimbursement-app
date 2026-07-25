<script setup>
import { inject, onMounted, onUnmounted, ref, watch } from "vue";
import { cn } from "@/lib/utils";

defineProps({
  class: {
    type: [String, Object, Array],
    default: "",
  },
  alignItemWithTrigger: {
    type: Boolean,
    default: true,
  },
});

const select = inject("select");
const triggerEl = ref(null);
const panelStyle = ref({});

const updatePosition = () => {
  const root = select?.rootEl?.value;
  if (!root) return;
  const rect = root.getBoundingClientRect();
  panelStyle.value = {
    position: "fixed",
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    zIndex: 70,
  };
};

watch(
  () => select.open.value,
  (isOpen) => {
    if (isOpen) {
      updatePosition();
    }
  },
);

const onScroll = () => {
  if (select.open.value) updatePosition();
};

onMounted(() => {
  window.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", onScroll);
});

onUnmounted(() => {
  window.removeEventListener("scroll", onScroll, true);
  window.removeEventListener("resize", onScroll);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="select.open.value"
      ref="triggerEl"
      data-select-content
      :style="panelStyle"
      :class="
        cn(
          'max-h-60 overflow-auto rounded-lg border border-neutral-200 bg-white p-1 shadow-md',
          $props.class,
        )
      "
    >
      <slot />
    </div>
  </Teleport>
</template>
