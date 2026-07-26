import { computed, ref } from "vue";
import api from "@/services/api";
import {
  DEFAULT_CATEGORIES,
  getCategoryLabel as formatCategoryLabel,
  isKnownCategory as checkKnownCategory,
  normalizeCategory,
} from "@/utils/categories";
import { useI18n } from "@/composables/useI18n";

const categories = ref(DEFAULT_CATEGORIES.map(normalizeCategory));
const loaded = ref(false);
const loading = ref(false);
let loadPromise = null;

async function loadCategories(force = false) {
  if (loaded.value && !force) return categories.value;
  if (loadPromise && !force) return loadPromise;

  loading.value = true;
  loadPromise = (async () => {
    try {
      const response = await api.getCategories();
      if (response.success && Array.isArray(response.categories)) {
        categories.value = response.categories.map(normalizeCategory);
        loaded.value = true;
      }
    } catch (error) {
      console.error("Failed to load categories:", error);
      if (!loaded.value) {
        categories.value = DEFAULT_CATEGORIES.map(normalizeCategory);
      }
    } finally {
      loading.value = false;
      loadPromise = null;
    }
    return categories.value;
  })();

  return loadPromise;
}

export function useCategories() {
  const { locale } = useI18n();

  const categoryItems = computed(() =>
    categories.value.map((c) => ({
      value: c.value,
      label: locale.value === "zh" ? c.name_zh : c.name_id,
      id: c.name_id,
      zh: c.name_zh,
    })),
  );

  const getCategoryLabel = (category) =>
    formatCategoryLabel(category, locale.value, categories.value);

  const isKnownCategory = (category) =>
    checkKnownCategory(category, categories.value);

  return {
    categories,
    categoryItems,
    loading,
    loaded,
    loadCategories,
    getCategoryLabel,
    isKnownCategory,
  };
}
