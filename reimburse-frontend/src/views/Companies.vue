<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { Building2, Plus, Search, Trash2, UserPlus } from "@lucide/vue";
import AppShell from "@/layouts/AppShell.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import { useI18n } from "@/composables/useI18n";
import { useToast } from "@/composables/useToast";
import api from "@/services/api";

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

const isSuperadmin = computed(() => currentUser.value.role === "superadmin");

const loading = ref(false);
const saving = ref(false);
const companies = ref([]);
const search = ref("");

const showCreateModal = ref(false);
const showBootstrapModal = ref(false);
const showDeleteModal = ref(false);
const pendingDelete = ref(null);
const bootstrapCompany = ref(null);
const deleting = ref(false);

const createForm = ref({ name: "", slug: "" });
const bootstrapForm = ref({
  managementEmail: "",
  managementName: "",
  managementPassword: "",
  financeEmail: "",
  financeName: "",
  financePassword: "",
});

const filteredCompanies = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return companies.value;
  return companies.value.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      (c.slug || "").toLowerCase().includes(q),
  );
});

const loadCompanies = async () => {
  try {
    loading.value = true;
    const response = await api.getCompanies();
    if (response.success) {
      companies.value = response.companies;
    }
  } catch (error) {
    showToast(
      error.response?.data?.error || t("failedToLoadCompanies"),
      "error",
    );
  } finally {
    loading.value = false;
  }
};

const openCreate = () => {
  createForm.value = { name: "", slug: "" };
  showCreateModal.value = true;
};

const openBootstrap = (company) => {
  bootstrapCompany.value = company;
  bootstrapForm.value = {
    managementEmail: "",
    managementName: "",
    managementPassword: "",
    financeEmail: "",
    financeName: "",
    financePassword: "",
  };
  showBootstrapModal.value = true;
};

const askDelete = (company) => {
  pendingDelete.value = company;
  showDeleteModal.value = true;
};

const saveCompany = async () => {
  if (!createForm.value.name.trim()) {
    showToast(t("companyNameRequired"), "error");
    return;
  }
  saving.value = true;
  try {
    const response = await api.createCompany({
      name: createForm.value.name.trim(),
      slug: createForm.value.slug.trim() || undefined,
    });
    if (response.success) {
      showToast(t("companyCreated"), "success");
      showCreateModal.value = false;
      await loadCompanies();
    }
  } catch (error) {
    showToast(
      error.response?.data?.error || t("failedToSaveCompany"),
      "error",
    );
  } finally {
    saving.value = false;
  }
};

const saveBootstrap = async () => {
  const f = bootstrapForm.value;
  if (
    !f.managementEmail ||
    !f.managementPassword ||
    !f.financeEmail ||
    !f.financePassword
  ) {
    showToast(t("bootstrapRequired"), "error");
    return;
  }
  saving.value = true;
  try {
    const response = await api.bootstrapCompany(bootstrapCompany.value.id, {
      management: {
        email: f.managementEmail.trim(),
        name: f.managementName.trim(),
        password: f.managementPassword,
      },
      finance: {
        email: f.financeEmail.trim(),
        name: f.financeName.trim(),
        password: f.financePassword,
      },
    });
    if (response.success) {
      showToast(t("companyBootstrapped"), "success");
      showBootstrapModal.value = false;
      await loadCompanies();
    }
  } catch (error) {
    showToast(
      error.response?.data?.error || t("failedToBootstrapCompany"),
      "error",
    );
  } finally {
    saving.value = false;
  }
};

const confirmDelete = async () => {
  if (!pendingDelete.value) return;
  deleting.value = true;
  try {
    const response = await api.deleteCompany(pendingDelete.value.id);
    if (response.success) {
      showToast(t("companyDeleted"), "success");
      showDeleteModal.value = false;
      pendingDelete.value = null;
      await loadCompanies();
    }
  } catch (error) {
    showToast(
      error.response?.data?.error || t("failedToDeleteCompany"),
      "error",
    );
  } finally {
    deleting.value = false;
  }
};

onMounted(() => {
  if (!isSuperadmin.value) {
    router.push("/");
    return;
  }
  loadCompanies();
});
</script>

<template>
  <AppShell>
    <div class="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-xl font-semibold tracking-tight">
            {{ t("companiesTitle") }}
          </h1>
          <p class="text-sm text-neutral-500">{{ t("companiesSubtitle") }}</p>
        </div>
        <Button type="button" class="gap-2" @click="openCreate">
          <Plus class="h-4 w-4" />
          {{ t("addCompany") }}
        </Button>
      </div>

      <Card>
        <CardHeader class="space-y-3">
          <CardTitle class="flex items-center gap-2 text-base">
            <Building2 class="h-4 w-4" />
            {{ t("companiesTitle") }}
          </CardTitle>
          <div class="relative">
            <Search
              class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            />
            <Input
              v-model="search"
              class="pl-9"
              :placeholder="t('searchCompanies')"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div v-if="loading" class="py-8 text-center text-sm text-neutral-500">
            ...
          </div>
          <div
            v-else-if="filteredCompanies.length === 0"
            class="py-8 text-center text-sm text-neutral-500"
          >
            {{ t("noCompanies") }}
          </div>
          <ul v-else class="divide-y divide-neutral-100">
            <li
              v-for="company in filteredCompanies"
              :key="company.id"
              class="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p class="font-medium">{{ company.name }}</p>
                <p class="text-sm text-neutral-500">
                  {{ company.slug }} · {{ company.userCount }}
                  {{ t("usersCount") }} · {{ company.categoryCount }}
                  {{ t("categoriesCount") }}
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  class="gap-1"
                  @click="openBootstrap(company)"
                >
                  <UserPlus class="h-3.5 w-3.5" />
                  {{ t("bootstrapAccounts") }}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  class="gap-1 text-red-600"
                  :disabled="company.slug === 'whtb'"
                  @click="askDelete(company)"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                  {{ t("delete") }}
                </Button>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>

    <Dialog
      :open="showCreateModal"
      :title="t('addCompany')"
      class="max-w-lg"
      @update:open="(v) => (showCreateModal = v)"
    >
      <form class="space-y-4" @submit.prevent="saveCompany">
        <div class="space-y-2">
          <Label>{{ t("companyName") }}</Label>
          <Input v-model="createForm.name" required />
        </div>
        <div class="space-y-2">
          <Label>{{ t("companySlug") }}</Label>
          <Input
            v-model="createForm.slug"
            :placeholder="t('companySlugHint')"
          />
        </div>
        <div class="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            @click="showCreateModal = false"
          >
            {{ t("cancel") }}
          </Button>
          <Button type="submit" :loading="saving">{{ t("save") }}</Button>
        </div>
      </form>
    </Dialog>

    <Dialog
      :open="showBootstrapModal"
      :title="t('bootstrapAccounts')"
      class="max-w-lg"
      @update:open="(v) => (showBootstrapModal = v)"
    >
      <form class="space-y-4" @submit.prevent="saveBootstrap">
        <p class="text-sm text-neutral-500">
          {{ bootstrapCompany?.name }}
        </p>
        <div class="space-y-3 rounded-lg border border-neutral-200 p-3">
          <p class="text-sm font-medium">{{ t("roleManagement") }}</p>
          <div class="space-y-2">
            <Label>{{ t("email") }}</Label>
            <Input v-model="bootstrapForm.managementEmail" type="email" required />
          </div>
          <div class="space-y-2">
            <Label>{{ t("name") }}</Label>
            <Input v-model="bootstrapForm.managementName" />
          </div>
          <div class="space-y-2">
            <Label>{{ t("password") }}</Label>
            <Input
              v-model="bootstrapForm.managementPassword"
              type="password"
              required
            />
          </div>
        </div>
        <div class="space-y-3 rounded-lg border border-neutral-200 p-3">
          <p class="text-sm font-medium">{{ t("roleFinance") }}</p>
          <div class="space-y-2">
            <Label>{{ t("email") }}</Label>
            <Input v-model="bootstrapForm.financeEmail" type="email" required />
          </div>
          <div class="space-y-2">
            <Label>{{ t("name") }}</Label>
            <Input v-model="bootstrapForm.financeName" />
          </div>
          <div class="space-y-2">
            <Label>{{ t("password") }}</Label>
            <Input
              v-model="bootstrapForm.financePassword"
              type="password"
              required
            />
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            @click="showBootstrapModal = false"
          >
            {{ t("cancel") }}
          </Button>
          <Button type="submit" :loading="saving">{{ t("save") }}</Button>
        </div>
      </form>
    </Dialog>

    <ConfirmDialog
      :open="showDeleteModal"
      :title="t('areYouSureDeleteCompany')"
      :description="pendingDelete?.name || ''"
      :loading="deleting"
      @update:open="(v) => !v && (showDeleteModal = false)"
      @confirm="confirmDelete"
      @cancel="showDeleteModal = false"
    />
  </AppShell>
</template>
