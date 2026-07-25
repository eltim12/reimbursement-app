<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { Calendar as CalendarIcon } from "@lucide/vue";
import Button from "@/components/ui/Button.vue";
import Calendar from "@/components/ui/Calendar.vue";
import { cn } from "@/lib/utils";

const props = defineProps({
  modelValue: {
    type: String,
    default: "",
  },
  placeholder: {
    type: String,
    default: "Pick a date",
  },
  required: Boolean,
  invalid: Boolean,
  class: {
    type: [String, Object, Array],
    default: "",
  },
});

const emit = defineEmits(["update:modelValue"]);

const open = ref(false);
const rootEl = ref(null);
const panelStyle = ref({});

const selectedDate = computed(() => {
  if (!props.modelValue) return null;
  const [y, m, d] = props.modelValue.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
});

const displayLabel = computed(() => {
  if (!selectedDate.value) return null;
  return selectedDate.value.toLocaleDateString(undefined, {
    dateStyle: "long",
  });
});

const toValue = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const updatePosition = () => {
  if (!rootEl.value) return;
  const rect = rootEl.value.getBoundingClientRect();
  const panelWidth = 280;
  const left = Math.min(
    rect.left,
    Math.max(8, window.innerWidth - panelWidth - 8),
  );
  panelStyle.value = {
    position: "fixed",
    top: `${rect.bottom + 4}px`,
    left: `${left}px`,
    zIndex: 70,
  };
};

const toggleOpen = async () => {
  open.value = !open.value;
  if (open.value) {
    await nextTick();
    updatePosition();
  }
};

const onSelect = (date) => {
  emit("update:modelValue", toValue(date));
  open.value = false;
};

const onDocClick = (e) => {
  if (!open.value) return;
  if (rootEl.value && !rootEl.value.contains(e.target)) {
    const panel = document.getElementById("date-picker-panel");
    if (panel && panel.contains(e.target)) return;
    open.value = false;
  }
};

const onKeydown = (e) => {
  if (e.key === "Escape") open.value = false;
};

const onScroll = () => {
  if (open.value) updatePosition();
};

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
    <Button
      type="button"
      variant="outline"
      :aria-required="required"
      :aria-invalid="invalid ? 'true' : undefined"
      :data-empty="!selectedDate"
      :class="
        cn(
          'h-11 w-full justify-start text-left font-normal data-[empty=true]:text-neutral-400',
          invalid &&
            'border-red-500 text-neutral-900 hover:bg-red-50 focus-visible:ring-red-500',
          $props.class,
        )
      "
      @click="toggleOpen"
    >
      <CalendarIcon class="h-4 w-4" />
      <span>{{ displayLabel || placeholder }}</span>
    </Button>

    <Teleport to="body">
      <div
        v-if="open"
        id="date-picker-panel"
        :style="panelStyle"
        class="rounded-xl border border-neutral-200 bg-white p-0 shadow-md"
      >
        <Calendar :model-value="selectedDate" @select="onSelect" />
      </div>
    </Teleport>
  </div>
</template>
