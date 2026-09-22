<script setup>
import { useI18n } from "@/composables/useI18n";
import { cn } from "@/lib/utils";

const { locale, setLocale } = useI18n();
</script>

<template>
  <div
    role="group"
    aria-label="Language"
    class="inline-flex h-9 shrink-0 items-center rounded-lg border border-neutral-200 bg-neutral-100/80 p-0.5"
  >
    <button
      type="button"
      :aria-pressed="locale === 'en'"
      :class="
        cn(
          'inline-flex h-8 min-w-[2.75rem] items-center justify-center rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-colors',
          locale === 'en'
            ? 'bg-white text-neutral-900 shadow-sm'
            : 'text-neutral-500 hover:text-neutral-800',
        )
      "
      @click="setLocale('en')"
    >
      ID
    </button>
    <button
      type="button"
      :aria-pressed="locale === 'zh'"
      :class="
        cn(
          'inline-flex h-8 min-w-[2.75rem] items-center justify-center rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-colors',
          locale === 'zh'
            ? 'bg-white text-neutral-900 shadow-sm'
            : 'text-neutral-500 hover:text-neutral-800',
        )
      "
      @click="setLocale('zh')"
    >
      中文
    </button>
  </div>
</template>
