<script setup>
import { computed } from "vue";
import Button from "./Button.vue";
import { useI18n } from "@/composables/useI18n";

const props = defineProps({
  page: { type: Number, required: true },
  pageSize: { type: Number, required: true },
  total: { type: Number, required: true },
  loading: Boolean,
  label: { type: String, default: "" },
});

const emit = defineEmits(["update:page"]);
const { t } = useI18n();

const pages = computed(() =>
  Math.max(1, Math.ceil((props.total || 0) / props.pageSize) || 1),
);
const start = computed(() =>
  props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1,
);
const end = computed(() =>
  props.total === 0 ? 0 : Math.min(props.total, props.page * props.pageSize),
);

const fill = (key, values) =>
  Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    t(key),
  );

const go = (next) => {
  if (props.loading) return;
  const page = Math.min(pages.value, Math.max(1, next));
  if (page !== props.page) emit("update:page", page);
};
</script>

<template>
  <nav
    class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
    :aria-label="label || t('listsPagination')"
  >
    <p class="text-sm text-neutral-500" role="status">
      {{ fill("listsRange", { start, end, total }) }}
    </p>
    <div class="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        :disabled="loading || page <= 1"
        @click="go(page - 1)"
      >
        {{ t("previous") }}
      </Button>
      <span class="font-mono text-sm text-neutral-600">
        {{ fill("listsPage", { page, pages }) }}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        :disabled="loading || page >= pages"
        @click="go(page + 1)"
      >
        {{ t("next") }}
      </Button>
    </div>
  </nav>
</template>
