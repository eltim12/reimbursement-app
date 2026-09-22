<script setup>
import { computed, onMounted, ref, watch } from "vue";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
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
import DataSkeleton from "@/components/ui/DataSkeleton.vue";
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
import {
  isAlreadyBilingual,
  pickLocaleFromBilingual,
  splitBilingualSlash,
  translateBilingualZhId,
  translateToLocale,
} from "@/utils/translator";
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
const isStakeholder = computed(
  () => currentUser.value.role === "stakeholder",
);
const canFullEdit = computed(() => {
  const u = currentUser.value;
  if (u.role === "stakeholder") return false;
  if (u.role === "superadmin") return true;
  if (
    u.role === "finance" ||
    u.role === "management" ||
    u.role === "admin"
  ) {
    return true;
  }
  return !!u.purchasing_editor;
});
const canCreatePurchasing = computed(() => !isStakeholder.value);

const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const orders = ref([]);
const colleagues = ref([]);
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
const formMode = ref("create");
const translating = ref(false);

function emptyItem() {
  return {
    id: null,
    item_name: "",
    quantity: 1,
    unit: "pcs",
    note: "",
    pictureFile: null,
    existingPicture: [],
    picture: null,
    category: "office",
    supplier: "",
  };
}

function emptyForm() {
  return {
    requestor_id: "",
    urgency: "medium",
    status: "pending",
    note: "",
    items: [emptyItem()],
    received_note: "",
    receivedProofFile: null,
  };
}

const form = ref(emptyForm());
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
  { value: "partial", label: t("statusPartial") },
]);

const itemStatusItems = computed(() =>
  statusItems.value.filter((i) => i.value !== "partial"),
);

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

const colleagueItems = computed(() => [
  { value: "", label: t("requestorMyself") },
  ...colleagues.value.map((u) => ({
    value: String(u.id),
    label: u.name ? `${u.name} (${u.email})` : u.email,
  })),
]);

const filterRequestorItems = computed(() => {
  const map = new Map();
  for (const row of orders.value) {
    if (!map.has(row.requestor_id)) {
      map.set(row.requestor_id, {
        value: String(row.requestor_id),
        label:
          row.requestor_name ||
          row.requestor_email ||
          `#${row.requestor_id}`,
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

const formatQtyUnit = (item) =>
  `${item.quantity} ${labelUnit(item.unit)}`;

/** Show ID or ZH line from stored bilingual text based on UI language. */
const displayLocalized = (text) => {
  if (!text || !String(text).trim()) return "";
  const picked = pickLocaleFromBilingual(text, locale.value);
  if (picked) return picked;
  // Last resort: for ID UI never prefer the first line if it looks Chinese.
  const lines = String(text)
    .trim()
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (locale.value !== "zh" && lines.length >= 2) {
    return lines[lines.length - 1];
  }
  return lines[0] || String(text);
};

/** Cached locale-aware catatan PO labels (handles Chinese-only legacy notes). */
const noteLabelByKey = ref({});

const orderNoteLabel = (row) => {
  if (!row?.note) return "—";
  const key = `${row.id}:${locale.value}`;
  const cached = noteLabelByKey.value[key];
  if (cached != null && cached !== "") return cached;
  if (cached === "") return "—";
  return displayLocalized(row.note) || "—";
};

const hydrateOrderNoteLabels = async (rows) => {
  const loc = locale.value;
  const next = { ...noteLabelByKey.value };
  await Promise.all(
    (rows || []).map(async (row) => {
      const key = `${row.id}:${loc}`;
      const note = String(row.note || "").trim();
      if (!note) {
        next[key] = "";
        return;
      }
      if (isAlreadyBilingual(note) || splitBilingualSlash(note)) {
        next[key] = displayLocalized(note);
        return;
      }
      try {
        next[key] = await translateToLocale(note, loc);
        // Persist bilingual so future list loads don't need network translate.
        const bilingual = await translateBilingualZhId(note);
        if (bilingual && bilingual !== note) {
          row.note = bilingual;
          next[key] = displayLocalized(bilingual);
          if (canEditRow(row)) {
            api.updatePurchasing(row.id, { note: bilingual }).catch(() => {});
          }
        }
      } catch {
        next[key] = displayLocalized(note);
      }
    }),
  );
  noteLabelByKey.value = next;
};

const itemCountLabel = (n) => t("itemCount").replace("{n}", String(n ?? 0));

const itemsPreview = (order) => {
  const items = order.items || [];
  if (!items.length) return "—";
  const names = items.slice(0, 2).map((i) => displayLocalized(i.item_name));
  const more = items.length > 2 ? ` +${items.length - 2}` : "";
  return `${names.join(" · ")}${more}`;
};

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
    case "partial":
      return "border-transparent bg-amber-100 text-amber-900";
    default:
      return "border-transparent bg-neutral-100 text-neutral-700";
  }
};

const savingDetailStatus = ref(false);
const detailStatus = ref("pending");
const detailStatusScope = ref("order"); // order | items
const detailReceivedNote = ref("");
const detailReceivedProofFile = ref(null);
const detailExistingReceivedProof = ref([]);
const detailItemStatuses = ref([]);
const showStatusModal = ref(false);

const canEditRow = (row) => {
  if (isStakeholder.value) return false;
  if (!row || row.status === "received") return false;
  if (canFullEdit.value) return true;
  return (
    (row.requestor_id === currentUser.value.id ||
      row.created_by_id === currentUser.value.id) &&
    row.status === "pending"
  );
};

const canManageStatus = computed(() => canFullEdit.value);

const sortedRows = computed(() => {
  const rows = [...orders.value];
  const key = sortKey.value;
  const dir = sortDir.value === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    let av = a[key];
    let bv = b[key];
    if (key === "item_count") {
      av = Number(a.item_count) || (a.items || []).length || 0;
      bv = Number(b.item_count) || (b.items || []).length || 0;
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

const loadColleagues = async () => {
  try {
    const params = {};
    if (isSuperadmin.value && companyFilter.value) {
      params.companyId = companyFilter.value;
    }
    const response = await api.getPurchasingColleagues(params);
    if (response.success) {
      colleagues.value = response.colleagues || [];
    }
  } catch {
    colleagues.value = [];
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
      orders.value = response.orders || response.requests || [];
      hydrateOrderNoteLabels(orders.value);
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
  await loadColleagues();
};

const applyFiltersFromModal = async () => {
  showFilterModal.value = false;
  await load();
};

const addItemRow = () => {
  form.value.items.push(emptyItem());
};

const removeItemRow = (index) => {
  if (form.value.items.length <= 1) return;
  form.value.items.splice(index, 1);
};

const openCreate = async () => {
  formMode.value = "create";
  editingId.value = null;
  form.value = emptyForm();
  existingReceivedProof.value = [];
  await loadColleagues();
  showFormModal.value = true;
};

const openEdit = async (row) => {
  if (row.status === "received") {
    openDetail(row);
    return;
  }
  formMode.value = "edit";
  editingId.value = row.id;
  await loadColleagues();
  form.value = {
    requestor_id:
      row.requestor_id === currentUser.value.id
        ? ""
        : String(row.requestor_id || ""),
    urgency: row.urgency,
    status: row.status,
    note: row.note || "",
    items: (row.items || []).map((item) => ({
      id: item.id,
      item_name: item.item_name,
      quantity: item.quantity,
      unit: item.unit || "pcs",
      note: item.note || "",
      pictureFile: null,
      existingPicture: item.picture
        ? [{ url: getImageUrl(item.picture) }]
        : [],
      picture: item.picture || null,
      category: item.category || "office",
      supplier: item.supplier || "",
    })),
    received_note: row.received_note || "",
    receivedProofFile: null,
  };
  if (!form.value.items.length) form.value.items = [emptyItem()];
  existingReceivedProof.value = row.received_proof_image
    ? [{ url: getImageUrl(row.received_proof_image) }]
    : [];
  showDetailModal.value = false;
  showFormModal.value = true;
};

const initDetailItemStatuses = (row) => {
  detailItemStatuses.value = (row.items || []).map((item) => ({
    id: item.id,
    item_name: item.item_name,
    status: item.status || "pending",
    supplier: item.supplier || "",
    received_note: item.received_note || "",
    receivedProofFile: null,
    existingReceivedProof: item.received_proof_image
      ? [{ url: getImageUrl(item.received_proof_image) }]
      : [],
    received_proof_image: item.received_proof_image || null,
  }));
};

const applyDetailStatusToAllItems = () => {
  for (const row of detailItemStatuses.value) {
    row.status = detailStatus.value;
  }
};

const openDetail = (row) => {
  detailItem.value = row;
  detailStatus.value =
    row.status === "partial" ? "ordered" : row.status || "pending";
  detailStatusScope.value = row.status === "partial" ? "items" : "order";
  detailReceivedNote.value = row.received_note || "";
  detailReceivedProofFile.value = null;
  detailExistingReceivedProof.value = row.received_proof_image
    ? [{ url: getImageUrl(row.received_proof_image) }]
    : [];
  initDetailItemStatuses(row);
  showStatusModal.value = false;
  showDetailModal.value = true;
};

const startStatusEdit = () => {
  if (!detailItem.value) return;
  detailStatus.value =
    detailItem.value.status === "partial"
      ? "ordered"
      : detailItem.value.status;
  detailStatusScope.value =
    detailItem.value.status === "partial" ? "items" : "order";
  detailReceivedNote.value = detailItem.value.received_note || "";
  detailReceivedProofFile.value = null;
  detailExistingReceivedProof.value = detailItem.value.received_proof_image
    ? [{ url: getImageUrl(detailItem.value.received_proof_image) }]
    : [];
  initDetailItemStatuses(detailItem.value);
  // Swap: never stack status on top of detail
  showDetailModal.value = false;
  showStatusModal.value = true;
};

const backFromStatusEdit = () => {
  showStatusModal.value = false;
  if (detailItem.value) showDetailModal.value = true;
};

const onStatusModalOpen = (open) => {
  showStatusModal.value = open;
  // Backdrop / Esc close → return to detail (one modal at a time)
  if (!open && detailItem.value) showDetailModal.value = true;
};

const saveDetailStatus = async () => {
  if (!detailItem.value || !canFullEdit.value) return;

  try {
    savingDetailStatus.value = true;
    const payload = {
      statusScope: detailStatusScope.value,
    };

    if (detailStatusScope.value === "order") {
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
      payload.status = detailStatus.value;
      payload.received_note = detailReceivedNote.value.trim();
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
    } else {
      const itemStatuses = [];
      for (const row of detailItemStatuses.value) {
        if (row.status === "received") {
          const hasNew = row.receivedProofFile instanceof File;
          const hasExisting = row.existingReceivedProof?.length > 0;
          if (!hasNew && !hasExisting && !row.received_proof_image) {
            showToast(t("receivedProofRequired"), "error");
            return;
          }
          if (!String(row.received_note || "").trim()) {
            showToast(t("receivedNoteRequired"), "error");
            return;
          }
        }
        let proof = row.received_proof_image || null;
        if (row.receivedProofFile instanceof File) {
          const up = await api.uploadImage(row.receivedProofFile);
          if (!up.success) throw new Error("upload failed");
          proof = up.url;
        } else if (row.existingReceivedProof?.length) {
          proof = row.received_proof_image || null;
        } else if (row.status !== "received") {
          proof = null;
        }
        itemStatuses.push({
          id: row.id,
          status: row.status,
          supplier: row.supplier,
          received_note: row.received_note,
          received_proof_image: proof,
        });
      }
      payload.itemStatuses = itemStatuses;
    }

    const response = await api.updatePurchasing(detailItem.value.id, payload);
    if (response.success) {
      detailItem.value = response.order || response.request;
      detailStatus.value =
        detailItem.value.status === "partial"
          ? "ordered"
          : detailItem.value.status;
      detailStatusScope.value =
        detailItem.value.status === "partial" ? "items" : "order";
      detailReceivedNote.value = detailItem.value.received_note || "";
      detailReceivedProofFile.value = null;
      detailExistingReceivedProof.value = detailItem.value.received_proof_image
        ? [{ url: getImageUrl(detailItem.value.received_proof_image) }]
        : [];
      initDetailItemStatuses(detailItem.value);
      showStatusModal.value = false;
      showDetailModal.value = true;
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
  const items = form.value.items || [];
  if (!items.length) {
    showToast(t("atLeastOneItem"), "error");
    return;
  }
  for (let i = 0; i < items.length; i += 1) {
    if (!String(items[i].item_name || "").trim()) {
      showToast(t("itemNameRequired"), "error");
      return;
    }
    if (!Number(items[i].quantity) || Number(items[i].quantity) <= 0) {
      showToast(t("quantityRequired"), "error");
      return;
    }
    if (!items[i].unit) {
      showToast(t("unitRequired"), "error");
      return;
    }
  }
  if (
    isSuperadmin.value &&
    formMode.value === "create" &&
    !companyFilter.value
  ) {
    showToast(t("selectCompanyFirst"), "error");
    return;
  }

  try {
    saving.value = true;
    translating.value = true;

    let orderNote = String(form.value.note || "").trim();
    if (orderNote) {
      orderNote = await translateBilingualZhId(orderNote);
    }

    const payloadItems = [];
    for (const item of items) {
      let item_name = String(item.item_name || "").trim();
      let note = String(item.note || "").trim();
      if (item_name) item_name = await translateBilingualZhId(item_name);
      if (note) note = await translateBilingualZhId(note);

      let picture = item.picture || null;
      if (item.pictureFile instanceof File) {
        const up = await api.uploadImage(item.pictureFile);
        if (!up.success) throw new Error("upload failed");
        picture = up.url;
      } else if (item.existingPicture?.length && picture) {
        // keep existing path
      } else if (item.existingPicture?.length) {
        picture = item.picture || null;
      } else {
        picture = null;
      }

      payloadItems.push({
        id: item.id || undefined,
        item_name,
        quantity: Number(item.quantity),
        unit: item.unit || "pcs",
        note,
        picture,
        category: item.category || "office",
        supplier: String(item.supplier || "").trim(),
      });
    }
    translating.value = false;

    const payload = {
      urgency: form.value.urgency,
      note: orderNote,
      items: payloadItems,
      requestor_id: form.value.requestor_id
        ? Number(form.value.requestor_id)
        : currentUser.value.id,
    };

    if (isSuperadmin.value && companyFilter.value && formMode.value === "create") {
      payload.company_id = Number(companyFilter.value);
    }

    const response =
      formMode.value === "edit"
        ? await api.updatePurchasing(editingId.value, payload)
        : await api.createPurchasing(payload);

    if (response.success) {
      showToast(
        formMode.value === "edit"
          ? t("purchasingUpdated")
          : t("purchasingCreated"),
        "success",
      );
      closeForm();
      await load();
    }
  } catch (error) {
    showToast(
      error.response?.data?.error || t("failedToSavePurchasing"),
      "error",
    );
  } finally {
    translating.value = false;
    saving.value = false;
  }
};

const confirmDelete = async () => {
  if (!pendingDelete.value) return;
  try {
    deleting.value = true;
    const response = await api.deletePurchasing(pendingDelete.value.id);
    if (response.success) {
      showToast(t("purchasingDeleted"), "success");
      showDeleteModal.value = false;
      showDetailModal.value = false;
      pendingDelete.value = null;
      await load();
    }
  } catch (error) {
    showToast(
      error.response?.data?.error || t("failedToDeletePurchasing"),
      "error",
    );
  } finally {
    deleting.value = false;
  }
};

watch(
  () => filters.value.search,
  () => {
    load();
  },
);

watch(locale, () => {
  hydrateOrderNoteLabels(orders.value);
});

watch(companyFilter, async () => {
  if (isSuperadmin.value) {
    await loadColleagues();
  }
});

onMounted(async () => {
  await syncUserFlags();
  if (isSuperadmin.value) await loadCompanies();
  await load();
  await loadColleagues();
});
</script>

<template>
  <AppShell>
    <div class="space-y-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-neutral-900">
            {{ t("purchasingTitle") }}
          </h1>
          <p class="mt-1 text-sm text-neutral-500">
            {{ t("purchasingSubtitle") }}
          </p>
        </div>
        <Button
          v-if="canCreatePurchasing"
          class="h-11 gap-2"
          @click="openCreate"
        >
          <Plus class="h-4 w-4" />
          {{ t("requestPurchasing") }}
        </Button>
      </div>

      <Card>
        <div class="flex flex-col gap-3 border-b border-neutral-100 p-4 sm:flex-row sm:items-center">
          <div class="relative min-w-0 flex-1">
            <Search
              class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400"
            />
            <Input
              v-model="filters.search"
              class="h-11 pl-9"
              :placeholder="t('searchPurchasing')"
            />
          </div>
          <Button
            variant="outline"
            class="h-11 gap-2"
            @click="showFilterModal = true"
          >
            <ListFilter class="h-4 w-4" />
            {{ t("openFilters") }}
            <Badge
              v-if="activeFilterCount"
              class="border-transparent bg-neutral-900 text-white"
            >
              {{ activeFilterCount }}
            </Badge>
          </Button>
        </div>

        <!-- Mobile: card list -->
        <div class="space-y-3 p-3 md:hidden">
          <DataSkeleton v-if="loading" variant="cards" :rows="5" />
          <div
            v-else-if="sortedRows.length === 0"
            class="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-10 text-center text-sm text-neutral-500"
          >
            <ShoppingCart class="mx-auto mb-2 h-8 w-8 text-neutral-300" />
            {{ t("noPurchasing") }}
          </div>
          <template v-else>
            <div
              v-for="row in sortedRows"
              :key="row.id"
              class="flex w-full flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 text-left transition-colors active:bg-neutral-50"
              role="button"
              tabindex="0"
              @click="openDetail(row)"
              @keydown.enter.prevent="openDetail(row)"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="font-mono text-sm font-semibold text-neutral-900">
                    {{ row.po_code }}
                  </p>
                  <p class="mt-0.5 line-clamp-2 text-sm text-neutral-600">
                    {{ orderNoteLabel(row) }}
                  </p>
                </div>
                <ChevronRight class="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
              </div>
              <div class="flex flex-wrap gap-1.5">
                <Badge :class="statusBadgeClass(row.status)">
                  {{ labelStatus(row.status) }}
                </Badge>
                <Badge :class="urgencyBadgeClass(row.urgency)">
                  {{ labelUrgency(row.urgency) }}
                </Badge>
              </div>
              <div class="space-y-1 text-sm">
                <div>
                  <span class="font-medium text-neutral-900">{{
                    row.requestor_name || "—"
                  }}</span>
                  <span
                    v-if="row.requestor_email"
                    class="mt-0.5 block truncate text-xs text-neutral-500"
                  >
                    {{ row.requestor_email }}
                  </span>
                </div>
                <div>
                  <p class="text-xs text-neutral-500">
                    {{
                      itemCountLabel(row.item_count || row.items?.length || 0)
                    }}
                  </p>
                  <p class="line-clamp-2 whitespace-pre-line text-neutral-800">
                    {{ itemsPreview(row) }}
                  </p>
                </div>
                <p class="font-mono text-xs text-neutral-500">
                  {{ row.request_date || "—" }}
                </p>
              </div>
              <div
                v-if="canEditRow(row)"
                class="flex items-center justify-end gap-1 border-t border-neutral-100 pt-2"
                @click.stop
              >
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-9 w-9"
                  @click="openEdit(row)"
                >
                  <Pencil class="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-9 w-9 text-red-600 hover:text-red-700"
                  @click="askDelete(row)"
                >
                  <Trash2 class="h-4 w-4" />
                </Button>
              </div>
            </div>
          </template>
        </div>

        <!-- Desktop: table -->
        <div class="hidden overflow-x-auto md:block">
          <table class="w-full min-w-[56rem] text-left text-sm">
            <thead class="border-b border-neutral-100 bg-neutral-50/80 text-xs uppercase tracking-wide">
              <tr>
                <th class="px-4 py-3">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 font-medium text-neutral-500"
                    @click="toggleSort('po_code')"
                  >
                    {{ t("poCode") }}
                    <component :is="sortIcon('po_code')" class="h-3.5 w-3.5" />
                  </button>
                </th>
                <th class="px-4 py-3">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 font-medium text-neutral-500"
                    @click="toggleSort('note')"
                  >
                    {{ t("poNote") }}
                    <component :is="sortIcon('note')" class="h-3.5 w-3.5" />
                  </button>
                </th>
                <th class="px-4 py-3">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 font-medium text-neutral-500"
                    @click="toggleSort('requestor_name')"
                  >
                    {{ t("requestor") }}
                    <component :is="sortIcon('requestor_name')" class="h-3.5 w-3.5" />
                  </button>
                </th>
                <th class="px-4 py-3">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 font-medium text-neutral-500"
                    @click="toggleSort('item_count')"
                  >
                    {{ t("items") }}
                    <component :is="sortIcon('item_count')" class="h-3.5 w-3.5" />
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
                <th class="px-4 py-3 font-medium text-neutral-500" />
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
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="8" class="p-0">
                  <DataSkeleton variant="table" :rows="6" :cols="8" />
                </td>
              </tr>
              <tr v-else-if="sortedRows.length === 0">
                <td colspan="8" class="px-4 py-12 text-center text-neutral-500">
                  <ShoppingCart class="mx-auto mb-2 h-8 w-8 text-neutral-300" />
                  {{ t("noPurchasing") }}
                </td>
              </tr>
              <tr
                v-for="row in sortedRows"
                :key="row.id"
                class="cursor-pointer border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
                @click="openDetail(row)"
              >
                <td class="whitespace-nowrap px-4 py-3 font-mono font-medium text-neutral-900">
                  {{ row.po_code }}
                </td>
                <td class="max-w-[14rem] px-4 py-3">
                  <div class="line-clamp-2 text-neutral-800">
                    {{ orderNoteLabel(row) }}
                  </div>
                </td>
                <td class="px-4 py-3">
                  <div class="font-medium">{{ row.requestor_name || "—" }}</div>
                  <div class="text-xs text-neutral-500">
                    {{ row.requestor_email }}
                  </div>
                </td>
                <td class="max-w-[16rem] px-4 py-3">
                  <div class="text-xs text-neutral-500">
                    {{ itemCountLabel(row.item_count || row.items?.length || 0) }}
                  </div>
                  <div class="line-clamp-2 whitespace-pre-line font-medium">
                    {{ itemsPreview(row) }}
                  </div>
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
                <td class="px-4 py-3" @click.stop>
                  <div class="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-9 w-9"
                      @click="openDetail(row)"
                    >
                      <Eye class="h-4 w-4" />
                    </Button>
                    <Button
                      v-if="canEditRow(row)"
                      variant="ghost"
                      size="icon"
                      class="h-9 w-9"
                      @click="openEdit(row)"
                    >
                      <Pencil class="h-4 w-4" />
                    </Button>
                    <Button
                      v-if="canEditRow(row)"
                      variant="ghost"
                      size="icon"
                      class="h-9 w-9 text-red-600 hover:text-red-700"
                      @click="askDelete(row)"
                    >
                      <Trash2 class="h-4 w-4" />
                    </Button>
                  </div>
                </td>
                <td class="whitespace-nowrap px-4 py-3 font-mono text-neutral-600">
                  {{ row.request_date || "—" }}
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
      :title="t('openFilters')"
      class="max-w-lg"
      actions-class="grid w-full grid-cols-2 gap-2"
      @update:open="(v) => (showFilterModal = v)"
    >
      <div class="space-y-4">
        <div v-if="isSuperadmin" class="space-y-2">
          <Label>{{ t("filterCompany") }}</Label>
          <Combobox
            :model-value="companyFilter"
            :items="companyFilterItems"
            :placeholder="t('filterAllCompanies')"
            @update:model-value="(v) => (companyFilter = v || '')"
          />
        </div>
        <div class="space-y-2">
          <Label>{{ t("filterCategory") }}</Label>
          <Select
            :model-value="filters.category"
            :items="filterCategoryItems"
            @update:model-value="(v) => (filters.category = v)"
          >
            <SelectTrigger class="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem
                  v-for="item in filterCategoryItems"
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
          <Label>{{ t("filterUrgency") }}</Label>
          <Select
            :model-value="filters.urgency"
            :items="filterUrgencyItems"
            @update:model-value="(v) => (filters.urgency = v)"
          >
            <SelectTrigger class="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem
                  v-for="item in filterUrgencyItems"
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
          <Label>{{ t("filterStatus") }}</Label>
          <Select
            :model-value="filters.status"
            :items="filterStatusItems"
            @update:model-value="(v) => (filters.status = v)"
          >
            <SelectTrigger class="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem
                  v-for="item in filterStatusItems"
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
          <Label>{{ t("filterRequestor") }}</Label>
          <Combobox
            :model-value="filters.requestorId"
            :items="filterRequestorItems"
            :placeholder="t('filterAllRequestors')"
            @update:model-value="(v) => (filters.requestorId = v || '')"
          />
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <Label>{{ t("filterDateFrom") }}</Label>
            <DatePicker
              :model-value="filters.dateFrom"
              @update:model-value="(v) => (filters.dateFrom = v)"
            />
          </div>
          <div class="space-y-2">
            <Label>{{ t("filterDateTo") }}</Label>
            <DatePicker
              :model-value="filters.dateTo"
              @update:model-value="(v) => (filters.dateTo = v)"
            />
          </div>
        </div>
      </div>
      <template #actions>
        <Button variant="outline" class="h-11 w-full" @click="resetFilters">
          {{ t("resetFilters") }}
        </Button>
        <Button class="h-11 w-full" @click="applyFiltersFromModal">
          {{ t("applyFilters") }}
        </Button>
      </template>
    </Dialog>

    <!-- Create / Edit PO -->
    <Dialog
      :open="showFormModal"
      :title="formMode === 'edit' ? t('editPurchasing') : t('requestPurchasing')"
      class="max-w-3xl"
      actions-class="grid w-full grid-cols-2 gap-2"
      @update:open="(v) => (v ? null : closeForm())"
    >
      <div class="space-y-5">
        <div class="space-y-2">
          <Label>{{ t("requestor") }}</Label>
          <Combobox
            :model-value="form.requestor_id"
            :items="colleagueItems"
            :placeholder="t('selectRequestor')"
            :search-placeholder="t('searchRequestor')"
            :empty-text="t('noRequestorResults')"
            @update:model-value="(v) => (form.requestor_id = v ?? '')"
          />
          <p class="text-xs text-neutral-500">{{ t("requestorHint") }}</p>
        </div>

        <div class="space-y-2">
          <Label>{{ t("poNote") }}</Label>
          <Input
            v-model="form.note"
            class="h-11"
            :placeholder="t('poNotePlaceholder')"
          />
          <p class="text-xs text-neutral-500">{{ t("poNoteHint") }}</p>
          <p class="text-xs text-neutral-500">{{ t("bilingualAutoHint") }}</p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <Label>{{ t("urgency") }}</Label>
            <Select
              :model-value="form.urgency"
              :items="urgencyItems"
              @update:model-value="(v) => (form.urgency = v)"
            >
              <SelectTrigger class="h-11"><SelectValue /></SelectTrigger>
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

        <div class="space-y-3">
          <div class="flex items-center justify-between gap-2">
            <Label class="mb-0">{{ t("items") }}</Label>
            <Button
              type="button"
              variant="outline"
              class="h-9 gap-1.5"
              @click="addItemRow"
            >
              <Plus class="h-3.5 w-3.5" />
              {{ t("addItem") }}
            </Button>
          </div>

          <div
            v-for="(item, index) in form.items"
            :key="index"
            class="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50/50 p-4"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-medium text-neutral-500">
                #{{ index + 1 }}
              </span>
              <Button
                v-if="form.items.length > 1"
                type="button"
                variant="ghost"
                class="h-8 gap-1 px-2 text-red-600"
                @click="removeItemRow(index)"
              >
                <Trash2 class="h-3.5 w-3.5" />
                {{ t("removeItem") }}
              </Button>
            </div>

            <div class="space-y-2">
              <Label>{{ t("itemName") }}</Label>
              <textarea
                v-model="item.item_name"
                rows="2"
                required
                :class="
                  cn(
                    'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-neutral-400',
                  )
                "
              />
            </div>

            <div class="grid gap-3 sm:grid-cols-3">
              <div class="space-y-2">
                <Label>{{ t("quantity") }}</Label>
                <Input
                  v-model="item.quantity"
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
                  :model-value="item.unit"
                  :items="unitItems"
                  :placeholder="t('selectUnit')"
                  :search-placeholder="t('searchUnit')"
                  :empty-text="t('noUnitResults')"
                  @update:model-value="(v) => (item.unit = v)"
                />
              </div>
              <div class="space-y-2">
                <Label>{{ t("purchasingCategory") }}</Label>
                <Select
                  :model-value="item.category"
                  :items="categoryItems"
                  @update:model-value="(v) => (item.category = v)"
                >
                  <SelectTrigger class="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem
                        v-for="opt in categoryItems"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div class="space-y-2">
              <Label>{{ t("supplier") }}</Label>
              <Input
                v-model="item.supplier"
                class="h-11"
                :placeholder="t('supplierPlaceholder')"
              />
              <p class="text-xs text-neutral-500">{{ t("supplierHint") }}</p>
            </div>

            <div class="space-y-2">
              <Label>{{ t("specsNote") }}</Label>
              <textarea
                v-model="item.note"
                rows="2"
                :class="
                  cn(
                    'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-neutral-400',
                  )
                "
              />
            </div>

            <div class="space-y-2">
              <Label>{{ t("purchasingPicture") }}</Label>
              <UploadImage
                v-model="item.pictureFile"
                :existing-images="item.existingPicture"
                @existing-removed="
                  () => {
                    item.existingPicture = [];
                    item.picture = null;
                  }
                "
              />
            </div>
          </div>
          <p class="text-xs text-neutral-500">{{ t("bilingualAutoHint") }}</p>
        </div>
      </div>

      <template #actions>
        <Button variant="outline" class="h-11 w-full" @click="closeForm">
          {{ t("cancel") }}
        </Button>
        <Button
          class="h-11 w-full"
          :loading="saving || translating"
          @click="save"
        >
          {{ t("save") }}
        </Button>
      </template>
    </Dialog>

    <!-- Detail PO -->
    <Dialog
      :open="showDetailModal"
      :title="detailItem?.po_code || t('purchasingDetail')"
      class="max-w-3xl"
      actions-class="flex w-full flex-col gap-2 sm:flex-row sm:justify-end"
      @update:open="(v) => (showDetailModal = v)"
    >
      <div v-if="detailItem" class="space-y-5">
        <div class="flex flex-wrap items-center gap-2">
          <Badge :class="statusBadgeClass(detailItem.status)">
            {{ labelStatus(detailItem.status) }}
          </Badge>
          <Badge :class="urgencyBadgeClass(detailItem.urgency)">
            {{ labelUrgency(detailItem.urgency) }}
          </Badge>
          <span class="font-mono text-sm text-neutral-600">
            {{ detailItem.po_code }}
          </span>
        </div>

        <div
          v-if="detailItem.note"
          class="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3"
        >
          <div class="text-xs text-neutral-500">{{ t("poNote") }}</div>
          <div class="font-medium text-neutral-900 whitespace-pre-line">
            {{ displayLocalized(detailItem.note) || detailItem.note }}
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
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
          <div
            v-if="
              detailItem.created_by_id &&
              detailItem.created_by_id !== detailItem.requestor_id
            "
          >
            <div class="text-xs text-neutral-500">{{ t("submittedBy") }}</div>
            <div>{{ detailItem.created_by_name || "—" }}</div>
          </div>
        </div>

        <div class="space-y-2">
          <div class="text-sm font-medium text-neutral-900">
            {{ t("items") }}
            <span class="font-normal text-neutral-500">
              ({{ itemCountLabel(detailItem.items?.length || 0) }})
            </span>
          </div>
          <div class="overflow-x-auto rounded-xl border border-neutral-200">
            <table class="w-full min-w-[40rem] text-left text-sm">
              <thead class="bg-neutral-50 text-xs text-neutral-500">
                <tr>
                  <th class="px-3 py-2 font-medium">#</th>
                  <th class="px-3 py-2 font-medium">{{ t("itemName") }}</th>
                  <th class="px-3 py-2 font-medium">{{ t("quantity") }}</th>
                  <th class="px-3 py-2 font-medium">{{ t("supplier") }}</th>
                  <th class="px-3 py-2 font-medium">{{ t("purchasingStatus") }}</th>
                  <th class="px-3 py-2 font-medium">{{ t("purchasingPicture") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, idx) in detailItem.items || []"
                  :key="item.id || idx"
                  class="border-t border-neutral-100"
                >
                  <td class="px-3 py-2.5 text-neutral-500">{{ idx + 1 }}</td>
                  <td class="px-3 py-2.5">
                    <div class="font-medium">
                      {{ displayLocalized(item.item_name) }}
                    </div>
                    <div class="text-xs text-neutral-500">
                      {{ labelCategory(item.category) }}
                    </div>
                    <div
                      v-if="item.note"
                      class="mt-1 text-xs text-neutral-500"
                    >
                      {{ displayLocalized(item.note) }}
                    </div>
                  </td>
                  <td class="whitespace-nowrap px-3 py-2.5 font-mono">
                    {{ formatQtyUnit(item) }}
                  </td>
                  <td class="px-3 py-2.5 text-neutral-700">
                    {{ item.supplier || "—" }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-2.5">
                    <Badge :class="statusBadgeClass(item.status)">
                      {{ labelStatus(item.status) }}
                    </Badge>
                  </td>
                  <td class="px-3 py-2.5">
                    <button
                      v-if="getImageUrl(item.picture)"
                      type="button"
                      @click="openImagePreview(item.picture)"
                    >
                      <img
                        :src="getImageUrl(item.picture)"
                        alt=""
                        class="h-10 w-10 rounded-md object-cover"
                      />
                    </button>
                    <span v-else class="text-neutral-400">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div
          v-if="
            detailItem.status === 'received' &&
            (detailItem.received_note ||
              getImageUrl(detailItem.received_proof_image))
          "
          class="space-y-2 rounded-xl border border-neutral-200 p-4"
        >
          <div class="text-sm font-medium text-neutral-900">
            {{ t("receivedNote") }}
          </div>
          <div class="text-neutral-700">
            {{ detailItem.received_note || "—" }}
          </div>
          <button
            v-if="getImageUrl(detailItem.received_proof_image)"
            type="button"
            @click="openImagePreview(detailItem.received_proof_image)"
          >
            <img
              :src="getImageUrl(detailItem.received_proof_image)"
              alt=""
              class="h-24 rounded-lg object-cover"
            />
          </button>
        </div>
      </div>

      <template #actions>
        <Button
          variant="outline"
          class="h-11 w-full sm:w-auto"
          @click="showDetailModal = false"
        >
          {{ t("close") }}
        </Button>
        <Button
          v-if="detailItem && canEditRow(detailItem)"
          variant="outline"
          class="h-11 w-full sm:w-auto"
          @click="openEdit(detailItem)"
        >
          {{ t("editPurchasing") }}
        </Button>
        <Button
          v-if="
            detailItem && canManageStatus && detailItem.status !== 'received'
          "
          class="h-11 w-full sm:w-auto"
          @click="startStatusEdit"
        >
          {{ t("updateStatus") }}
        </Button>
      </template>
    </Dialog>

    <!-- Perbarui status PO -->
    <Dialog
      :open="showStatusModal"
      :title="t('updateStatus')"
      :description="detailItem?.po_code || ''"
      class="max-w-xl"
      actions-class="grid w-full grid-cols-2 gap-2"
      @update:open="onStatusModalOpen"
    >
      <div v-if="detailItem" class="space-y-4">
        <div>
          <div class="inline-flex w-full rounded-lg bg-neutral-100 p-1">
            <button
              type="button"
              :class="
                cn(
                  'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  detailStatusScope === 'order'
                    ? 'bg-white text-neutral-900 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-800',
                )
              "
              @click="detailStatusScope = 'order'"
            >
              {{ t("statusScopeOrder") }}
            </button>
            <button
              type="button"
              :class="
                cn(
                  'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  detailStatusScope === 'items'
                    ? 'bg-white text-neutral-900 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-800',
                )
              "
              @click="detailStatusScope = 'items'"
            >
              {{ t("statusScopeItems") }}
            </button>
          </div>
          <p class="mt-2 text-xs text-neutral-500">{{ t("statusScopeHint") }}</p>
        </div>

        <template v-if="detailStatusScope === 'order'">
          <div class="space-y-2">
            <Label>{{ t("purchasingStatus") }}</Label>
            <Select
              :model-value="detailStatus"
              :items="itemStatusItems"
              @update:model-value="(v) => (detailStatus = v)"
            >
              <SelectTrigger class="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                    v-for="item in itemStatusItems"
                    :key="item.value"
                    :value="item.value"
                  >
                    {{ item.label }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div v-if="detailStatus === 'received'" class="space-y-3">
            <div class="space-y-2">
              <Label>{{ t("receivedNote") }}</Label>
              <Input v-model="detailReceivedNote" class="h-11" />
            </div>
            <div class="space-y-2">
              <Label>{{ t("receivedProof") }}</Label>
              <UploadImage
                v-model="detailReceivedProofFile"
                :existing-images="detailExistingReceivedProof"
                @existing-removed="detailExistingReceivedProof = []"
              />
            </div>
          </div>
        </template>

        <template v-else>
          <div class="flex justify-end">
            <Button
              type="button"
              variant="outline"
              class="h-9"
              @click="applyDetailStatusToAllItems"
            >
              {{ t("applyStatusToAll") }}
            </Button>
          </div>
          <div
            v-for="row in detailItemStatuses"
            :key="row.id"
            class="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50/60 p-3"
          >
            <div class="line-clamp-2 text-sm font-medium">
              {{ displayLocalized(row.item_name) }}
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="space-y-2">
                <Label>{{ t("purchasingStatus") }}</Label>
                <Select
                  :model-value="row.status"
                  :items="itemStatusItems"
                  @update:model-value="(v) => (row.status = v)"
                >
                  <SelectTrigger class="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem
                        v-for="opt in itemStatusItems"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div class="space-y-2">
                <Label>{{ t("supplier") }}</Label>
                <Input v-model="row.supplier" class="h-11" />
              </div>
            </div>
            <div v-if="row.status === 'received'" class="space-y-3">
              <div class="space-y-2">
                <Label>{{ t("receivedNote") }}</Label>
                <Input v-model="row.received_note" class="h-11" />
              </div>
              <div class="space-y-2">
                <Label>{{ t("receivedProof") }}</Label>
                <UploadImage
                  v-model="row.receivedProofFile"
                  :existing-images="row.existingReceivedProof"
                  @existing-removed="
                    () => {
                      row.existingReceivedProof = [];
                      row.received_proof_image = null;
                    }
                  "
                />
              </div>
            </div>
          </div>
        </template>
      </div>

      <template #actions>
        <Button
          variant="outline"
          class="h-11 w-full"
          :disabled="savingDetailStatus"
          @click="backFromStatusEdit"
        >
          {{ t("back") }}
        </Button>
        <Button
          class="h-11 w-full"
          :loading="savingDetailStatus"
          @click="saveDetailStatus"
        >
          {{ t("updateStatus") }}
        </Button>
      </template>
    </Dialog>

    <ConfirmDialog
      :open="showDeleteModal"
      :title="t('areYouSureDeletePurchasing')"
      @update:open="(v) => (showDeleteModal = v)"
      @confirm="confirmDelete"
    />

    <Teleport to="body">
      <div
        v-if="previewImageUrl"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
        @click="previewImageUrl = null"
      >
        <button
          type="button"
          class="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white"
          @click="previewImageUrl = null"
        >
          <X class="h-5 w-5" />
        </button>
        <img
          :src="previewImageUrl"
          alt=""
          class="max-h-full max-w-full rounded-lg object-contain"
          @click.stop
        />
      </div>
    </Teleport>
  </AppShell>
</template>
