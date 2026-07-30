import { computed, ref } from "vue";
import api from "@/services/api";
import { useI18n } from "@/composables/useI18n";

const companies = ref([]);
const loaded = ref(false);
const loading = ref(false);
let loadPromise = null;

async function loadCompanies(force = false) {
  if (loaded.value && !force) return companies.value;
  if (loadPromise && !force) return loadPromise;

  loading.value = true;
  loadPromise = (async () => {
    try {
      const response = await api.getCompanies();
      if (response.success && Array.isArray(response.companies)) {
        companies.value = response.companies;
        loaded.value = true;
      }
    } catch (error) {
      console.error("Failed to load companies:", error);
    } finally {
      loading.value = false;
      loadPromise = null;
    }
    return companies.value;
  })();

  return loadPromise;
}

export function useCompanies() {
  const { t } = useI18n();

  const companyFilterItems = computed(() => [
    { value: "", label: t("filterAllCompanies") },
    ...companies.value.map((c) => ({
      value: String(c.id),
      label: c.name,
    })),
  ]);

  return {
    companies,
    companyFilterItems,
    loading,
    loaded,
    loadCompanies,
  };
}
