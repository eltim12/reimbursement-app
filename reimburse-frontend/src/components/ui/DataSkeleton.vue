<script setup>
import Skeleton from "./Skeleton.vue";

defineProps({
  /** Number of placeholder rows */
  rows: {
    type: Number,
    default: 5,
  },
  /** Number of columns for table-style skeleton */
  cols: {
    type: Number,
    default: 4,
  },
  /** card = stacked cards (mobile), table = row bars */
  variant: {
    type: String,
    default: "table", // table | cards
  },
});
</script>

<template>
  <div v-if="variant === 'cards'" class="space-y-3">
    <div
      v-for="i in rows"
      :key="i"
      class="space-y-3 rounded-xl border border-neutral-200 bg-white p-4"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1 space-y-2">
          <Skeleton class="h-4 w-2/3" />
          <Skeleton class="h-3 w-1/2" />
          <Skeleton class="h-3 w-1/3" />
        </div>
        <Skeleton class="size-8 shrink-0 rounded-full" />
      </div>
      <Skeleton class="h-3 w-full" />
    </div>
  </div>
  <div v-else class="space-y-0 overflow-hidden rounded-xl border border-neutral-200 bg-white">
    <div class="flex gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-3">
      <Skeleton
        v-for="c in cols"
        :key="`h-${c}`"
        class="h-3 flex-1"
      />
    </div>
    <div
      v-for="i in rows"
      :key="i"
      class="flex gap-3 border-b border-neutral-100 px-4 py-3 last:border-0"
    >
      <Skeleton
        v-for="c in cols"
        :key="`${i}-${c}`"
        class="h-4 flex-1"
        :class="c === 1 ? 'max-w-[8rem]' : ''"
      />
    </div>
  </div>
</template>
