<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ExternalLink, Search, Users } from "@lucide/vue";
import AppShell from "@/layouts/AppShell.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import DataSkeleton from "@/components/ui/DataSkeleton.vue";
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

const router = useRouter();
const { t } = useI18n();
const { showToast } = useToast();
const { companyFilterItems, loadCompanies } = useCompanies();

const currentUser = computed(() => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
});

const isManagement = computed(() => currentUser.value.role === "management");
const isStakeholder = computed(() => currentUser.value.role === "stakeholder");
const isSuperadmin = computed(() => currentUser.value.role === "superadmin");
const canManageUsers = computed(
  () => isManagement.value || isSuperadmin.value,
);

const canViewUsers = computed(
  () => isManagement.value || isStakeholder.value || isSuperadmin.value,
);

const loading = ref(false);
const users = ref([]);
const search = ref("");
const companyFilter = ref("");

const roleItems = computed(() => [
  { label: t("roleUser"), value: "user" },
  { label: t("roleAdmin"), value: "admin" },
  { label: t("roleManagement"), value: "management" },
  { label: t("roleFinance"), value: "finance" },
  { label: t("roleStakeholder"), value: "stakeholder" },
]);

const filteredUsers = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return users.value;
  return users.value.filter(
    (user) =>
      user.email.toLowerCase().includes(q) ||
      (user.name || "").toLowerCase().includes(q) ||
      (user.role || "").toLowerCase().includes(q) ||
      (user.company_name || "").toLowerCase().includes(q),
  );
});

const roleLabel = (role) => {
  const match = roleItems.value.find((item) => item.value === role);
  return match?.label || role;
};

const colCount = computed(() => (isSuperadmin.value ? 6 : 5));

const loadUsers = async () => {
  try {
    loading.value = true;
    const params = {};
    if (isSuperadmin.value && companyFilter.value) {
      params.companyId = companyFilter.value;
    }
    const response = await api.getAdminUsers(params);
    users.value = response.users || [];
  } catch (error) {
    showToast(error.response?.data?.error || t("failedToLoadUsers"), "error");
  } finally {
    loading.value = false;
  }
};

const openConsole = () => {
  window.open("https://admin.whtb.glass", "_blank", "noopener,noreferrer");
};

onMounted(async () => {
  if (!canViewUsers.value) {
    router.replace("/");
    return;
  }
  if (isSuperadmin.value) {
    await loadCompanies();
  }
  await loadUsers();
});
</script>

<template>
  <AppShell>
    <div class="space-y-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-neutral-900">
            {{ t("navUsers") }}
          </h1>
          <p class="text-sm text-neutral-500">{{ t("usersSubtitle") }}</p>
          <p class="mt-2 text-sm text-neutral-600">
            {{ t("usersReadOnlyHint") }}
            <a
              class="font-medium text-neutral-900 underline underline-offset-2"
              href="https://admin.whtb.glass"
              target="_blank"
              rel="noopener noreferrer"
            >admin.whtb.glass</a>.
          </p>
        </div>
        <Button
          v-if="canManageUsers"
          variant="outline"
          class="h-10 gap-2"
          @click="openConsole"
        >
          <ExternalLink class="h-4 w-4" />
          {{ t("openPlatformConsole") }}
        </Button>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent class="flex items-center gap-3 p-5">
            <div class="rounded-lg bg-neutral-100 p-3">
              <Users class="h-5 w-5 text-neutral-700" />
            </div>
            <div>
              <div class="text-xs text-neutral-500">{{ t("usersCount") }}</div>
              <div class="font-mono text-xl font-semibold">
                {{ users.length }}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
                await loadUsers();
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
            :placeholder="t('searchUsers')"
          />
        </div>
      </div>

      <Card class="overflow-hidden p-0">
        <div class="overflow-x-auto">
          <table class="w-full min-w-max text-sm">
            <thead class="border-b border-neutral-200 bg-neutral-50">
              <tr class="text-left">
                <th class="whitespace-nowrap px-4 py-3 font-medium text-neutral-500">
                  {{ t("fullName") }}
                </th>
                <th class="whitespace-nowrap px-4 py-3 font-medium text-neutral-500">
                  {{ t("email") }}
                </th>
                <th
                  v-if="isSuperadmin"
                  class="whitespace-nowrap px-4 py-3 font-medium text-neutral-500"
                >
                  {{ t("filterCompany") }}
                </th>
                <th class="whitespace-nowrap px-4 py-3 font-medium text-neutral-500">
                  {{ t("role") }}
                </th>
                <th class="whitespace-nowrap px-4 py-3 font-medium text-neutral-500">
                  {{ t("purchasingEditor") }}
                </th>
                <th class="whitespace-nowrap px-4 py-3 font-medium text-neutral-500">
                  {{ t("createdAt") }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td :colspan="colCount" class="p-0">
                  <DataSkeleton variant="table" :rows="6" :cols="colCount" />
                </td>
              </tr>
              <tr v-else-if="filteredUsers.length === 0">
                <td
                  :colspan="colCount"
                  class="px-4 py-8 text-center text-neutral-500"
                >
                  {{ t("noUsers") }}
                </td>
              </tr>
              <tr
                v-for="user in filteredUsers"
                :key="user.id"
                class="border-b border-neutral-100 last:border-0"
              >
                <td class="whitespace-nowrap px-4 py-3 font-medium">
                  {{ user.name || "—" }}
                </td>
                <td class="whitespace-nowrap px-4 py-3">{{ user.email }}</td>
                <td
                  v-if="isSuperadmin"
                  class="whitespace-nowrap px-4 py-3 text-neutral-600"
                >
                  {{ user.company_name || "—" }}
                </td>
                <td class="whitespace-nowrap px-4 py-3">
                  {{ roleLabel(user.role) }}
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-neutral-600">
                  {{
                    user.role === "finance" ||
                    user.role === "management" ||
                    user.role === "admin" ||
                    user.role === "stakeholder"
                      ? t("purchasingFeatureOn")
                      : user.purchasing_editor
                        ? t("purchasingFeatureOn")
                        : t("purchasingFeatureOff")
                  }}
                </td>
                <td class="whitespace-nowrap px-4 py-3 font-mono text-neutral-600">
                  {{
                    user.createdAt
                      ? new Date(user.createdAt).toLocaleDateString()
                      : "—"
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  </AppShell>
</template>
