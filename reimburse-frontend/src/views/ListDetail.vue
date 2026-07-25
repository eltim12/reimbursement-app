<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, FileDown, FileSpreadsheet, Plus, Trash2, X } from "@lucide/vue";
import AppShell from "@/layouts/AppShell.vue";
import UploadImage from "@/components/UploadImage.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import DatePicker from "@/components/ui/DatePicker.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Input from "@/components/ui/Input.vue";
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
import {
  formatCurrency,
  parseCurrencyAmount,
} from "@/utils/formatters";
import { exportExcel } from "@/utils/excelExport";
import { exportPDF } from "@/utils/pdfExport";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { showToast } = useToast();

const currentUser = computed(() => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
});
const isReadOnly = computed(() => currentUser.value.role === "finance");

const currencyItems = computed(() => [
  { label: "IDR", value: "IDR" },
  { label: "RMB", value: "RMB" },
]);

const loading = ref(false);
const saving = ref(false);
const exporting = ref(false);
const exportingExcel = ref(false);
const showNameModal = ref(false);
const showEntryModal = ref(false);
const showDeleteEntryModal = ref(false);
const pendingDeleteIndex = ref(null);
const deletingEntry = ref(false);
const previewImageUrl = ref(null);
const newUserName = ref("");
const savingName = ref(false);
const currentListId = ref(null);
const currentListName = ref("");
const listOwnerName = ref("");
const listOwnerEmail = ref("");
const entries = ref([]);
const total = ref(0);

const emptyEntryForm = () => ({
  date: "",
  category: "",
  note: "",
  amount: "",
  currency: "IDR",
  proof: null,
});

const entryForm = ref(emptyEntryForm());

const openEntryModal = () => {
  if (isReadOnly.value) return;
  entryForm.value = emptyEntryForm();
  showEntryModal.value = true;
};

const closeEntryModal = () => {
  showEntryModal.value = false;
  entryForm.value = emptyEntryForm();
};

const currencyTotals = computed(() => {
  const totals = { IDR: 0, RMB: 0 };
  entries.value.forEach((entry) => {
    const curr = entry.Currency || "IDR";
    const amt = entry.Amount || 0;
    if (!totals[curr]) totals[curr] = 0;
    totals[curr] += amt;
  });
  return totals;
});

const getProofUrl = (proof) => {
  if (!proof) return null;

  const baseUrl = import.meta.env.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL.replace(/\/api\/?$/, "")
    : "https://reimburse-api.trimind.studio";

  if (typeof proof === "object" && proof !== null) {
    if (proof.url) {
      if (proof.url.startsWith("http")) return proof.url;
      return `${baseUrl}${proof.url.startsWith("/") ? proof.url : "/" + proof.url}`;
    }
    return proof.base64 || null;
  }

  if (typeof proof === "string") {
    if (proof.startsWith("data:image") || proof.startsWith("http")) return proof;
    return `${baseUrl}${proof.startsWith("/") ? proof : "/" + proof}`;
  }

  return null;
};

const openProofPreview = (proof) => {
  const url = getProofUrl(proof);
  if (url) previewImageUrl.value = url;
};

const formatAmountInput = (value) => {
  const currency = entryForm.value.currency;

  if (currency === "IDR") {
    const cleaned = String(value).replace(/[^\d]/g, "");
    const numeric = parseInt(cleaned, 10);
    entryForm.value.amount = !isNaN(numeric)
      ? numeric.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
      : "";
  } else {
    const cleaned = String(value).replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    entryForm.value.amount =
      parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : cleaned;
  }
};

const handleCurrencyChange = (value) => {
  entryForm.value.currency = value;
  entryForm.value.amount = "";
};

const loadList = async (id) => {
  if (!id) return;

  try {
    loading.value = true;
    const response = await api.getList(id);
    if (response.success) {
      const list = response.list;
      currentListId.value = list.id;
      currentListName.value = list.name;
      listOwnerName.value = list.ownerName || "";
      listOwnerEmail.value = list.ownerEmail || "";
      entries.value = (list.entries || []).sort(
        (a, b) => new Date(a.Date) - new Date(b.Date),
      );
      total.value = list.total || 0;
    }
  } catch {
    showToast(t("failedToLoadList"), "error");
    router.push("/");
  } finally {
    loading.value = false;
  }
};

const addEntry = async () => {
  if (isReadOnly.value) return;

  if (!currentListId.value) {
    showToast(t("pleaseCreateOrLoadList"), "error");
    return;
  }

  if (!entryForm.value.date) {
    showToast(t("pleaseSelectDate"), "error");
    return;
  }

  if (!entryForm.value.category?.trim()) {
    showToast(t("categoryPlaceholder"), "error");
    return;
  }

  const amount = parseCurrencyAmount(
    entryForm.value.amount,
    entryForm.value.currency,
  );
  if (isNaN(amount) || amount <= 0) {
    showToast(t("pleaseEnterValidAmount"), "error");
    return;
  }

  const previousEntries = [...entries.value];
  const previousTotal = total.value;

  try {
    saving.value = true;
    let proofUrl = null;
    const proofFile = entryForm.value.proof;

    if (proofFile && proofFile instanceof File) {
      try {
        const uploadResponse = await api.uploadImage(proofFile);
        if (uploadResponse.success) proofUrl = uploadResponse.url;
      } catch {
        showToast(t("failedToUploadImage"), "warning");
      }
    }

    const newEntry = {
      Date: entryForm.value.date,
      Category: entryForm.value.category,
      Note: entryForm.value.note,
      Amount: amount,
      Currency: entryForm.value.currency,
      Proof: proofUrl ? { url: proofUrl } : null,
    };

    entries.value.push(newEntry);
    entries.value.sort((a, b) => new Date(a.Date) - new Date(b.Date));
    total.value += amount;

    await api.updateList(currentListId.value, {
      entries: entries.value,
      total: total.value,
    });

    try {
      const res = await api.getList(currentListId.value);
      if (res.success) {
        entries.value = res.list.entries.sort(
          (a, b) => new Date(a.Date) - new Date(b.Date),
        );
        total.value = res.list.total || total.value;
      }
    } catch (e) {
      console.error("Failed to sync entries after adding", e);
    }

    entryForm.value = emptyEntryForm();
    showEntryModal.value = false;

    showToast(t("entryAdded"), "success");
  } catch (error) {
    entries.value = previousEntries;
    total.value = previousTotal;
    console.error("Error adding entry:", error);
    showToast(
      error.response?.data?.error || t("failedToAddEntry"),
      "error",
    );
  } finally {
    saving.value = false;
  }
};

const deleteEntryDetails = computed(() => {
  if (pendingDeleteIndex.value == null) return null;
  const entry = entries.value[pendingDeleteIndex.value];
  if (!entry) return null;
  const currency = entry.Currency || "IDR";
  return {
    date: entry.Date,
    category: entry.Category,
    amount: formatCurrency(entry.Amount, currency),
  };
});

const requestDeleteEntry = (index) => {
  if (isReadOnly.value) return;
  pendingDeleteIndex.value = index;
  showDeleteEntryModal.value = true;
};

const cancelDeleteEntry = () => {
  showDeleteEntryModal.value = false;
  pendingDeleteIndex.value = null;
};

const confirmDeleteEntry = async () => {
  const index = pendingDeleteIndex.value;
  if (index == null) return;

  const entry = entries.value[index];
  if (!entry) {
    cancelDeleteEntry();
    return;
  }

  try {
    deletingEntry.value = true;
    const removedAmount = entry.Amount;

    if (entry.id) {
      try {
        await api.deleteEntry(entry.id);
        entries.value.splice(index, 1);
        total.value -= removedAmount;
        await api.updateList(currentListId.value, { total: total.value });
        showToast(t("entryDeleted"), "success");
      } catch (error) {
        console.error("Error deleting entry from backend:", error);
        showToast(t("failedToDeleteEntry"), "error");
        return;
      }
    } else {
      entries.value.splice(index, 1);
      total.value -= removedAmount;
      await api.updateList(currentListId.value, {
        entries: entries.value,
        total: total.value,
      });

      try {
        const res = await api.getList(currentListId.value);
        if (res.success) {
          entries.value = res.list.entries.sort(
            (a, b) => new Date(a.Date) - new Date(b.Date),
          );
        }
      } catch (e) {
        console.error("Failed to sync entries after delete", e);
      }

      showToast(t("entryDeleted"), "success");
    }

    cancelDeleteEntry();
  } catch (error) {
    console.error("Error deleting entry:", error);
    showToast(t("failedToDeleteEntry"), "error");
  } finally {
    deletingEntry.value = false;
  }
};

const handleExportPDF = async () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userName = user.name || "";
  if (!userName.trim()) {
    showNameModal.value = true;
    return;
  }
  await executeExport(userName);
};

const submitNameAndExport = async () => {
  if (!newUserName.value.trim()) return;
  savingName.value = true;
  try {
    const response = await api.updateUserName(newUserName.value.trim());
    if (response.success) {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      user.name = response.name;
      localStorage.setItem("user", JSON.stringify(user));
      showNameModal.value = false;
      await executeExport(response.name);
    }
  } catch (err) {
    console.error("Error updating name:", err);
    showToast("Failed to update name", "error");
  } finally {
    savingName.value = false;
  }
};

const executeExport = async (userName) => {
  try {
    exporting.value = true;
    await exportPDF(
      currentListName.value,
      entries.value,
      total.value,
      userName,
    );
    showToast(t("pdfExported"), "success");
  } catch {
    showToast(t("pdfExportFailed"), "error");
  } finally {
    exporting.value = false;
  }
};

const handleExportExcel = async () => {
  try {
    exportingExcel.value = true;
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    await exportExcel(currentListName.value, entries.value, {
      userName: listOwnerName.value || user.name || "",
      userEmail: listOwnerEmail.value || user.email || "",
    });
    showToast(t("excelExported"), "success");
  } catch (error) {
    console.error("Excel export failed:", error);
    showToast(t("excelExportFailed"), "error");
  } finally {
    exportingExcel.value = false;
  }
};

watch(
  () => route.params.id,
  (id) => loadList(id),
  { immediate: false },
);

onMounted(() => loadList(route.params.id));
</script>

<template>
  <AppShell>
    <div class="space-y-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="space-y-2">
          <button
            type="button"
            class="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900"
            @click="router.push('/')"
          >
            <ArrowLeft class="h-4 w-4" />
            {{ t("backToLists") }}
          </button>
          <div>
            <h1 class="text-2xl font-semibold text-neutral-900">
              {{ currentListName || "—" }}
            </h1>
            <p class="font-mono text-sm text-neutral-500">
              #{{ currentListId || route.params.id }}
            </p>
          </div>
        </div>
        <div class="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[280px]">
          <div class="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              class="h-10 w-full"
              :loading="exporting"
              @click="handleExportPDF"
            >
              <FileDown class="h-4 w-4" />
              {{ t("exportPDF") }}
            </Button>
            <Button
              variant="outline"
              class="h-10 w-full"
              :loading="exportingExcel"
              @click="handleExportExcel"
            >
              <FileSpreadsheet class="h-4 w-4" />
              {{ t("exportExcel") }}
            </Button>
          </div>
          <Button
            v-if="!isReadOnly"
            class="h-10 w-full"
            @click="openEntryModal"
          >
            <Plus class="h-4 w-4" />
            {{ t("addNewEntry") }}
          </Button>
        </div>
      </div>

      <div class="space-y-3">
        <div class="flex items-end justify-between gap-3">
          <h2 class="text-base font-medium text-neutral-900">
            {{ t("entries") }}
          </h2>
          <div class="text-right text-sm">
            <div
              v-for="(amount, currency) in currencyTotals"
              :key="currency"
              class="font-mono"
              :class="amount > 0 ? 'text-neutral-900' : 'text-neutral-400'"
            >
              {{ t("total") }} ({{ currency }}):
              {{ formatCurrency(amount, currency) }}
            </div>
          </div>
        </div>

        <Card class="w-full overflow-hidden p-0">
          <div class="w-full overflow-x-auto">
            <table class="w-full min-w-max text-sm">
              <thead class="border-b border-neutral-200 bg-neutral-50">
                <tr class="text-left">
                  <th class="whitespace-nowrap px-4 py-3 font-medium text-neutral-500">
                    {{ t("tableNo") }}
                  </th>
                  <th class="whitespace-nowrap px-4 py-3 font-medium text-neutral-500">
                    {{ t("tableDate") }}
                  </th>
                  <th class="whitespace-nowrap px-4 py-3 font-medium text-neutral-500">
                    {{ t("tableCategory") }}
                  </th>
                  <th class="whitespace-nowrap px-4 py-3 font-medium text-neutral-500">
                    {{ t("tableNote") }}
                  </th>
                  <th class="whitespace-nowrap px-4 py-3 font-medium text-neutral-500">
                    {{ t("tableAmount") }}
                  </th>
                  <th class="whitespace-nowrap px-4 py-3 font-medium text-neutral-500">
                    {{ t("tableProof") }}
                  </th>
                  <th
                    v-if="!isReadOnly"
                    class="whitespace-nowrap px-4 py-3 text-right font-medium text-neutral-500"
                  >
                    {{ t("tableAction") }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loading">
                  <td
                    :colspan="isReadOnly ? 6 : 7"
                    class="px-4 py-8 text-center text-neutral-500"
                  >
                    Loading…
                  </td>
                </tr>
                <tr v-else-if="entries.length === 0">
                  <td
                    :colspan="isReadOnly ? 6 : 7"
                    class="px-4 py-8 text-center text-neutral-500"
                  >
                    {{ t("noEntries") }}
                  </td>
                </tr>
                <tr
                  v-for="(entry, idx) in entries"
                  :key="entry.id || idx"
                  class="border-b border-neutral-100 last:border-0"
                >
                  <td class="whitespace-nowrap px-4 py-3 font-mono text-neutral-500">
                    {{ idx + 1 }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3">{{ entry.Date }}</td>
                  <td class="whitespace-nowrap px-4 py-3 font-medium">
                    {{ entry.Category }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-neutral-600">
                    {{ entry.Note || "—" }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 font-mono">
                    {{ formatCurrency(entry.Amount, entry.Currency || "IDR") }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3">
                    <button
                      v-if="getProofUrl(entry.Proof)"
                      type="button"
                      class="block"
                      @click="openProofPreview(entry.Proof)"
                    >
                      <img
                        :src="getProofUrl(entry.Proof)"
                        :alt="t('tableProof')"
                        class="max-h-24 max-w-[120px] rounded-lg border border-neutral-200 object-cover transition-opacity hover:opacity-80"
                      />
                    </button>
                    <span v-else class="text-neutral-400">—</span>
                  </td>
                  <td
                    v-if="!isReadOnly"
                    class="whitespace-nowrap px-4 py-3 text-right"
                  >
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      class="text-red-600 hover:bg-red-50 hover:text-red-700"
                      @click="requestDeleteEntry(idx)"
                    >
                      <Trash2 class="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>

    <Dialog
      :open="showEntryModal"
      :title="t('addNewEntry')"
      class="max-w-2xl"
      actions-class="grid w-full grid-cols-2 gap-2"
      @update:open="(v) => (v ? openEntryModal() : closeEntryModal())"
    >
      <form id="entry-form" class="space-y-4" @submit.prevent="addEntry">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2 sm:col-span-2">
            <Label>{{ t("date") }}</Label>
            <DatePicker
              v-model="entryForm.date"
              :placeholder="t('pickDate')"
              required
            />
          </div>
          <div class="space-y-2 sm:col-span-2">
            <Label for="category">{{ t("category") }}</Label>
            <Input
              id="category"
              v-model="entryForm.category"
              :placeholder="t('categoryPlaceholder')"
              required
            />
          </div>
          <div class="space-y-2 sm:col-span-2">
            <Label for="note">
              {{ t("note") }}
              <span class="font-normal text-neutral-400"
                >({{ t("notePlaceholder") }})</span
              >
            </Label>
            <Input
              id="note"
              v-model="entryForm.note"
              :placeholder="t('notePlaceholder')"
            />
          </div>
          <div class="space-y-2">
            <Label>{{ t("currency") }}</Label>
            <Select
              :model-value="entryForm.currency"
              :items="currencyItems"
              :placeholder="t('currency')"
              @update:model-value="handleCurrencyChange"
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                    v-for="item in currencyItems"
                    :key="item.value"
                    :value="item.value"
                  >
                    {{ item.label }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="amount">{{ t("amount") }}</Label>
            <div class="relative">
              <span
                class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-neutral-400"
              >
                {{ entryForm.currency === "IDR" ? "Rp" : "¥" }}
              </span>
              <Input
                id="amount"
                :model-value="entryForm.amount"
                class="pl-9"
                inputmode="decimal"
                required
                @update:model-value="formatAmountInput"
              />
            </div>
          </div>
          <div class="min-w-0 space-y-2 sm:col-span-2">
            <Label>{{ t("tableProof") }}</Label>
            <UploadImage
              v-model="entryForm.proof"
              :multiple="false"
              :max-size="5 * 1024 * 1024"
              :hint="t('selectImage')"
              accept="image/*"
              :show-existing="false"
            />
          </div>
        </div>
      </form>
      <template #actions>
        <Button
          variant="outline"
          type="button"
          class="h-11 w-full"
          @click="closeEntryModal"
        >
          {{ t("cancel") }}
        </Button>
        <Button
          type="submit"
          form="entry-form"
          class="h-11 w-full"
          :loading="saving"
        >
          {{ t("addEntry") }}
        </Button>
      </template>
    </Dialog>

    <ConfirmDialog
      :open="showDeleteEntryModal"
      :title="t('areYouSureDeleteEntry')"
      :loading="deletingEntry"
      @update:open="(v) => !v && cancelDeleteEntry()"
      @confirm="confirmDeleteEntry"
      @cancel="cancelDeleteEntry"
    >
      <div v-if="deleteEntryDetails" class="space-y-2 text-sm">
        <div class="flex justify-between gap-4">
          <span class="text-neutral-500">{{ t("date") }}</span>
          <span class="font-medium">{{ deleteEntryDetails.date }}</span>
        </div>
        <div class="flex justify-between gap-4">
          <span class="text-neutral-500">{{ t("category") }}</span>
          <span class="font-medium">{{ deleteEntryDetails.category }}</span>
        </div>
        <div class="flex justify-between gap-4">
          <span class="text-neutral-500">{{ t("amount") }}</span>
          <span class="font-mono font-medium">{{
            deleteEntryDetails.amount
          }}</span>
        </div>
      </div>
    </ConfirmDialog>

    <Dialog
      :open="showNameModal"
      :title="t('fillNameTitle')"
      @update:open="showNameModal = $event"
    >
      <div class="space-y-2">
        <Label for="user-name">{{ t("name") }}</Label>
        <Input
          id="user-name"
          v-model="newUserName"
          :placeholder="t('fillNamePlaceholder')"
        />
      </div>
      <template #actions>
        <Button variant="outline" @click="showNameModal = false">
          {{ t("cancel") }}
        </Button>
        <Button
          :loading="savingName"
          :disabled="!newUserName.trim()"
          @click="submitNameAndExport"
        >
          {{ t("saveName") }}
        </Button>
      </template>
    </Dialog>

    <Teleport to="body">
      <div
        v-if="previewImageUrl"
        class="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
        @click.self="previewImageUrl = null"
      >
        <button
          type="button"
          class="absolute top-4 right-4 rounded-lg bg-white/90 p-2 text-neutral-900 hover:bg-white"
          @click="previewImageUrl = null"
        >
          <X class="h-5 w-5" />
        </button>
        <img
          :src="previewImageUrl"
          :alt="t('tableProof')"
          class="max-h-[90vh] max-w-full rounded-lg object-contain shadow-lg"
        />
      </div>
    </Teleport>
  </AppShell>
</template>
