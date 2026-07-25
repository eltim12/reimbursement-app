<script setup>
import { computed } from "vue";
import { Doughnut } from "vue-chartjs";
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from "chart.js";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";

ChartJS.register(ArcElement, Tooltip, Legend);

const props = defineProps({
  data: {
    type: Array,
    default: () => [],
  },
  class: {
    type: [String, Object, Array],
    default: "",
  },
  totalLabel: {
    type: String,
    default: "Total",
  },
});

const CHART_COLORS = [
  "oklch(0.646 0.222 41.116)",
  "oklch(0.6 0.118 184.704)",
  "oklch(0.398 0.07 227.392)",
  "oklch(0.828 0.189 84.429)",
  "oklch(0.769 0.188 70.08)",
  "oklch(0.488 0.243 264.376)",
  "oklch(0.627 0.265 303.9)",
  "oklch(0.645 0.246 16.439)",
  "oklch(0.55 0.05 250)",
];

const rows = computed(() =>
  (props.data || [])
    .filter((row) => Number(row.totalAmount) > 0)
    .map((row, index) => ({
      category: row.category || "(empty)",
      totalAmount: Number(row.totalAmount) || 0,
      entryCount: Number(row.entryCount) || 0,
      color: CHART_COLORS[index % CHART_COLORS.length],
    })),
);

const totalAmount = computed(() =>
  rows.value.reduce((sum, row) => sum + row.totalAmount, 0),
);

const chartData = computed(() => ({
  labels: rows.value.map((row) => row.category),
  datasets: [
    {
      data: rows.value.map((row) => row.totalAmount),
      backgroundColor: rows.value.map((row) => row.color),
      borderColor: "#ffffff",
      borderWidth: 3,
      hoverOffset: 4,
    },
  ],
}));

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: true,
  cutout: "62%",
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label(context) {
          const value = Number(context.raw) || 0;
          const pct = totalAmount.value
            ? ((value / totalAmount.value) * 100).toFixed(1)
            : "0.0";
          return ` ${formatCurrency(value, "IDR")} (${pct}%)`;
        },
      },
    },
  },
}));
</script>

<template>
  <div :class="cn('flex flex-col items-center gap-5', $props.class)">
    <div class="relative mx-auto aspect-square w-full max-w-[260px]">
      <Doughnut :data="chartData" :options="chartOptions" />
      <div
        class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
      >
        <div
          class="max-w-[9rem] truncate font-mono text-lg font-bold tracking-tight text-neutral-900 sm:text-xl"
        >
          {{ formatCurrency(totalAmount, "IDR") }}
        </div>
        <div class="mt-1 text-xs text-neutral-500">{{ totalLabel }}</div>
      </div>
    </div>

    <ul class="grid w-full gap-2 sm:grid-cols-2">
      <li
        v-for="row in rows"
        :key="row.category"
        class="flex items-start gap-2 text-sm"
      >
        <span
          class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
          :style="{ backgroundColor: row.color }"
        />
        <div class="min-w-0 flex-1">
          <div class="truncate font-medium text-neutral-900">
            {{ row.category }}
          </div>
          <div class="font-mono text-xs text-neutral-500">
            {{ formatCurrency(row.totalAmount, "IDR") }}
            <span class="text-neutral-400">({{ row.entryCount }})</span>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
