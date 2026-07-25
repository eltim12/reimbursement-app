<script setup>
import { useI18n } from "@/composables/useI18n";
import { cn } from "@/lib/utils";

const { locale, setLocale } = useI18n();
</script>

<template>
  <div
    class="inline-flex h-7 items-center rounded-md border border-neutral-200 bg-neutral-50 p-0.5"
  >
    <button
      type="button"
      :class="
        cn(
          'rounded px-2 text-xs font-medium transition-colors',
          locale === 'en'
            ? 'bg-white text-neutral-900 shadow-sm'
            : 'text-neutral-500 hover:text-neutral-900',
        )
      "
      @click="setLocale('en')"
    >
      ID
    </button>
    <button
      type="button"
      :class="
        cn(
          'rounded px-2 text-xs font-medium transition-colors',
          locale === 'zh'
            ? 'bg-white text-neutral-900 shadow-sm'
            : 'text-neutral-500 hover:text-neutral-900',
        )
      "
      @click="setLocale('zh')"
    >
      中文
    </button>
  </div>
</template>
