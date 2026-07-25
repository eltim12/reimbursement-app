<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  FileDown,
  FileSpreadsheet,
  Filter,
  RotateCcw,
} from "@lucide/vue";
import AppShell from "@/layouts/AppShell.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import Combobox from "@/components/ui/Combobox.vue";
import DatePicker from "@/components/ui/DatePicker.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";
import SelectContent from "@/components/ui/SelectContent.vue";
import SelectGroup from "@/components/ui/SelectGroup.vue";
import SelectItem from "@/components/ui/SelectItem.vue";
import SelectTrigger from "@/components/ui/SelectTrigger.vue";
import SelectValue from "@/components/ui/SelectValue.vue";
import { useI18n } from "@/composables/useI18n";
import { useToast } from "@/composables/useToast";
import api from "@/services/api";
import { CATEGORIES } from "@/utils/categories";
import { exportAnalyticsExcel } from "@/utils/excelExport";
import { formatCurrency } from "@/utils/formatters";
import { exportAnalyticsPDF } from "@/utils/pdfExport";

const router = useRouter();
const { t, locale } = useI18n();
const { showToast } = useToast();

const currentUser = computed(() => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
});

const canAccess = computed(() =>
  ["management", "finance"].includes(currentUser.value.role),
);

const loading = ref(false);
const exportingPdf = ref(false);
const exportingExcel = ref(false);
const owners = ref([]);
const summary = ref({ totalAmount: 0, entryCount: 0, listCount: 0 });
const byCategory = ref([]);
const entries = ref([]);

const sortKey = ref("date");
const sortDir = ref("desc");

const filters = ref({
  category: "",
  dateFrom: "",
  dateTo: "",
  ownerId: "",
});

const categoryFilterItems = computed(() => [
  { value: "", label: t("filterAllCategories") },
  ...CATEGORIES.map((c) => ({
    value: c.value,
    label: locale.value === "zh" ? `${c.zh} / ${c.id}` : `${c.id} / ${c.zh}`,
    id: c.id,
    zh: c.zh,
  })),
]);

const ownerItems = computed(() => [
  { value: "", label: t("filterAllOwners") },
  ...owners.value.map((owner) => ({
    value: String(owner.id),
    label: owner.name
      ? `${owner.name} (${owner.email})`
      : owner.email,
  })),
]);

const maxCategoryTotal = computed(() =>
  Math.max(...byCategory.value.map((row) => row.totalAmount), 0),
);

const barWidth = (amount) => {
  if (!maxCategoryTotal.value) return "0%";
  return `${Math.max((amount / maxCategoryTotal.value) * 100, 2)}%`;
};

const sortedEntries = computed(() => {
  const rows = [...entries.value];
  const key = sortKey.value;
  const dir = sortDir.value === "asc" ? 1 : -1;

  rows.sort((a, b) => {
    let av;
    let bv;
    if (key === "amount") {
      av = Number(a.amount) || 0;
      bv = Number(b.amount) || 0;
      return (av - bv) * dir;
    }
    if (key === "date") {
      av = a.date || "";
      bv = b.date || "";
    } else if (key === "category") {
      av = (a.category || "").toLowerCase();
      bv = (b.category || "").toLowerCase();
    } else {
      av = "";
      bv = "";
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });

  return rows;
});

const filtersLabel = computed(() => {
  const parts = [];
  if (filters.value.category) parts.push(`${t("category")}: ${filters.value.category}`);
  if (filters.value.dateFrom) parts.push(`${t("filterDateFrom")}: ${filters.value.dateFrom}`);
  if (filters.value.dateTo) parts.push(`${t("filterDateTo")}: ${filters.value.dateTo}`);
  if (filters.value.ownerId) {
    const owner = owners.value.find(
      (item) => String(item.id) === String(filters.value.ownerId),
    );
    parts.push(
      `${t("filterOwner")}: ${owner?.name || owner?.email || filters.value.ownerId}`,
    );
  }
  return parts.length ? parts.join(" | ") : t("filterAllCategories");
});

const toggleSort = (key) => {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
  } else {
    sortKey.value = key;
    sortDir.value = key === "date" ? "desc" : "asc";
  }
};

const sortIcon = (key) => {
  if (sortKey.value !== key) return ArrowUpDown;
  return sortDir.value === "asc" ? ArrowUp : ArrowDown;
};

const loadAnalytics = async () => {
  if (!canAccess.value) {
    router.replace("/");
    return;
  }

  try {
    loading.value = true;
    const params = {};
    if (filters.value.category) params.category = filters.value.category;
    if (filters.value.dateFrom) params.dateFrom = filters.value.dateFrom;
    if (filters.value.dateTo) params.dateTo = filters.value.dateTo;
    if (filters.value.ownerId) params.ownerId = filters.value.ownerId;

    const response = await api.getAnalytics(params);
    if (!response.success) throw new Error("failed");

    summary.value = response.summary || {
      totalAmount: 0,
      entryCount: 0,
      listCount: 0,
    };
    byCategory.value = response.byCategory || [];
    entries.value = response.entries || [];
    owners.value = response.owners || [];
  } catch {
    showToast(t("failedToLoadAnalytics"), "error");
  } finally {
    loading.value = false;
  }
};

const resetFilters = async () => {
  filters.value = {
    category: "",
    dateFrom: "",
    dateTo: "",
    ownerId: "",
  };
  await loadAnalytics();
};

const exportMeta = () => ({
  title: t("analyticsTitle"),
  exportedBy:
    currentUser.value.name ||
    currentUser.value.email ||
    "",
  filtersLabel: filtersLabel.value,
});

const handleExportPDF = async () => {
  if (!sortedEntries.value.length) {
    showToast(t("noAnalyticsData"), "error");
    return;
  }
  try {
    exportingPdf.value = true;
    await exportAnalyticsPDF(sortedEntries.value, exportMeta());
    showToast(t("exportSuccess"), "success");
  } catch {
    showToast(t("exportFailed"), "error");
  } finally {
    exportingPdf.value = false;
  }
};

const handleExportExcel = async () => {
  if (!sortedEntries.value.length) {
    showToast(t("noAnalyticsData"), "error");
    return;
  }
  try {
    exportingExcel.value = true;
    await exportAnalyticsExcel(sortedEntries.value, exportMeta());
    showToast(t("exportSuccess"), "success");
  } catch {
    showToast(t("exportFailed"), "error");
  } finally {
    exportingExcel.value = false;
  }
};

onMounted(loadAnalytics);
</script>

<template>
  <AppShell>
    <div class="space-y-5">
      <div class="flex flex-col gap-1">
        <h1 class="text-2xl font-semibold text-neutral-900">
          {{ t("analyticsTitle") }}
        </h1>
        <p class="text-sm text-neutral-500">{{ t("analyticsSubtitle") }}</p>
      </div>

      <Card>
        <CardContent class="space-y-4 p-5">
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div class="space-y-2 sm:col-span-2">
              <Label>{{ t("filterCategory") }}</Label>
              <Combobox
                v-model="filters.category"
                :items="categoryFilterItems"
                :placeholder="t('filterAllCategories')"
                :search-placeholder="t('searchCategory')"
                :empty-text="t('noCategoryResults')"
              />
            </div>
            <div class="space-y-2">
              <Label>{{ t("filterDateFrom") }}</Label>
              <DatePicker
                v-model="filters.dateFrom"
                :placeholder="t('pickDate')"
              />
            </div>
            <div class="space-y-2">
              <Label>{{ t("filterDateTo") }}</Label>
              <DatePicker
                v-model="filters.dateTo"
                :placeholder="t('pickDate')"
              />
            </div>
            <div class="space-y-2 sm:col-span-2 lg:col-span-4">
              <Label>{{ t("filterOwner") }}</Label>
              <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div class="min-w-0 flex-1">
                  <Select
                    :model-value="filters.ownerId"
                    :items="ownerItems"
                    :placeholder="t('filterAllOwners')"
                    @update:model-value="(v) => (filters.ownerId = v ?? '')"
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem
                          v-for="item in ownerItems"
                          :key="item.value || 'all'"
                          :value="item.value"
                        >
                          {{ item.label }}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div class="grid shrink-0 grid-cols-2 gap-2 sm:w-[280px]">
                  <Button
                    variant="outline"
                    class="h-11"
                    :loading="exportingPdf"
                    :disabled="!sortedEntries.length"
                    @click="handleExportPDF"
                  >
                    <FileDown class="h-4 w-4" />
                    {{ t("exportPDF") }}
                  </Button>
                  <Button
                    variant="outline"
                    class="h-11"
                    :loading="exportingExcel"
                    :disabled="!sortedEntries.length"
                    @click="handleExportExcel"
                  >
                    <FileSpreadsheet class="h-4 w-4" />
                    {{ t("exportExcel") }}
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-2 sm:flex-row">
            <Button class="h-11" :loading="loading" @click="loadAnalytics">
              <Filter class="h-4 w-4" />
              {{ t("applyFilters") }}
            </Button>
            <Button
              variant="outline"
              class="h-11"
              :disabled="loading"
              @click="resetFilters"
            >
              <RotateCcw class="h-4 w-4" />
              {{ t("resetFilters") }}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div class="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent class="p-5">
            <div class="text-xs text-neutral-500">
              {{ t("analyticsTotalAmount") }}
            </div>
            <div class="mt-1 font-mono text-xl font-semibold">
              {{ formatCurrency(summary.totalAmount, "IDR") }}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent class="p-5">
            <div class="text-xs text-neutral-500">
              {{ t("analyticsEntryCount") }}
            </div>
            <div class="mt-1 font-mono text-xl font-semibold">
              {{ summary.entryCount }}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent class="p-5">
            <div class="text-xs text-neutral-500">
              {{ t("analyticsListCount") }}
            </div>
            <div class="mt-1 font-mono text-xl font-semibold">
              {{ summary.listCount }}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent class="space-y-4 p-5">
          <div class="flex items-center gap-2">
            <BarChart3 class="h-4 w-4 text-neutral-700" />
            <h2 class="text-base font-medium text-neutral-900">
              {{ t("analyticsByCategory") }}
            </h2>
          </div>
          <div v-if="loading" class="py-8 text-center text-sm text-neutral-500">
            Loading…
          </div>
          <div
            v-else-if="byCategory.length === 0"
            class="py-8 text-center text-sm text-neutral-500"
          >
            {{ t("noAnalyticsData") }}
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="row in byCategory"
              :key="row.category"
              class="space-y-1.5"
            >
              <div class="flex items-start justify-between gap-3 text-sm">
                <div class="min-w-0 flex-1 font-medium text-neutral-900">
                  {{ row.category }}
                </div>
                <div class="shrink-0 text-right font-mono text-neutral-700">
                  {{ formatCurrency(row.totalAmount, "IDR") }}
                  <span class="ml-2 text-xs text-neutral-400"
                    >({{ row.entryCount }})</span
                  >
                </div>
              </div>
              <div class="h-2 overflow-hidden rounded-full bg-neutral-100">
                <div
                  class="h-full rounded-full bg-neutral-900 transition-all"
                  :style="{ width: barWidth(row.totalAmount) }"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div class="space-y-3">
        <h2 class="text-base font-medium text-neutral-900">
          {{ t("analyticsEntries") }}
        </h2>
        <Card class="overflow-hidden p-0">
          <div class="overflow-x-auto">
            <table class="w-full min-w-max text-sm">
              <thead class="border-b border-neutral-200 bg-neutral-50">
                <tr class="text-left">
                  <th class="whitespace-nowrap px-4 py-3 font-medium text-neutral-500">
                    <button
                      type="button"
                      class="inline-flex items-center gap-1 hover:text-neutral-900"
                      @click="toggleSort('date')"
                    >
                      {{ t("date") }}
                      <component :is="sortIcon('date')" class="h-3.5 w-3.5" />
                    </button>
                  </th>
                  <th class="whitespace-nowrap px-4 py-3 font-medium text-neutral-500">
                    <button
                      type="button"
                      class="inline-flex items-center gap-1 hover:text-neutral-900"
                      @click="toggleSort('category')"
                    >
                      {{ t("category") }}
                      <component
                        :is="sortIcon('category')"
                        class="h-3.5 w-3.5"
                      />
                    </button>
                  </th>
                  <th class="whitespace-nowrap px-4 py-3 font-medium text-neutral-500">
                    {{ t("note") }}
                  </th>
                  <th class="whitespace-nowrap px-4 py-3 font-medium text-neutral-500">
                    <button
                      type="button"
                      class="inline-flex items-center gap-1 hover:text-neutral-900"
                      @click="toggleSort('amount')"
                    >
                      {{ t("amount") }}
                      <component :is="sortIcon('amount')" class="h-3.5 w-3.5" />
                    </button>
                  </th>
                  <th class="whitespace-nowrap px-4 py-3 font-medium text-neutral-500">
                    {{ t("currentList") }}
                  </th>
                  <th class="whitespace-nowrap px-4 py-3 font-medium text-neutral-500">
                    {{ t("listOwner") }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loading">
                  <td colspan="6" class="px-4 py-8 text-center text-neutral-500">
                    Loading…
                  </td>
                </tr>
                <tr v-else-if="sortedEntries.length === 0">
                  <td colspan="6" class="px-4 py-8 text-center text-neutral-500">
                    {{ t("noAnalyticsData") }}
                  </td>
                </tr>
                <tr
                  v-for="entry in sortedEntries"
                  :key="entry.id"
                  class="cursor-pointer border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
                  @click="router.push(`/lists/${entry.listId}`)"
                >
                  <td class="whitespace-nowrap px-4 py-3 font-mono">
                    {{ entry.date }}
                  </td>
                  <td class="max-w-xs px-4 py-3 font-medium">
                    {{ entry.category }}
                  </td>
                  <td class="max-w-xs truncate px-4 py-3 text-neutral-600">
                    {{ entry.note || "—" }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 font-mono">
                    {{ formatCurrency(entry.amount, "IDR") }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3">
                    {{ entry.listName }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-neutral-600">
                    <div class="font-medium text-neutral-900">
                      {{ entry.ownerName || "—" }}
                    </div>
                    <div class="text-xs text-neutral-500">
                      {{ entry.ownerEmail }}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  </AppShell>
</template>
