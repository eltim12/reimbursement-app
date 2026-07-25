<script setup>
import { computed, ref, watch } from "vue";
import { ChevronLeft, ChevronRight } from "@lucide/vue";
import Button from "@/components/ui/Button.vue";
import { cn } from "@/lib/utils";

const props = defineProps({
  modelValue: {
    type: Date,
    default: null,
  },
  class: {
    type: [String, Object, Array],
    default: "",
  },
});

const emit = defineEmits(["update:modelValue", "select"]);

const viewDate = ref(
  props.modelValue
    ? new Date(props.modelValue.getFullYear(), props.modelValue.getMonth(), 1)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1),
);

watch(
  () => props.modelValue,
  (value) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      viewDate.value = new Date(value.getFullYear(), value.getMonth(), 1);
    }
  },
);

const monthLabel = computed(() =>
  viewDate.value.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  }),
);

const weekdayLabels = computed(() => {
  const base = new Date(2024, 0, 7); // Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return d.toLocaleDateString(undefined, { weekday: "short" });
  });
});

const days = computed(() => {
  const year = viewDate.value.getFullYear();
  const month = viewDate.value.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push({
      date: new Date(year, month - 1, prevMonthDays - i),
      outside: true,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      date: new Date(year, month, day),
      outside: false,
    });
  }

  while (cells.length % 7 !== 0) {
    const nextDay = cells.length - (startOffset + daysInMonth) + 1;
    cells.push({
      date: new Date(year, month + 1, nextDay),
      outside: true,
    });
  }

  return cells;
});

const isSameDay = (a, b) =>
  a &&
  b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const isToday = (date) => isSameDay(date, new Date());

const prevMonth = () => {
  viewDate.value = new Date(
    viewDate.value.getFullYear(),
    viewDate.value.getMonth() - 1,
    1,
  );
};

const nextMonth = () => {
  viewDate.value = new Date(
    viewDate.value.getFullYear(),
    viewDate.value.getMonth() + 1,
    1,
  );
};

const selectDay = (day) => {
  if (day.outside) {
    viewDate.value = new Date(day.date.getFullYear(), day.date.getMonth(), 1);
  }
  emit("update:modelValue", day.date);
  emit("select", day.date);
};
</script>

<template>
  <div :class="cn('w-[280px] p-3', $props.class)">
    <div class="mb-3 flex items-center justify-between">
      <Button variant="outline" size="icon-sm" type="button" @click="prevMonth">
        <ChevronLeft class="h-4 w-4" />
      </Button>
      <div class="text-sm font-medium">{{ monthLabel }}</div>
      <Button variant="outline" size="icon-sm" type="button" @click="nextMonth">
        <ChevronRight class="h-4 w-4" />
      </Button>
    </div>

    <div class="mb-1 grid grid-cols-7 gap-1">
      <div
        v-for="label in weekdayLabels"
        :key="label"
        class="py-1 text-center text-[0.7rem] font-medium text-neutral-500"
      >
        {{ label }}
      </div>
    </div>

    <div class="grid grid-cols-7 gap-1">
      <button
        v-for="day in days"
        :key="day.date.toISOString()"
        type="button"
        :class="
          cn(
            'flex h-9 w-9 items-center justify-center rounded-md text-sm transition-colors',
            day.outside && 'text-neutral-300',
            !day.outside && 'hover:bg-neutral-100',
            isToday(day.date) && !isSameDay(day.date, modelValue) && 'border border-neutral-200',
            isSameDay(day.date, modelValue) &&
              'bg-neutral-900 text-white hover:bg-neutral-800',
          )
        "
        @click="selectDay(day)"
      >
        {{ day.date.getDate() }}
      </button>
    </div>
  </div>
</template>
