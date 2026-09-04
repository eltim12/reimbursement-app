<script setup>
import { computed, onMounted, ref, watch } from "vue";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  ListFilter,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from "@lucide/vue";
import AppShell from "@/layouts/AppShell.vue";
import UploadImage from "@/components/UploadImage.vue";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import Combobox from "@/components/ui/Combobox.vue";
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
import { useCompanies } from "@/composables/useCompanies";
import { useI18n } from "@/composables/useI18n";
import { useToast } from "@/composables/useToast";
import api from "@/services/api";
import { translateBilingualZhId } from "@/utils/translator";
import { getUnitLabel, purchasingUnitItems } from "@/utils/units";
import { cn } from "@/lib/utils";

const { t, locale } = useI18n();
const { showToast } = useToast();
const { companyFilterItems, loadCompanies } = useCompanies();

const currentUser = computed(() => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
});

const isSuperadmin = computed(() => currentUser.value.role === "superadmin");
const canFullEdit = computed(() => {
  const u = currentUser.value;
  if (u.role === "superadmin") return true;
  if (u.role === "finance" || u.role === "management") return true;
  return !!u.purchasing_editor;
});

const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const requests = ref([]);
const companyFilter = ref("");

const filters = ref({
  search: "",
  category: "",
  urgency: "",
  status: "",
  requestorId: "",
  dateFrom: "",
  dateTo: "",
});

const sortKey = ref("request_date");
const sortDir = ref("desc");

const showFormModal = ref(false);
const showDetailModal = ref(false);
const showDeleteModal = ref(false);
const showFilterModal = ref(false);
const editingId = ref(null);
const detailItem = ref(null);
const pendingDelete = ref(null);
const formMode = ref("create"); // create | edit
const translatingName = ref(false);
const translatingNote = ref(false);

const form = ref(emptyForm());
const existingPicture = ref([]);
const existingReceivedProof = ref([]);

const activeFilterCount = computed(() => {
  let n = 0;
  if (filters.value.category) n += 1;
  if (filters.value.urgency) n += 1;
  if (filters.value.status) n += 1;
  if (filters.value.requestorId) n += 1;
  if (filters.value.dateFrom) n += 1;
  if (filters.value.dateTo) n += 1;
  if (isSuperadmin.value && companyFilter.value) n += 1;
  return n;
});

async function bilingualizeField(field) {
  const raw = String(form.value[field] || "").trim();
  if (!raw) return;
  const flag = field === "item_name" ? translatingName : translatingNote;
  flag.value = true;
  try {
    form.value[field] = await translateBilingualZhId(raw);
  } finally {
    flag.value = false;
  }
}

function emptyForm() {
  return {
    item_name: "",
    quantity: 1,
    unit: "pcs",
    note: "",
    pictureFile: null,
    urgency: "medium",
    status: "pending",
    category: "office",
    received_note: "",
    receivedProofFile: null,
  };
}

const categoryItems = computed(() => [
  { value: "office", label: t("purchasingCatOffice") },
  { value: "production", label: t("purchasingCatProduction") },
]);

const unitItems = computed(() => purchasingUnitItems(locale.value));

const urgencyItems = computed(() => [
  { value: "low", label: t("urgencyLow") },
  { value: "medium", label: t("urgencyMedium") },
  { value: "high", label: t("urgencyHigh") },
]);

const statusItems = computed(() => [
  { value: "pending", label: t("statusPending") },
  { value: "approved", label: t("statusApproved") },
  { value: "ordered", label: t("statusOrdered") },
  { value: "received", label: t("statusReceived") },
  { value: "rejected", label: t("statusRejected") },
]);

const filterCategoryItems = computed(() => [
  { value: "", label: t("filterAll") },
  ...categoryItems.value,
]);
const filterUrgencyItems = computed(() => [
  { value: "", label: t("filterAll") },
  ...urgencyItems.value,
]);
const filterStatusItems = computed(() => [
  { value: "", label: t("filterAll") },
  ...statusItems.value,
]);

const requestorItems = computed(() => {
  const map = new Map();
  for (const row of requests.value) {
    if (!map.has(row.requestor_id)) {
      map.set(row.requestor_id, {
        value: String(row.requestor_id),
        label: row.requestor_name || row.requestor_email || `#${row.requestor_id}`,
      });
    }
  }
  return [
    { value: "", label: t("filterAllRequestors") },
    ...Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label)),
  ];
});

const getImageUrl = (path) => {
  if (!path) return null;
  const baseUrl = import.meta.env.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL.replace(/\/api\/?$/, "")
    : "";
  if (typeof path === "object" && path?.url) {
    const url = path.url;
    if (url.startsWith("http")) return url;
    return `${baseUrl}${url.startsWith("/") ? url : `/${url}`}`;
  }
  if (typeof path === "string") {
    if (path.startsWith("http") || path.startsWith("data:")) return path;
    return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  }
  return null;
};

const previewImageUrl = ref(null);

const openImagePreview = (path) => {
  const url = getImageUrl(path);
  if (url) previewImageUrl.value = url;
};

const labelCategory = (v) =>
  categoryItems.value.find((i) => i.value === v)?.label || v;
const labelUnit = (v) => getUnitLabel(v, locale.value) || v || "pcs";
const labelUrgency = (v) =>
  urgencyItems.value.find((i) => i.value === v)?.label || v;
const labelStatus = (v) =>
  statusItems.value.find((i) => i.value === v)?.label || v;

const formatQtyUnit = (row) =>
  `${row.quantity} ${labelUnit(row.unit)}`;

const urgencyBadgeClass = (urgency) => {
  switch (urgency) {
    case "high":
      return "border-transparent bg-red-100 text-red-800";
    case "medium":
      return "border-transparent bg-amber-100 text-amber-800";
    case "low":
      return "border-transparent bg-emerald-100 text-emerald-800";
    default:
      return "border-transparent bg-neutral-100 text-neutral-700";
  }
};

const statusBadgeClass = (status) => {
  switch (status) {
    case "pending":
      return "border-transparent bg-neutral-100 text-neutral-700";
    case "approved":
      return "border-transparent bg-sky-100 text-sky-800";
    case "ordered":
      return "border-transparent bg-violet-100 text-violet-800";
    case "received":
      return "border-transparent bg-emerald-100 text-emerald-800";
    case "rejected":
      return "border-transparent bg-red-100 text-red-800";
    default:
      return "border-transparent bg-neutral-100 text-neutral-700";
  }
};

const savingDetailStatus = ref(false);
const detailStatus = ref("pending");
const detailReceivedNote = ref("");
const detailReceivedProofFile = ref(null);
const detailExistingReceivedProof = ref([]);

const formatDateTime = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(
      locale.value === "zh" ? "zh-CN" : "id-ID",
    );
  } catch {
    return String(value);
  }
};

const canEditRow = (row) => {
  if (!row || row.status === "received") return false;
  if (canFullEdit.value) return true;
  return (
    row.requestor_id === currentUser.value.id && row.status === "pending"
  );
};

const canManageStatus = computed(() => canFullEdit.value);

const statusEditMode = ref(false);

const sortedRows = computed(() => {
  const rows = [...requests.value];
  const key = sortKey.value;
  const dir = sortDir.value === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    let av = a[key];
    let bv = b[key];
    if (key === "quantity") {
      av = Number(av) || 0;
      bv = Number(bv) || 0;
      return (av - bv) * dir;
    }
    if (key === "requestor_name") {
      av = (a.requestor_name || "").toLowerCase();
      bv = (b.requestor_name || "").toLowerCase();
    } else {
      av = av == null ? "" : String(av).toLowerCase();
      bv = bv == null ? "" : String(bv).toLowerCase();
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
  return rows;
});

const toggleSort = (key) => {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
  } else {
    sortKey.value = key;
    sortDir.value = key === "request_date" ? "desc" : "asc";
  }
};

const sortIcon = (key) => {
  if (sortKey.value !== key) return ArrowUpDown;
  return sortDir.value === "asc" ? ArrowUp : ArrowDown;
};

const syncUserFlags = async () => {
  try {
    const response = await api.getProfile();
    if (response.success) {
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem(
        "user",
        JSON.stringify({
          ...stored,
          ...response.user,
        }),
      );
    }
  } catch {
    /* ignore */
  }
};

const load = async () => {
  try {
    loading.value = true;
    const params = {};
    if (isSuperadmin.value && companyFilter.value) {
      params.companyId = companyFilter.value;
    }
    if (filters.value.search.trim()) params.search = filters.value.search.trim();
    if (filters.value.category) params.category = filters.value.category;
    if (filters.value.urgency) params.urgency = filters.value.urgency;
    if (filters.value.status) params.status = filters.value.status;
    if (filters.value.requestorId)
      params.requestorId = filters.value.requestorId;
    if (filters.value.dateFrom) params.dateFrom = filters.value.dateFrom;
    if (filters.value.dateTo) params.dateTo = filters.value.dateTo;

    const response = await api.getPurchasing(params);
    if (response.success) {
      requests.value = response.requests || [];
    }
  } catch (error) {
    showToast(
      error.response?.data?.error || t("failedToLoadPurchasing"),
      "error",
    );
  } finally {
    loading.value = false;
  }
};

const resetFilters = async () => {
  filters.value = {
    search: "",
    category: "",
    urgency: "",
    status: "",
    requestorId: "",
    dateFrom: "",
    dateTo: "",
  };
  if (isSuperadmin.value) companyFilter.value = "";
  showFilterModal.value = false;
  await load();
};

const applyFiltersFromModal = async () => {
  showFilterModal.value = false;
  await load();
};

const openCreate = () => {
  formMode.value = "create";
  editingId.value = null;
  form.value = emptyForm();
  existingPicture.value = [];
  existingReceivedProof.value = [];
  showFormModal.value = true;
};

const openEdit = (row) => {
  if (row.status === "received") {
    openDetail(row);
    return;
  }
  formMode.value = "edit";
  editingId.value = row.id;
  form.value = {
    item_name: row.item_name,
    quantity: row.quantity,
    unit: row.unit || "pcs",
    note: row.note || "",
    pictureFile: null,
    urgency: row.urgency,
    status: row.status,
    category: row.category,
    received_note: row.received_note || "",
    receivedProofFile: null,
  };
  existingPicture.value = row.picture
    ? [{ url: getImageUrl(row.picture) }]
    : [];
  existingReceivedProof.value = row.received_proof_image
    ? [{ url: getImageUrl(row.received_proof_image) }]
    : [];
  showDetailModal.value = false;
  showFormModal.value = true;
};

const openDetail = (row) => {
  detailItem.value = row;
  detailStatus.value = row.status;
  detailReceivedNote.value = row.received_note || "";
  detailReceivedProofFile.value = null;
  detailExistingReceivedProof.value = row.received_proof_image
    ? [{ url: getImageUrl(row.received_proof_image) }]
    : [];
  // Received items open in display mode; others open ready to update status
  statusEditMode.value = canFullEdit.value && row.status !== "received";
  showDetailModal.value = true;
};

const startStatusEdit = () => {
  if (!detailItem.value) return;
  detailStatus.value = detailItem.value.status;
  detailReceivedNote.value = detailItem.value.received_note || "";
  detailReceivedProofFile.value = null;
  detailExistingReceivedProof.value = detailItem.value.received_proof_image
    ? [{ url: getImageUrl(detailItem.value.received_proof_image) }]
    : [];
  statusEditMode.value = true;
};

const cancelStatusEdit = () => {
  if (!detailItem.value) return;
  detailStatus.value = detailItem.value.status;
  detailReceivedNote.value = detailItem.value.received_note || "";
  detailReceivedProofFile.value = null;
  detailExistingReceivedProof.value = detailItem.value.received_proof_image
    ? [{ url: getImageUrl(detailItem.value.received_proof_image) }]
    : [];
  statusEditMode.value =
    canFullEdit.value && detailItem.value.status !== "received";
};

const saveDetailStatus = async () => {
  if (!detailItem.value || !canFullEdit.value) return;

  if (detailStatus.value === "received") {
    const hasNewProof = detailReceivedProofFile.value instanceof File;
    const hasExisting = detailExistingReceivedProof.value.length > 0;
    if (!hasNewProof && !hasExisting) {
      showToast(t("receivedProofRequired"), "error");
      return;
    }
    if (!String(detailReceivedNote.value || "").trim()) {
      showToast(t("receivedNoteRequired"), "error");
      return;
    }
  }

  try {
    savingDetailStatus.value = true;
    const payload = {
      item_name: detailItem.value.item_name,
      quantity: detailItem.value.quantity,
      unit: detailItem.value.unit || "pcs",
      note: detailItem.value.note || "",
      picture: detailItem.value.picture || null,
      urgency: detailItem.value.urgency,
      category: detailItem.value.category,
      status: detailStatus.value,
      received_note: detailReceivedNote.value.trim(),
    };

    if (detailReceivedProofFile.value instanceof File) {
      const up = await api.uploadImage(detailReceivedProofFile.value);
      if (!up.success) throw new Error("upload failed");
      payload.received_proof_image = up.url;
    } else if (detailExistingReceivedProof.value.length) {
      payload.received_proof_image =
        detailItem.value.received_proof_image || null;
    } else {
      payload.received_proof_image = null;
    }

    const response = await api.updatePurchasing(detailItem.value.id, payload);
    if (response.success) {
      detailItem.value = response.request;
      detailStatus.value = response.request.status;
      detailReceivedNote.value = response.request.received_note || "";
      detailReceivedProofFile.value = null;
      detailExistingReceivedProof.value = response.request.received_proof_image
        ? [{ url: getImageUrl(response.request.received_proof_image) }]
        : [];
      statusEditMode.value = response.request.status !== "received";
      showToast(t("purchasingUpdated"), "success");
      await load();
    }
  } catch (error) {
    showToast(
      error.response?.data?.error || t("failedToSavePurchasing"),
      "error",
    );
  } finally {
    savingDetailStatus.value = false;
  }
};

const closeForm = () => {
  showFormModal.value = false;
  editingId.value = null;
  form.value = emptyForm();
};

const askDelete = (row) => {
  pendingDelete.value = row;
  showDeleteModal.value = true;
};

const save = async () => {
  if (!form.value.item_name.trim()) {
    showToast(t("itemNameRequired"), "error");
    return;
  }
  if (!Number(form.value.quantity) || Number(form.value.quantity) <= 0) {
    showToast(t("quantityRequired"), "error");
    return;
  }
  if (!form.value.unit) {
    showToast(t("unitRequired"), "error");
    return;
  }
  if (
    isSuperadmin.value &&
    formMode.value === "create" &&
    !companyFilter.value
  ) {
    showToast(t("selectCompanyFirst"), "error");
    return;
  }
  if (
    canFullEdit.value &&
    formMode.value === "edit" &&
    form.value.status === "received"
  ) {
    const hasNewProof = form.value.receivedProofFile instanceof File;
    const hasExisting = existingReceivedProof.value.length > 0;
    if (!hasNewProof && !hasExisting) {
      showToast(t("receivedProofRequired"), "error");
      return;
    }
    if (!String(form.value.received_note || "").trim()) {
      showToast(t("receivedNoteRequired"), "error");
      return;
    }
  }

  try {
    saving.value = true;
    translatingName.value = true;
    translatingNote.value = true;
    if (form.value.item_name.trim()) {
      form.value.item_name = await translateBilingualZhId(
        form.value.item_name,
      );
    }
    if (form.value.note.trim()) {
      form.value.note = await translateBilingualZhId(form.value.note);
    }
    translatingName.value = false;
    translatingNote.value = false;

    let picture = null;
    if (form.value.pictureFile instanceof File) {
      const up = await api.uploadImage(form.value.pictureFile);
      if (!up.success) throw new Error("upload failed");
      picture = up.url;
    } else if (formMode.value === "edit" && existingPicture.value.length) {
      const current = requests.value.find((r) => r.id === editingId.value);
      picture = current?.picture || null;
    }

    const payload = {
      item_name: form.value.item_name.trim(),
      quantity: Number(form.value.quantity),
      unit: form.value.unit || "pcs",
      note: form.value.note.trim(),
      picture,
      urgency: form.value.urgency,
      category: form.value.category,
    };

    if (isSuperadmin.value && companyFilter.value && formMode.value === "create") {
      payload.company_id = Number(companyFilter.value);
    }

    if (canFullEdit.value && formMode.value === "edit") {
      payload.status = form.value.status;
      payload.received_note = form.value.received_note.trim();
      if (form.value.receivedProofFile instanceof File) {
        const up = await api.uploadImage(form.value.receivedProofFile);
        if (!up.success) throw new Error("upload failed");
        payload.received_proof_image = up.url;
      } else if (existingReceivedProof.value.length) {
        const current = requests.value.find((r) => r.id === editingId.value);
        payload.received_proof_image = current?.received_proof_image || null;
      } else {
        payload.received_proof_image = null;
      }
    }

    if (formMode.value === "edit") {
      await api.updatePurchasing(editingId.value, payload);
      showToast(t("purchasingUpdated"), "success");
    } else {
      await api.createPurchasing(payload);
      showToast(t("purchasingCreated"), "success");
    }
    closeForm();
    await load();
  } catch (error) {
    translatingName.value = false;
    translatingNote.value = false;
    showToast(
      error.response?.data?.error || t("failedToSavePurchasing"),
      "error",
    );
  } finally {
    saving.value = false;
  }
};

const confirmDelete = async () => {
  if (!pendingDelete.value) return;
  try {
    deleting.value = true;
    await api.deletePurchasing(pendingDelete.value.id);
    showToast(t("purchasingDeleted"), "success");
    showDeleteModal.value = false;
    pendingDelete.value = null;
    showDetailModal.value = false;
    await load();
  } catch (error) {
    showToast(
      error.response?.data?.error || t("failedToDeletePurchasing"),
      "error",
    );
  } finally {
    deleting.value = false;
  }
};

watch(companyFilter, () => {
  load();
});

onMounted(async () => {
  await syncUserFlags();
  if (isSuperadmin.value) await loadCompanies();
  await load();
});
</script>

<template>
  <AppShell>
    <div class="space-y-5">
      <div
        class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <h1 class="text-2xl font-semibold text-neutral-900">
            {{ t("purchasingTitle") }}
          </h1>
          <p class="text-sm text-neutral-500">{{ t("purchasingSubtitle") }}</p>
        </div>
        <Button class="h-10" @click="openCreate">
          <Plus class="h-4 w-4" />
          {{ t("requestPurchasing") }}
        </Button>
      </div>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div class="relative min-w-0 flex-1">
          <Search
            class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400"
          />
          <Input
            v-model="filters.search"
            class="h-11 pl-9"
            :placeholder="t('searchPurchasing')"
            @keydown.enter="load"
          />
        </div>
        <div class="flex shrink-0 gap-2">
          <Button variant="outline" class="h-11" @click="showFilterModal = true">
            <ListFilter class="h-4 w-4" />
            {{ t("openFilters") }}
            <span
              v-if="activeFilterCount"
              class="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-neutral-900 px-1.5 text-xs font-medium text-white"
            >
              {{ activeFilterCount }}
            </span>
          </Button>
          <Button class="h-11" @click="load">{{ t("applyFilters") }}</Button>
        </div>
      </div>

      <Card class="overflow-hidden p-0">
        <div class="overflow-x-auto">
          <table class="w-full min-w-max text-sm">
            <thead class="border-b border-neutral-200 bg-neutral-50">
              <tr class="text-left">
                <th class="px-4 py-3">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 font-medium text-neutral-500"
                    @click="toggleSort('request_date')"
                  >
                    {{ t("requestDate") }}
                    <component :is="sortIcon('request_date')" class="h-3.5 w-3.5" />
                  </button>
                </th>
                <th class="px-4 py-3">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 font-medium text-neutral-500"
                    @click="toggleSort('item_name')"
                  >
                    {{ t("itemName") }}
                    <component :is="sortIcon('item_name')" class="h-3.5 w-3.5" />
                  </button>
                </th>
                <th class="px-4 py-3">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 font-medium text-neutral-500"
                    @click="toggleSort('quantity')"
                  >
                    {{ t("quantity") }}
                    <component :is="sortIcon('quantity')" class="h-3.5 w-3.5" />
                  </button>
                </th>
                <th class="whitespace-nowrap px-4 py-3 font-medium text-neutral-500">
                  {{ t("purchasingPicture") }}
                </th>
                <th class="px-4 py-3">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 font-medium text-neutral-500"
                    @click="toggleSort('category')"
                  >
                    {{ t("purchasingCategory") }}
                    <component :is="sortIcon('category')" class="h-3.5 w-3.5" />
                  </button>
                </th>
                <th class="px-4 py-3">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 font-medium text-neutral-500"
                    @click="toggleSort('urgency')"
                  >
                    {{ t("urgency") }}
                    <component :is="sortIcon('urgency')" class="h-3.5 w-3.5" />
                  </button>
                </th>
                <th class="px-4 py-3">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 font-medium text-neutral-500"
                    @click="toggleSort('status')"
                  >
                    {{ t("purchasingStatus") }}
                    <component :is="sortIcon('status')" class="h-3.5 w-3.5" />
                  </button>
                </th>
                <th class="px-4 py-3">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 font-medium text-neutral-500"
                    @click="toggleSort('requestor_name')"
                  >
                    {{ t("requestor") }}
                    <component
                      :is="sortIcon('requestor_name')"
                      class="h-3.5 w-3.5"
                    />
                  </button>
                </th>
                <th
                  class="whitespace-nowrap px-4 py-3 text-right font-medium text-neutral-500"
                >
                  {{ t("tableAction") }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="9" class="px-4 py-8 text-center text-neutral-500">
                  Loading…
                </td>
              </tr>
              <tr v-else-if="sortedRows.length === 0">
                <td colspan="9" class="px-4 py-8 text-center text-neutral-500">
                  <div class="flex flex-col items-center gap-2">
                    <ShoppingCart class="h-5 w-5 text-neutral-400" />
                    {{ t("noPurchasing") }}
                  </div>
                </td>
              </tr>
              <tr
                v-for="row in sortedRows"
                :key="row.id"
                class="cursor-pointer border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
                @click="openDetail(row)"
              >
                <td class="whitespace-nowrap px-4 py-3 font-mono text-neutral-600">
                  {{ row.request_date || "—" }}
                </td>
                <td class="max-w-[14rem] px-4 py-3 font-medium">
                  <div class="whitespace-pre-line line-clamp-3">
                    {{ row.item_name }}
                  </div>
                  <div
                    v-if="row.note"
                    class="mt-1 whitespace-pre-line line-clamp-2 text-xs text-neutral-500"
                  >
                    {{ row.note }}
                  </div>
                </td>
                <td class="whitespace-nowrap px-4 py-3 font-mono">
                  {{ formatQtyUnit(row) }}
                </td>
                <td class="px-4 py-3" @click.stop>
                  <button
                    v-if="getImageUrl(row.picture)"
                    type="button"
                    class="block"
                    @click="openImagePreview(row.picture)"
                  >
                    <img
                      :src="getImageUrl(row.picture)"
                      alt=""
                      class="h-10 w-10 rounded-md object-cover transition-opacity hover:opacity-80"
                    />
                  </button>
                  <span v-else class="text-neutral-400">—</span>
                </td>
                <td class="whitespace-nowrap px-4 py-3">
                  {{ labelCategory(row.category) }}
                </td>
                <td class="whitespace-nowrap px-4 py-3">
                  <Badge :class="urgencyBadgeClass(row.urgency)">
                    {{ labelUrgency(row.urgency) }}
                  </Badge>
                </td>
                <td class="whitespace-nowrap px-4 py-3">
                  <Badge :class="statusBadgeClass(row.status)">
                    {{ labelStatus(row.status) }}
                  </Badge>
                </td>
                <td class="whitespace-nowrap px-4 py-3">
                  {{ row.requestor_name || "—" }}
                </td>
                <td
                  class="whitespace-nowrap px-4 py-3 text-right"
                  @click.stop
                >
                  <div class="inline-flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      @click="openDetail(row)"
                    >
                      <Eye class="h-4 w-4" />
                    </Button>
                    <Button
                      v-if="canEditRow(row)"
                      variant="ghost"
                      size="icon-sm"
                      @click="openEdit(row)"
                    >
                      <Pencil class="h-4 w-4" />
                    </Button>
                    <Button
                      v-if="canEditRow(row)"
                      variant="ghost"
                      size="icon-sm"
                      class="text-red-600 hover:bg-red-50 hover:text-red-700"
                      @click="askDelete(row)"
                    >
                      <Trash2 class="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>

    <!-- Filters -->
    <Dialog
      :open="showFilterModal"
      :title="t('filtersTitle')"
      class="max-w-lg"
      actions-class="grid grid-cols-2 gap-2"
      @update:open="(v) => (showFilterModal = v)"
    >
      <div class="grid gap-3 sm:grid-cols-2">
        <div v-if="isSuperadmin" class="space-y-2 sm:col-span-2">
          <Label class="text-xs font-medium text-neutral-500">{{
            t("filterCompany")
          }}</Label>
          <Select
            :model-value="companyFilter"
            :items="companyFilterItems"
            :placeholder="t('filterAllCompanies')"
            @update:model-value="(v) => (companyFilter = v ?? '')"
          >
            <SelectTrigger class="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem
                  v-for="item in companyFilterItems"
                  :key="item.value || 'all'"
                  :value="item.value"
                >
                  {{ item.label }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-2">
          <Label class="text-xs font-medium text-neutral-500">{{
            t("filterCategory")
          }}</Label>
          <Select
            :model-value="filters.category"
            :items="filterCategoryItems"
            @update:model-value="(v) => (filters.category = v ?? '')"
          >
            <SelectTrigger class="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem
                  v-for="item in filterCategoryItems"
                  :key="`cat-${item.value || 'all'}`"
                  :value="item.value"
                >
                  {{ item.label }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-2">
          <Label class="text-xs font-medium text-neutral-500">{{
            t("filterUrgency")
          }}</Label>
          <Select
            :model-value="filters.urgency"
            :items="filterUrgencyItems"
            @update:model-value="(v) => (filters.urgency = v ?? '')"
          >
            <SelectTrigger class="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem
                  v-for="item in filterUrgencyItems"
                  :key="`urg-${item.value || 'all'}`"
                  :value="item.value"
                >
                  {{ item.label }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-2">
          <Label class="text-xs font-medium text-neutral-500">{{
            t("filterStatus")
          }}</Label>
          <Select
            :model-value="filters.status"
            :items="filterStatusItems"
            @update:model-value="(v) => (filters.status = v ?? '')"
          >
            <SelectTrigger class="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem
                  v-for="item in filterStatusItems"
                  :key="`st-${item.value || 'all'}`"
                  :value="item.value"
                >
                  {{ item.label }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-2">
          <Label class="text-xs font-medium text-neutral-500">{{
            t("filterRequestor")
          }}</Label>
          <Combobox
            v-model="filters.requestorId"
            :items="requestorItems"
            :placeholder="t('filterAllRequestors')"
            :search-placeholder="t('searchUsers')"
          />
        </div>

        <div class="space-y-2">
          <Label class="text-xs font-medium text-neutral-500">{{
            t("filterDateFrom")
          }}</Label>
          <DatePicker v-model="filters.dateFrom" />
        </div>
        <div class="space-y-2">
          <Label class="text-xs font-medium text-neutral-500">{{
            t("filterDateTo")
          }}</Label>
          <DatePicker v-model="filters.dateTo" />
        </div>
      </div>
      <template #actions>
        <Button
          variant="outline"
          type="button"
          class="h-11 w-full"
          @click="resetFilters"
        >
          {{ t("resetFilters") }}
        </Button>
        <Button type="button" class="h-11 w-full" @click="applyFiltersFromModal">
          {{ t("applyFilters") }}
        </Button>
      </template>
    </Dialog>

    <!-- Create / Edit -->
    <Dialog
      :open="showFormModal"
      :title="formMode === 'edit' ? t('editPurchasing') : t('requestPurchasing')"
      class="max-w-lg"
      actions-class="grid grid-cols-2 gap-2"
      @update:open="(v) => (v ? (showFormModal = true) : closeForm())"
    >
      <form id="purchasing-form" class="space-y-4" @submit.prevent="save">
        <div
          v-if="canFullEdit && formMode === 'edit'"
          class="space-y-4 rounded-xl border border-neutral-900/10 bg-neutral-50 p-4"
        >
          <div class="flex items-center justify-between gap-2">
            <Label class="text-sm font-medium text-neutral-900">{{
              t("purchasingStatus")
            }}</Label>
            <Badge :class="statusBadgeClass(form.status)">
              {{ labelStatus(form.status) }}
            </Badge>
          </div>
          <Select
            :model-value="form.status"
            :items="statusItems"
            @update:model-value="(v) => (form.status = v)"
          >
            <SelectTrigger class="h-11 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem
                  v-for="item in statusItems"
                  :key="item.value"
                  :value="item.value"
                >
                  {{ item.label }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <div
            v-if="form.status === 'received'"
            class="space-y-4 rounded-lg border border-neutral-200 bg-white p-3"
          >
            <div class="space-y-2">
              <Label>{{ t("receivedNote") }}</Label>
              <Input v-model="form.received_note" class="h-11" />
            </div>
            <div class="space-y-2">
              <Label>{{ t("receivedProof") }}</Label>
              <UploadImage
                v-model="form.receivedProofFile"
                :existing-images="existingReceivedProof"
                :show-existing="
                  existingReceivedProof.length > 0 && !form.receivedProofFile
                "
                @existing-removed="existingReceivedProof = []"
              />
            </div>
          </div>
        </div>

        <div class="space-y-2">
          <Label>{{ t("itemName") }}</Label>
          <textarea
            v-model="form.item_name"
            rows="3"
            required
            :disabled="translatingName"
            :class="
              cn(
                'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-neutral-400',
                translatingName && 'opacity-60',
              )
            "
            @blur="bilingualizeField('item_name')"
          />
          <p class="text-xs text-neutral-500">
            {{ translatingName ? t("translating") : t("bilingualAutoHint") }}
          </p>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <Label>{{ t("quantity") }}</Label>
            <Input
              v-model="form.quantity"
              type="number"
              min="0.01"
              step="any"
              class="h-11 font-mono"
              required
            />
          </div>
          <div class="space-y-2">
            <Label>{{ t("unit") }}</Label>
            <Combobox
              :model-value="form.unit"
              :items="unitItems"
              :placeholder="t('selectUnit')"
              :search-placeholder="t('searchUnit')"
              :empty-text="t('noUnitResults')"
              @update:model-value="(v) => (form.unit = v)"
            />
          </div>
        </div>
        <div class="space-y-2">
          <Label>{{ t("specsNote") }}</Label>
          <textarea
            v-model="form.note"
            rows="4"
            :disabled="translatingNote"
            :class="
              cn(
                'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-neutral-400',
                translatingNote && 'opacity-60',
              )
            "
            @blur="bilingualizeField('note')"
          />
          <p class="text-xs text-neutral-500">
            {{ translatingNote ? t("translating") : t("bilingualAutoHint") }}
          </p>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <Label>{{ t("purchasingCategory") }}</Label>
            <Select
              :model-value="form.category"
              :items="categoryItems"
              @update:model-value="(v) => (form.category = v)"
            >
              <SelectTrigger class="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                    v-for="item in categoryItems"
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
            <Label>{{ t("urgency") }}</Label>
            <Select
              :model-value="form.urgency"
              :items="urgencyItems"
              @update:model-value="(v) => (form.urgency = v)"
            >
              <SelectTrigger class="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                    v-for="item in urgencyItems"
                    :key="item.value"
                    :value="item.value"
                  >
                    {{ item.label }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div class="space-y-2">
          <Label>{{ t("purchasingPicture") }}</Label>
          <UploadImage
            v-model="form.pictureFile"
            :existing-images="existingPicture"
            :show-existing="existingPicture.length > 0 && !form.pictureFile"
            @existing-removed="existingPicture = []"
          />
        </div>
      </form>
      <template #actions>
        <Button
          variant="outline"
          type="button"
          class="h-11 w-full"
          @click="closeForm"
        >
          {{ t("cancel") }}
        </Button>
        <Button
          type="submit"
          form="purchasing-form"
          class="h-11 w-full"
          :loading="saving || translatingName || translatingNote"
        >
          {{ t("save") }}
        </Button>
      </template>
    </Dialog>

    <!-- Detail -->
    <Dialog
      :open="showDetailModal"
      :title="t('purchasingDetail')"
      class="max-w-lg"
      actions-class="grid grid-cols-2 gap-2"
      @update:open="(v) => (showDetailModal = v)"
    >
      <div v-if="detailItem" class="space-y-4 text-sm">
        <!-- Status: display (received) -->
        <div
          v-if="canManageStatus && detailItem.status === 'received' && !statusEditMode"
          class="space-y-4 rounded-xl border border-neutral-900/10 bg-neutral-50 p-4"
        >
          <div class="flex items-center justify-between gap-2">
            <Label class="text-sm font-medium text-neutral-900">{{
              t("purchasingStatus")
            }}</Label>
            <Badge :class="statusBadgeClass(detailItem.status)">
              {{ labelStatus(detailItem.status) }}
            </Badge>
          </div>
          <div class="space-y-3 rounded-lg border border-neutral-200 bg-white p-3">
            <div>
              <div class="text-xs text-neutral-500">{{ t("receivedNote") }}</div>
              <div class="mt-0.5 font-medium">
                {{ detailItem.received_note || "—" }}
              </div>
            </div>
            <div>
              <div class="text-xs text-neutral-500">{{ t("receivedAt") }}</div>
              <div class="mt-0.5 font-mono text-xs">
                {{ formatDateTime(detailItem.received_at) }}
              </div>
            </div>
            <div v-if="getImageUrl(detailItem.received_proof_image)">
              <div class="mb-2 text-xs text-neutral-500">
                {{ t("receivedProof") }}
              </div>
              <button
                type="button"
                class="block w-full"
                @click="openImagePreview(detailItem.received_proof_image)"
              >
                <img
                  :src="getImageUrl(detailItem.received_proof_image)"
                  alt=""
                  class="max-h-48 w-full rounded-lg border border-neutral-200 object-contain transition-opacity hover:opacity-80"
                />
              </button>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            class="h-11 w-full"
            @click="startStatusEdit"
          >
            <Pencil class="h-4 w-4" />
            {{ t("editStatus") }}
          </Button>
        </div>

        <!-- Status: edit -->
        <div
          v-else-if="canManageStatus && statusEditMode"
          class="space-y-4 rounded-xl border border-neutral-900/10 bg-neutral-50 p-4"
        >
          <div class="flex items-center justify-between gap-2">
            <Label class="text-sm font-medium text-neutral-900">{{
              t("purchasingStatus")
            }}</Label>
            <Badge :class="statusBadgeClass(detailStatus)">
              {{ labelStatus(detailStatus) }}
            </Badge>
          </div>
          <Select
            :model-value="detailStatus"
            :items="statusItems"
            @update:model-value="(v) => (detailStatus = v)"
          >
            <SelectTrigger class="h-11 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem
                  v-for="item in statusItems"
                  :key="`detail-${item.value}`"
                  :value="item.value"
                >
                  {{ item.label }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <div
            v-if="detailStatus === 'received'"
            class="space-y-4 rounded-lg border border-neutral-200 bg-white p-3"
          >
            <div class="space-y-2">
              <Label>{{ t("receivedNote") }}</Label>
              <Input v-model="detailReceivedNote" class="h-11" />
            </div>
            <div class="space-y-2">
              <Label>{{ t("receivedProof") }}</Label>
              <UploadImage
                v-model="detailReceivedProofFile"
                :existing-images="detailExistingReceivedProof"
                :show-existing="
                  detailExistingReceivedProof.length > 0 &&
                  !detailReceivedProofFile
                "
                @existing-removed="detailExistingReceivedProof = []"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <Button
              v-if="detailItem.status === 'received'"
              type="button"
              variant="outline"
              class="h-11 w-full"
              @click="cancelStatusEdit"
            >
              {{ t("cancel") }}
            </Button>
            <Button
              type="button"
              class="h-11 w-full"
              :class="detailItem.status === 'received' ? '' : 'col-span-2'"
              :loading="savingDetailStatus"
              @click="saveDetailStatus"
            >
              {{ t("updateStatus") }}
            </Button>
          </div>
        </div>

        <!-- Status badge only (non-editors) -->
        <div
          v-else-if="!canManageStatus"
          class="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3"
        >
          <span class="text-xs text-neutral-500">{{ t("purchasingStatus") }}</span>
          <Badge :class="statusBadgeClass(detailItem.status)">
            {{ labelStatus(detailItem.status) }}
          </Badge>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <div class="text-xs text-neutral-500">{{ t("itemName") }}</div>
            <div class="whitespace-pre-line font-medium">
              {{ detailItem.item_name }}
            </div>
          </div>
          <div>
            <div class="text-xs text-neutral-500">{{ t("quantity") }}</div>
            <div class="font-mono">{{ formatQtyUnit(detailItem) }}</div>
          </div>
          <div>
            <div class="text-xs text-neutral-500">{{ t("requestDate") }}</div>
            <div class="font-mono">{{ detailItem.request_date }}</div>
          </div>
          <div>
            <div class="text-xs text-neutral-500">{{ t("requestor") }}</div>
            <div>{{ detailItem.requestor_name || "—" }}</div>
            <div class="text-xs text-neutral-500">
              {{ detailItem.requestor_email }}
            </div>
          </div>
          <div>
            <div class="text-xs text-neutral-500">
              {{ t("purchasingCategory") }}
            </div>
            <div>{{ labelCategory(detailItem.category) }}</div>
          </div>
          <div>
            <div class="text-xs text-neutral-500">{{ t("urgency") }}</div>
            <Badge :class="urgencyBadgeClass(detailItem.urgency)">
              {{ labelUrgency(detailItem.urgency) }}
            </Badge>
          </div>
          <div>
            <div class="text-xs text-neutral-500">
              {{ t("statusUpdatedAt") }}
            </div>
            <div class="font-mono text-xs">
              {{ formatDateTime(detailItem.status_updated_at) }}
            </div>
          </div>
        </div>
        <div v-if="detailItem.note">
          <div class="text-xs text-neutral-500">{{ t("specsNote") }}</div>
          <div class="whitespace-pre-line">{{ detailItem.note }}</div>
        </div>
        <div v-if="getImageUrl(detailItem.picture)">
          <div class="mb-2 text-xs text-neutral-500">
            {{ t("purchasingPicture") }}
          </div>
          <button
            type="button"
            class="block"
            @click="openImagePreview(detailItem.picture)"
          >
            <img
              :src="getImageUrl(detailItem.picture)"
              alt=""
              class="max-h-48 rounded-lg border border-neutral-200 object-contain transition-opacity hover:opacity-80"
            />
          </button>
        </div>

        <!-- Received display for viewers (non status managers) -->
        <div
          v-if="detailItem.status === 'received' && !canManageStatus"
          class="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3"
        >
          <div>
            <div class="text-xs text-neutral-500">{{ t("receivedNote") }}</div>
            <div>{{ detailItem.received_note || "—" }}</div>
          </div>
          <div>
            <div class="text-xs text-neutral-500">{{ t("receivedAt") }}</div>
            <div class="font-mono text-xs">
              {{ formatDateTime(detailItem.received_at) }}
            </div>
          </div>
          <div v-if="getImageUrl(detailItem.received_proof_image)">
            <div class="mb-2 text-xs text-neutral-500">
              {{ t("receivedProof") }}
            </div>
            <button
              type="button"
              class="block w-full"
              @click="openImagePreview(detailItem.received_proof_image)"
            >
              <img
                :src="getImageUrl(detailItem.received_proof_image)"
                alt=""
                class="max-h-48 rounded-lg border border-neutral-200 object-contain transition-opacity hover:opacity-80"
              />
            </button>
          </div>
        </div>
      </div>
      <template #actions>
        <Button
          variant="outline"
          type="button"
          class="h-11 w-full"
          :class="
            detailItem && canEditRow(detailItem) ? '' : 'col-span-2'
          "
          @click="showDetailModal = false"
        >
          {{ t("cancel") }}
        </Button>
        <Button
          v-if="detailItem && canEditRow(detailItem)"
          type="button"
          class="h-11 w-full"
          @click="openEdit(detailItem)"
        >
          {{ t("editPurchasing") }}
        </Button>
      </template>
    </Dialog>

    <ConfirmDialog
      :open="showDeleteModal"
      :title="t('areYouSureDeletePurchasing')"
      :description="pendingDelete?.item_name || ''"
      :loading="deleting"
      @update:open="(v) => !v && (showDeleteModal = false)"
      @confirm="confirmDelete"
      @cancel="showDeleteModal = false"
    />

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
          alt=""
          class="max-h-[90vh] max-w-full rounded-lg object-contain shadow-lg"
        />
      </div>
    </Teleport>
  </AppShell>
</template>
