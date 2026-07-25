<script setup>
import { computed, onMounted, onUnmounted, provide, ref, watch } from "vue";

const props = defineProps({
  modelValue: {
    type: [String, Number, null],
    default: null,
  },
  items: {
    type: Array,
    default: () => [],
  },
  disabled: Boolean,
  placeholder: {
    type: String,
    default: "Select…",
  },
});

const emit = defineEmits(["update:modelValue"]);

const open = ref(false);
const rootEl = ref(null);

const selectedLabel = computed(() => {
  const match = props.items.find((item) => item.value === props.modelValue);
  return match?.label ?? null;
});

const setValue = (value) => {
  emit("update:modelValue", value);
  open.value = false;
};

const setOpen = (value) => {
  if (props.disabled) return;
  open.value = value;
};

provide("select", {
  open,
  setOpen,
  modelValue: computed(() => props.modelValue),
  setValue,
  selectedLabel,
  placeholder: computed(() => props.placeholder),
  items: computed(() => props.items),
  disabled: computed(() => props.disabled),
  rootEl,
});

const onDocClick = (e) => {
  if (!open.value) return;
  if (rootEl.value?.contains(e.target)) return;
  if (e.target.closest?.("[data-select-content]")) return;
  open.value = false;
};

const onKeydown = (e) => {
  if (e.key === "Escape") open.value = false;
};

onMounted(() => {
  document.addEventListener("click", onDocClick);
  document.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
  document.removeEventListener("click", onDocClick);
  document.removeEventListener("keydown", onKeydown);
});

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) open.value = false;
  },
);
</script>

<template>
  <div ref="rootEl" class="relative w-full">
    <slot />
  </div>
</template>
