<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { FileText, Plus, Search, Trash2 } from "@lucide/vue";
import AppShell from "@/layouts/AppShell.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardDescription from "@/components/ui/CardDescription.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";
import SelectContent from "@/components/ui/SelectContent.vue";
import SelectGroup from "@/components/ui/SelectGroup.vue";
import SelectItem from "@/components/ui/SelectItem.vue";
import SelectTrigger from "@/components/ui/SelectTrigger.vue";
import SelectValue from "@/components/ui/SelectValue.vue";
import { useI18n } from "@/composables/useI18n";
import { useCompanies } from "@/composables/useCompanies";
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
const isFinance = computed(() => currentUser.value.role === "finance");
const isSuperadmin = computed(() => currentUser.value.role === "superadmin");
const canViewAllLists = computed(
  () => isManagement.value || isFinance.value || isSuperadmin.value,
);
const canCreateLists = computed(
  () => !isManagement.value && !isFinance.value && !isSuperadmin.value,
);
const canDeleteLists = computed(() => !isFinance.value);
const listTableColspan = computed(() => {
  let cols = 2; // name + createdAt
  if (canViewAllLists.value) cols += 1;
  if (isSuperadmin.value) cols += 1;
  if (canDeleteLists.value) cols += 1;
  return cols;
});

const loading = ref(false);
const lists = ref([]);
const newListName = ref("");
const search = ref("");
const companyFilter = ref("");
const showDeleteModal = ref(false);
const pendingDeleteList = ref(null);
const deleting = ref(false);

const filteredLists = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return lists.value;
  return lists.value.filter((list) => {
    const haystack = [
      list.name,
      list.ownerName,
      list.ownerEmail,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
});

const loadLists = async () => {
  try {
    loading.value = true;
    const params = {};
    if (isSuperadmin.value && companyFilter.value) {
      params.companyId = companyFilter.value;
    }
    const response = await api.getLists(params);
    if (response.success) {
      lists.value = response.lists
        .map((list) => ({
          id: list.id,
          name: list.name,
          createdAt: list.createdAt,
          ownerName: list.ownerName,
          ownerEmail: list.ownerEmail,
          companyName: list.companyName,
          total: list.total,
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  } catch {
    showToast(t("failedToLoadLists"), "error");
  } finally {
    loading.value = false;
  }
};

const createList = async () => {
  if (!canCreateLists.value) return;

  if (!newListName.value.trim()) {
    showToast(t("pleaseEnterListName"), "error");
    return;
  }

  try {
    loading.value = true;
    const response = await api.createList(newListName.value.trim());
    if (response.success) {
      showToast(`${t("createdNewList")}: ${response.list.name}`, "success");
      newListName.value = "";
      await router.push(`/lists/${response.list.id}`);
    }
  } catch {
    showToast(t("failedToCreateList"), "error");
  } finally {
    loading.value = false;
  }
};

const openList = (id) => {
  router.push(`/lists/${id}`);
};

const requestDeleteList = (list) => {
  pendingDeleteList.value = list;
  showDeleteModal.value = true;
};

const cancelDeleteList = () => {
  showDeleteModal.value = false;
  pendingDeleteList.value = null;
};

const confirmDeleteList = async () => {
  if (!pendingDeleteList.value?.id) return;

  try {
    deleting.value = true;
    const response = await api.deleteList(pendingDeleteList.value.id);
    if (response.success) {
      showDeleteModal.value = false;
      pendingDeleteList.value = null;
      await loadLists();
      showToast(t("listDeleted"), "success");
    }
  } catch {
    showToast(t("failedToDeleteList"), "error");
  } finally {
    deleting.value = false;
  }
};

onMounted(async () => {
  if (isSuperadmin.value) {
    await loadCompanies();
  }
  await loadLists();
});
</script>

<template>
  <AppShell>
    <div class="space-y-5">
      <div class="flex flex-col gap-1">
        <h1 class="text-2xl font-semibold text-neutral-900">
          {{ t("listsTitle") }}
        </h1>
        <p class="text-sm text-neutral-500">{{ t("listsSubtitle") }}</p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent class="flex items-center gap-3 p-5">
            <div class="rounded-lg bg-neutral-100 p-3">
              <FileText class="h-5 w-5 text-neutral-700" />
            </div>
            <div>
              <div class="text-xs text-neutral-500">{{ t("listsCount") }}</div>
              <div class="font-mono text-xl font-semibold">
                {{ lists.length }}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card v-if="canCreateLists">
        <CardHeader>
          <CardTitle>{{ t("createNewList") }}</CardTitle>
          <CardDescription>{{ t("newListName") }}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            class="flex flex-col gap-3 sm:flex-row sm:items-end"
            @submit.prevent="createList"
          >
            <div class="w-full space-y-2 sm:flex-1">
              <Label for="new-list">{{ t("newListName") }}</Label>
              <Input
                id="new-list"
                v-model="newListName"
                :placeholder="t('newListName')"
              />
            </div>
            <Button type="submit" :loading="loading" class="h-11 shrink-0">
              <Plus class="h-4 w-4" />
              {{ t("createNewList") }}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div class="space-y-3">
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
                  await loadLists();
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
              :placeholder="t('searchLists')"
            />
          </div>
        </div>

        <Card class="overflow-hidden p-0">
          <div class="overflow-x-auto">
            <table class="w-full min-w-max text-sm">
              <thead class="border-b border-neutral-200 bg-neutral-50">
                <tr class="text-left">
                  <th class="whitespace-nowrap px-4 py-3 font-medium text-neutral-500">
                    {{ t("newListName") }}
                  </th>
                  <th
                    v-if="isSuperadmin"
                    class="whitespace-nowrap px-4 py-3 font-medium text-neutral-500"
                  >
                    {{ t("filterCompany") }}
                  </th>
                  <th
                    v-if="canViewAllLists"
                    class="whitespace-nowrap px-4 py-3 font-medium text-neutral-500"
                  >
                    {{ t("listOwner") }}
                  </th>
                  <th class="whitespace-nowrap px-4 py-3 font-medium text-neutral-500">
                    {{ t("createdAt") }}
                  </th>
                  <th
                    v-if="canDeleteLists"
                    class="whitespace-nowrap px-4 py-3 text-right font-medium text-neutral-500"
                  >
                    {{ t("tableAction") }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loading">
                  <td
                    :colspan="listTableColspan"
                    class="px-4 py-8 text-center text-neutral-500"
                  >
                    Loading…
                  </td>
                </tr>
                <tr v-else-if="filteredLists.length === 0">
                  <td
                    :colspan="listTableColspan"
                    class="px-4 py-8 text-center text-neutral-500"
                  >
                    {{ t("noLists") }}
                  </td>
                </tr>
                <tr
                  v-for="list in filteredLists"
                  :key="list.id"
                  class="cursor-pointer border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
                  @click="openList(list.id)"
                >
                  <td class="whitespace-nowrap px-4 py-3 font-medium text-neutral-900">
                    {{ list.name }}
                  </td>
                  <td
                    v-if="isSuperadmin"
                    class="whitespace-nowrap px-4 py-3 text-neutral-600"
                  >
                    {{ list.companyName || "—" }}
                  </td>
                  <td
                    v-if="canViewAllLists"
                    class="whitespace-nowrap px-4 py-3 text-neutral-600"
                  >
                    <div class="font-medium text-neutral-900">
                      {{ list.ownerName || "—" }}
                    </div>
                    <div class="text-xs text-neutral-500">
                      {{ list.ownerEmail || "" }}
                    </div>
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 font-mono text-neutral-600">
                    {{ new Date(list.createdAt).toLocaleDateString() }}
                  </td>
                  <td
                    v-if="canDeleteLists"
                    class="whitespace-nowrap px-4 py-3 text-right"
                  >
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      class="text-red-600 hover:bg-red-50 hover:text-red-700"
                      @click.stop="requestDeleteList(list)"
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

    <ConfirmDialog
      :open="showDeleteModal"
      :title="t('deleteList')"
      :description="t('areYouSureDeleteList')"
      :loading="deleting"
      @update:open="(v) => !v && cancelDeleteList()"
      @confirm="confirmDeleteList"
      @cancel="cancelDeleteList"
    >
      <div v-if="pendingDeleteList" class="space-y-2 text-sm">
        <div class="flex justify-between gap-4">
          <span class="text-neutral-500">{{ t("newListName") }}</span>
          <span class="font-medium text-right">{{ pendingDeleteList.name }}</span>
        </div>
        <div
          v-if="canViewAllLists && (pendingDeleteList.ownerName || pendingDeleteList.ownerEmail)"
          class="flex justify-between gap-4"
        >
          <span class="text-neutral-500">{{ t("listOwner") }}</span>
          <span class="text-right">
            <span class="block font-medium">{{
              pendingDeleteList.ownerName || "—"
            }}</span>
            <span
              v-if="pendingDeleteList.ownerEmail"
              class="block text-xs text-neutral-500"
            >
              {{ pendingDeleteList.ownerEmail }}
            </span>
          </span>
        </div>
        <div class="flex justify-between gap-4">
          <span class="text-neutral-500">{{ t("createdAt") }}</span>
          <span class="font-mono font-medium">{{
            new Date(pendingDeleteList.createdAt).toLocaleDateString()
          }}</span>
        </div>
      </div>
    </ConfirmDialog>
  </AppShell>
</template>
