<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { Check, ChevronsUpDown, Search } from "@lucide/vue";
import { cn } from "@/lib/utils";

const props = defineProps({
  modelValue: {
    type: [String, Number, null],
    default: null,
  },
  items: {
    type: Array,
    default: () => [],
  },
  placeholder: {
    type: String,
    default: "Select…",
  },
  searchPlaceholder: {
    type: String,
    default: "Search…",
  },
  disabled: Boolean,
  emptyText: {
    type: String,
    default: "No results",
  },
  invalid: Boolean,
});

const emit = defineEmits(["update:modelValue"]);

const open = ref(false);
const query = ref("");
const rootEl = ref(null);
const searchEl = ref(null);
const panelStyle = ref({});

const selectedLabel = computed(() => {
  const match = props.items.find((item) => item.value === props.modelValue);
  return match?.label ?? (props.modelValue || null);
});

const filteredItems = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.items;
  return props.items.filter((item) => {
    const hay = [item.label, item.value, item.id, item.zh]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
});

const updatePosition = () => {
  if (!rootEl.value) return;
  const rect = rootEl.value.getBoundingClientRect();
  panelStyle.value = {
    position: "fixed",
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    zIndex: 70,
  };
};

const setOpen = async (value) => {
  if (props.disabled) return;
  open.value = value;
  if (value) {
    query.value = "";
    updatePosition();
    await nextTick();
    searchEl.value?.focus();
  }
};

const selectItem = (value) => {
  emit("update:modelValue", value);
  open.value = false;
  query.value = "";
};

const onDocClick = (e) => {
  if (!open.value) return;
  if (rootEl.value?.contains(e.target)) return;
  if (e.target.closest?.("[data-combobox-content]")) return;
  open.value = false;
};

const onKeydown = (e) => {
  if (e.key === "Escape") open.value = false;
};

const onScroll = () => {
  if (open.value) updatePosition();
};

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) open.value = false;
  },
);

onMounted(() => {
  document.addEventListener("click", onDocClick);
  document.addEventListener("keydown", onKeydown);
  window.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", onScroll);
});

onUnmounted(() => {
  document.removeEventListener("click", onDocClick);
  document.removeEventListener("keydown", onKeydown);
  window.removeEventListener("scroll", onScroll, true);
  window.removeEventListener("resize", onScroll);
});
</script>

<template>
  <div ref="rootEl" class="relative w-full">
    <button
      type="button"
      :disabled="disabled"
      :aria-invalid="invalid ? 'true' : undefined"
      :class="
        cn(
          'flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-left text-sm transition-colors',
          'hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400',
          'disabled:cursor-not-allowed disabled:opacity-50',
          !selectedLabel && 'text-neutral-400',
          invalid &&
            'border-red-500 text-neutral-900 hover:bg-red-50 focus-visible:ring-red-500',
        )
      "
      @click="setOpen(!open)"
    >
      <span class="truncate">{{ selectedLabel || placeholder }}</span>
      <ChevronsUpDown class="h-4 w-4 shrink-0 text-neutral-400" />
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        data-combobox-content
        :style="panelStyle"
        class="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-md"
      >
        <div class="relative border-b border-neutral-100 p-2">
          <Search
            class="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-neutral-400"
          />
          <input
            ref="searchEl"
            v-model="query"
            type="text"
            class="h-10 w-full rounded-md border border-neutral-200 bg-white pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-neutral-400"
            :placeholder="searchPlaceholder"
            @keydown.stop
          />
        </div>
        <div class="max-h-56 overflow-y-auto p-1">
          <button
            v-for="item in filteredItems"
            :key="item.value"
            type="button"
            class="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-neutral-100"
            @click="selectItem(item.value)"
          >
            <Check
              class="mt-0.5 h-4 w-4 shrink-0"
              :class="
                modelValue === item.value ? 'opacity-100' : 'opacity-0'
              "
            />
            <span class="min-w-0 flex-1 leading-snug">{{ item.label }}</span>
          </button>
          <div
            v-if="filteredItems.length === 0"
            class="px-3 py-6 text-center text-sm text-neutral-500"
          >
            {{ emptyText }}
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
