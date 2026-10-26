<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ChevronRight, FileText, Plus, Search, Trash2 } from "@lucide/vue";
import AppShell from "@/layouts/AppShell.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardDescription from "@/components/ui/CardDescription.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import DataSkeleton from "@/components/ui/DataSkeleton.vue";
import Input from "@/components/ui/Input.vue";
import PaginationBar from "@/components/ui/PaginationBar.vue";
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
import { formatLocaleDate } from "@/utils/formatters";

const router = useRouter();
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
const isManagement = computed(() => currentUser.value.role === "management");
const isFinance = computed(() => currentUser.value.role === "finance");
const isStakeholder = computed(() => currentUser.value.role === "stakeholder");
const isSuperadmin = computed(() => currentUser.value.role === "superadmin");
const canViewAllLists = computed(
  () =>
    isManagement.value ||
    isFinance.value ||
    isStakeholder.value ||
    isSuperadmin.value,
);
/** user / admin / management / finance — same create flow as a normal user (own lists). */
const canCreateLists = computed(() =>
  ["user", "admin", "management", "finance"].includes(
    currentUser.value.role,
  ),
);
const canDeleteLists = computed(
  () => !isStakeholder.value && !isSuperadmin.value,
);
/** Delete only own lists unless management (company-wide). */
const canDeleteList = (list) => {
  if (!canDeleteLists.value) return false;
  if (isManagement.value) return true;
  return Number(list?.userId) === Number(currentUser.value.id);
};
const listTableColspan = computed(() => {
  let cols = 3; // id + name + createdAt
  if (canViewAllLists.value) cols += 1;
  if (isSuperadmin.value) cols += 1;
  if (canDeleteLists.value) cols += 1;
  return cols;
});

const PAGE_SIZE = 20;
const loading = ref(false);
const lists = ref([]);
const total = ref(0);
const page = ref(1);
const loadError = ref("");
const newListName = ref("");
const search = ref("");
const companyFilter = ref("");
const showDeleteModal = ref(false);
const pendingDeleteList = ref(null);
const deleting = ref(false);
let searchTimer = null;
let loadSeq = 0;

const formatCreatedAt = (value) => formatLocaleDate(value, locale.value);

const loadLists = async () => {
  const seq = ++loadSeq;
  try {
    loading.value = true;
    loadError.value = "";
    const params = {
      page: page.value,
      pageSize: PAGE_SIZE,
    };
    const q = search.value.trim();
    if (q) params.q = q;
    if (isSuperadmin.value && companyFilter.value) {
      params.companyId = companyFilter.value;
    }
    const response = await api.getLists(params);
    if (seq !== loadSeq) return;
    if (!response.success) {
      loadError.value = t("failedToLoadLists");
      showToast(t("failedToLoadLists"), "error");
      return;
    }
    let rows = response.lists.map((list) => ({
      id: list.id,
      name: list.name,
      createdAt: list.createdAt,
      userId: list.userId,
      ownerName: list.ownerName,
      ownerEmail: list.ownerEmail,
      companyName: list.companyName,
      total: list.total,
    }));
    const serverTotal = Number(response.total);
    const serverPaged =
      Number.isFinite(serverTotal) && rows.length <= PAGE_SIZE && serverTotal >= rows.length;
    if (!serverPaged && rows.length > PAGE_SIZE) {
      const q = search.value.trim().toLowerCase();
      if (q) {
        rows = rows.filter((list) =>
          [list.id, list.name, list.ownerName, list.ownerEmail]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q),
        );
      }
      total.value = rows.length;
      const start = (page.value - 1) * PAGE_SIZE;
      lists.value = rows.slice(start, start + PAGE_SIZE);
    } else {
      total.value = Number.isFinite(serverTotal) ? serverTotal : rows.length;
      lists.value = rows;
    }
    const pages = Math.max(1, Math.ceil(total.value / PAGE_SIZE) || 1);
    if (page.value > pages) {
      page.value = pages;
      loading.value = false;
      return loadLists();
    }
  } catch {
    if (seq !== loadSeq) return;
    loadError.value = t("failedToLoadLists");
    showToast(t("failedToLoadLists"), "error");
  } finally {
    if (seq === loadSeq) loading.value = false;
  }
};

const scheduleSearch = () => {
  page.value = 1;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    loadLists();
  }, 250);
};

const clearListFilters = async () => {
  clearTimeout(searchTimer);
  search.value = "";
  companyFilter.value = "";
  page.value = 1;
  await loadLists();
};

const goToPage = (next) => {
  page.value = next;
  loadLists();
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
  if (!canDeleteList(list)) return;
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
      if (lists.value.length === 1 && page.value > 1) page.value -= 1;
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
                {{ total }}
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
        <div class="rounded-xl border border-neutral-200 bg-white p-4">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p class="text-sm font-medium text-neutral-900">{{ t("searchLists") }}</p>
            <Button
              v-if="search || companyFilter"
              type="button"
              size="sm"
              variant="ghost"
              @click="clearListFilters"
            >
              {{ t("clearFilters") }}
            </Button>
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
                    page = 1;
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
                @input="scheduleSearch"
              />
            </div>
          </div>
        </div>

        <div
          v-if="loadError && !loading"
          role="alert"
          class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <p>{{ loadError }}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            class="mt-2"
            @click="loadLists"
          >
            {{ t("retry") }}
          </Button>
        </div>

        <!-- Mobile: card list (shadcn Item-style rows) -->
        <div v-else class="space-y-3 md:hidden">
          <DataSkeleton v-if="loading" variant="cards" :rows="5" />
          <div
            v-else-if="lists.length === 0"
            class="rounded-xl border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-500"
          >
            {{ search || companyFilter ? t("noListsFiltered") : t("noLists") }}
          </div>
          <template v-else>
            <div
              v-for="list in lists"
              :key="list.id"
              class="flex w-full items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4 text-left transition-[transform,background-color] duration-150 ease-out active:scale-[0.99] active:bg-neutral-50"
              role="button"
              tabindex="0"
              @click="openList(list.id)"
              @keydown.enter.prevent="openList(list.id)"
            >
              <div class="min-w-0 flex-1 space-y-1.5">
                <p class="font-mono text-xs text-neutral-500">
                  #{{ list.id }}
                </p>
                <p class="truncate font-medium text-neutral-900">
                  {{ list.name }}
                </p>
                <p
                  v-if="isSuperadmin && list.companyName"
                  class="truncate text-sm text-neutral-600"
                >
                  {{ list.companyName }}
                </p>
                <div
                  v-if="canViewAllLists"
                  class="min-w-0 text-sm text-neutral-600"
                >
                  <span class="font-medium text-neutral-800">{{
                    list.ownerName || "—"
                  }}</span>
                  <span
                    v-if="list.ownerEmail"
                    class="mt-0.5 block truncate text-xs text-neutral-500"
                  >
                    {{ list.ownerEmail }}
                  </span>
                </div>
                <p class="font-mono text-xs text-neutral-500">
                  {{ formatCreatedAt(list.createdAt) }}
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <Button
                  v-if="canDeleteList(list)"
                  variant="ghost"
                  size="icon-sm"
                  class="text-red-600 hover:bg-red-50 hover:text-red-700"
                  :aria-label="t('deleteList')"
                  :title="t('deleteList')"
                  @click.stop="requestDeleteList(list)"
                >
                  <Trash2 class="h-4 w-4" aria-hidden="true" />
                  <span class="sr-only">{{ t("deleteList") }}</span>
                </Button>
                <ChevronRight class="h-4 w-4 text-neutral-400" />
              </div>
            </div>
          </template>
        </div>

        <!-- Desktop: table -->
        <DataSkeleton
          v-if="loading"
          class="hidden md:block"
          variant="table"
          :rows="6"
          :cols="listTableColspan"
        />
        <Card v-else-if="!loadError" class="hidden overflow-hidden p-0 md:block">
          <div class="overflow-x-auto">
            <table class="w-full min-w-max text-sm">
              <thead class="border-b border-neutral-200 bg-neutral-50">
                <tr class="text-left">
                  <th class="whitespace-nowrap px-4 py-3 font-medium text-neutral-500">
                    {{ t("listId") }}
                  </th>
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
                <tr v-if="lists.length === 0">
                  <td
                    :colspan="listTableColspan"
                    class="px-4 py-8 text-center text-neutral-500"
                  >
                    {{ search || companyFilter ? t("noListsFiltered") : t("noLists") }}
                  </td>
                </tr>
                <tr
                  v-for="list in lists"
                  :key="list.id"
                  class="cursor-pointer border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
                  @click="openList(list.id)"
                >
                  <td class="whitespace-nowrap px-4 py-3 font-mono text-neutral-600">
                    #{{ list.id }}
                  </td>
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
                    {{ formatCreatedAt(list.createdAt) }}
                  </td>
                  <td
                    v-if="canDeleteLists"
                    class="whitespace-nowrap px-4 py-3 text-right"
                  >
                    <Button
                      v-if="canDeleteList(list)"
                      variant="ghost"
                      size="icon-sm"
                      class="text-red-600 hover:bg-red-50 hover:text-red-700"
                      :aria-label="t('deleteList')"
                      :title="t('deleteList')"
                      @click.stop="requestDeleteList(list)"
                    >
                      <Trash2 class="h-4 w-4" aria-hidden="true" />
                      <span class="sr-only">{{ t("deleteList") }}</span>
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
        <PaginationBar
          v-if="!loading && !loadError"
          :page="page"
          :page-size="PAGE_SIZE"
          :total="total"
          :label="t('listsPagination')"
          @update:page="goToPage"
        />
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
            formatCreatedAt(pendingDeleteList.createdAt)
          }}</span>
        </div>
      </div>
    </ConfirmDialog>
  </AppShell>
</template>
