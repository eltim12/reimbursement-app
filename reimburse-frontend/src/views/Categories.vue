<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { Pencil, Plus, Search, Tags, Trash2 } from "@lucide/vue";
import AppShell from "@/layouts/AppShell.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Field from "@/components/ui/Field.vue";
import FieldDescription from "@/components/ui/FieldDescription.vue";
import FieldLabel from "@/components/ui/FieldLabel.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";
import SelectContent from "@/components/ui/SelectContent.vue";
import SelectGroup from "@/components/ui/SelectGroup.vue";
import SelectItem from "@/components/ui/SelectItem.vue";
import SelectTrigger from "@/components/ui/SelectTrigger.vue";
import SelectValue from "@/components/ui/SelectValue.vue";
import { useCategories } from "@/composables/useCategories";
import { useCompanies } from "@/composables/useCompanies";
import { useI18n } from "@/composables/useI18n";
import { useToast } from "@/composables/useToast";
import api from "@/services/api";

const router = useRouter();
const { t, locale } = useI18n();
const { showToast } = useToast();
const { loadCategories, getCategoryLabel } = useCategories();
const { companyFilterItems, loadCompanies } = useCompanies();

const currentUser = computed(() => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
});

const isSuperadmin = computed(() => currentUser.value.role === "superadmin");
const isStakeholder = computed(() => currentUser.value.role === "stakeholder");
const canAccess = computed(
  () =>
    isSuperadmin.value ||
    ["management", "finance", "admin", "stakeholder"].includes(
      currentUser.value.role,
    ),
);
const canManage = computed(
  () =>
    isSuperadmin.value ||
    ["management", "finance", "admin"].includes(currentUser.value.role),
);

const loading = ref(false);
const saving = ref(false);
const categories = ref([]);
const search = ref("");
const companyFilter = ref("");
const showModal = ref(false);
const editingId = ref(null);
const showDeleteModal = ref(false);
const pendingDelete = ref(null);
const deleting = ref(false);

const form = ref({ name_id: "", name_zh: "" });
const formErrors = ref({ name_id: "", name_zh: "" });

const filteredCategories = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return categories.value;
  return categories.value.filter(
    (c) =>
      c.name_id.toLowerCase().includes(q) ||
      c.name_zh.toLowerCase().includes(q) ||
      (c.company_name || "").toLowerCase().includes(q),
  );
});

const emptyForm = () => ({ name_id: "", name_zh: "" });

const load = async () => {
  try {
    loading.value = true;
    const params = {};
    if (isSuperadmin.value && companyFilter.value) {
      params.companyId = companyFilter.value;
    }
    const response = await api.getCategories(params);
    if (response.success) {
      categories.value = response.categories || [];
      await loadCategories(true, companyFilter.value || undefined);
    }
  } catch (error) {
    showToast(
      error.response?.data?.error || t("failedToLoadCategories"),
      "error",
    );
  } finally {
    loading.value = false;
  }
};

const openCreate = () => {
  editingId.value = null;
  form.value = emptyForm();
  formErrors.value = emptyForm();
  showModal.value = true;
};

const openEdit = (category) => {
  editingId.value = category.id;
  form.value = {
    name_id: category.name_id,
    name_zh: category.name_zh,
  };
  formErrors.value = emptyForm();
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  editingId.value = null;
  form.value = emptyForm();
  formErrors.value = emptyForm();
};

const validateForm = () => {
  formErrors.value = emptyForm();
  let ok = true;
  if (!form.value.name_id.trim()) {
    formErrors.value.name_id = t("categoryNameIdRequired");
    ok = false;
  }
  if (!form.value.name_zh.trim()) {
    formErrors.value.name_zh = t("categoryNameZhRequired");
    ok = false;
  }
  return ok;
};

const saveCategory = async () => {
  if (!validateForm()) return;
  if (isSuperadmin.value && !companyFilter.value && !editingId.value) {
    showToast(t("selectCompanyFirst"), "error");
    return;
  }

  try {
    saving.value = true;
    const payload = {
      name_id: form.value.name_id.trim(),
      name_zh: form.value.name_zh.trim(),
    };
    if (isSuperadmin.value && companyFilter.value) {
      payload.company_id = Number(companyFilter.value);
    }

    if (editingId.value) {
      const response = await api.updateCategory(editingId.value, payload);
      if (!response.success) throw new Error("failed");
      showToast(t("categoryUpdated"), "success");
    } else {
      const response = await api.createCategory(payload);
      if (!response.success) throw new Error("failed");
      showToast(t("categoryCreated"), "success");
    }

    closeModal();
    await load();
  } catch (error) {
    showToast(
      error.response?.data?.error || t("failedToSaveCategory"),
      "error",
    );
  } finally {
    saving.value = false;
  }
};

const requestDelete = (category) => {
  pendingDelete.value = category;
  showDeleteModal.value = true;
};

const cancelDelete = () => {
  pendingDelete.value = null;
  showDeleteModal.value = false;
};

const confirmDelete = async () => {
  if (!pendingDelete.value) return;
  try {
    deleting.value = true;
    const response = await api.deleteCategory(pendingDelete.value.id);
    if (!response.success) throw new Error("failed");
    showToast(t("categoryDeleted"), "success");
    cancelDelete();
    await load();
  } catch (error) {
    showToast(
      error.response?.data?.error || t("failedToDeleteCategory"),
      "error",
    );
  } finally {
    deleting.value = false;
  }
};

onMounted(async () => {
  if (!canAccess.value) {
    router.replace("/");
    return;
  }
  if (isSuperadmin.value) {
    await loadCompanies();
  }
  await load();
});
</script>

<template>
  <AppShell>
    <div class="space-y-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-neutral-900">
            {{ t("categoriesTitle") }}
          </h1>
          <p class="text-sm text-neutral-500">{{ t("categoriesSubtitle") }}</p>
        </div>
        <Button v-if="canManage" class="h-11" @click="openCreate">
          <Plus class="h-4 w-4" />
          {{ t("addCategory") }}
        </Button>
      </div>

      <Card>
        <CardContent class="space-y-4 p-5">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div v-if="isSuperadmin" class="w-full max-w-md space-y-2">
              <Label>{{ t("filterCompany") }}</Label>
              <Select
                :model-value="companyFilter"
                :items="companyFilterItems"
                :placeholder="t('filterAllCompanies')"
                @update:model-value="
                  async (v) => {
                    companyFilter = v ?? '';
                    await load();
                  }
                "
              >
                <SelectTrigger class="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem
                      v-for="item in companyFilterItems"
                      :key="item.value || 'all-companies'"
                      :value="item.value"
                    >
                      {{ item.label }}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div class="relative w-full max-w-md">
              <Search
                class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400"
              />
              <Input
                v-model="search"
                class="h-11 pl-9"
                :placeholder="t('searchCategories')"
              />
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full min-w-max text-sm">
              <thead class="border-b border-neutral-200 bg-neutral-50">
                <tr class="text-left">
                  <th
                    v-if="isSuperadmin"
                    class="px-4 py-3 font-medium text-neutral-500"
                  >
                    {{ t("filterCompany") }}
                  </th>
                  <th class="px-4 py-3 font-medium text-neutral-500">
                    {{ t("categoryNameId") }}
                  </th>
                  <th class="px-4 py-3 font-medium text-neutral-500">
                    {{ t("categoryNameZh") }}
                  </th>
                  <th class="px-4 py-3 font-medium text-neutral-500">
                    {{ t("categoryPreview") }}
                  </th>
                  <th
                    v-if="canManage"
                    class="px-4 py-3 text-right font-medium text-neutral-500"
                  >
                    {{ t("tableAction") }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loading">
                  <td
                    :colspan="isSuperadmin ? 5 : 4"
                    class="px-4 py-8 text-center text-neutral-500"
                  >
                    Loading…
                  </td>
                </tr>
                <tr v-else-if="filteredCategories.length === 0">
                  <td
                    :colspan="isSuperadmin ? 5 : 4"
                    class="px-4 py-8 text-center text-neutral-500"
                  >
                    <div class="inline-flex items-center gap-2">
                      <Tags class="h-4 w-4" />
                      {{ t("noCategories") }}
                    </div>
                  </td>
                </tr>
                <tr
                  v-for="category in filteredCategories"
                  :key="category.id"
                  class="border-b border-neutral-100 last:border-0"
                >
                  <td
                    v-if="isSuperadmin"
                    class="whitespace-nowrap px-4 py-3 text-neutral-600"
                  >
                    {{ category.company_name || "—" }}
                  </td>
                  <td class="px-4 py-3 font-medium text-neutral-900">
                    {{ category.name_id }}
                  </td>
                  <td class="px-4 py-3 text-neutral-700">
                    {{ category.name_zh }}
                  </td>
                  <td class="px-4 py-3 text-neutral-500">
                    {{ getCategoryLabel(category.value) }}
                    <span class="text-xs text-neutral-400">
                      ({{ locale === "zh" ? "ZH" : "ID" }})
                    </span>
                  </td>
                  <td v-if="canManage" class="px-4 py-3">
                    <div class="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        class="h-9"
                        @click="openEdit(category)"
                      >
                        <Pencil class="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        class="h-9 text-red-600 hover:bg-red-50"
                        @click="requestDelete(category)"
                      >
                        <Trash2 class="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>

    <Dialog
      :open="showModal"
      :title="editingId ? t('editCategory') : t('addCategory')"
      class="max-w-lg"
      actions-class="grid w-full grid-cols-2 gap-2"
      @update:open="(v) => !v && closeModal()"
    >
      <form class="space-y-4" @submit.prevent="saveCategory">
        <Field :invalid="!!formErrors.name_id">
          <FieldLabel for="cat-id">{{ t("categoryNameId") }}</FieldLabel>
          <Input
            id="cat-id"
            v-model="form.name_id"
            :placeholder="t('categoryNameIdPlaceholder')"
            :aria-invalid="!!formErrors.name_id"
            @update:model-value="formErrors.name_id = ''"
          />
          <FieldDescription v-if="formErrors.name_id">
            {{ formErrors.name_id }}
          </FieldDescription>
        </Field>
        <Field :invalid="!!formErrors.name_zh">
          <FieldLabel for="cat-zh">{{ t("categoryNameZh") }}</FieldLabel>
          <Input
            id="cat-zh"
            v-model="form.name_zh"
            :placeholder="t('categoryNameZhPlaceholder')"
            :aria-invalid="!!formErrors.name_zh"
            @update:model-value="formErrors.name_zh = ''"
          />
          <FieldDescription v-if="formErrors.name_zh">
            {{ formErrors.name_zh }}
          </FieldDescription>
        </Field>
      </form>
      <template #actions>
        <Button variant="outline" class="h-11 w-full" @click="closeModal">
          {{ t("cancel") }}
        </Button>
        <Button class="h-11 w-full" :loading="saving" @click="saveCategory">
          {{ t("save") }}
        </Button>
      </template>
    </Dialog>

    <ConfirmDialog
      :open="showDeleteModal"
      :title="t('areYouSureDeleteCategory')"
      :loading="deleting"
      @update:open="(v) => !v && cancelDelete()"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    >
      <p v-if="pendingDelete" class="text-sm text-neutral-600">
        {{ pendingDelete.name_id }} / {{ pendingDelete.name_zh }}
      </p>
    </ConfirmDialog>
  </AppShell>
</template>
