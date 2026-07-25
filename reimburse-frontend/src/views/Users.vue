<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { Pencil, Plus, Search, Trash2, Users } from "@lucide/vue";
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
import Select from "@/components/ui/Select.vue";
import SelectContent from "@/components/ui/SelectContent.vue";
import SelectGroup from "@/components/ui/SelectGroup.vue";
import SelectItem from "@/components/ui/SelectItem.vue";
import SelectTrigger from "@/components/ui/SelectTrigger.vue";
import SelectValue from "@/components/ui/SelectValue.vue";
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

const isManagement = computed(() => currentUser.value.role === "management");

const loading = ref(false);
const saving = ref(false);
const users = ref([]);
const search = ref("");
const showModal = ref(false);
const editingId = ref(null);
const showDeleteModal = ref(false);
const pendingDeleteUser = ref(null);
const deleting = ref(false);

const form = ref({
  email: "",
  name: "",
  role: "user",
  password: "",
  confirmPassword: "",
});

const roleItems = computed(() => [
  { label: t("roleUser"), value: "user" },
  { label: t("roleAdmin"), value: "admin" },
  { label: t("roleManagement"), value: "management" },
  { label: t("roleFinance"), value: "finance" },
]);

const filteredUsers = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return users.value;
  return users.value.filter(
    (user) =>
      user.email.toLowerCase().includes(q) ||
      (user.name || "").toLowerCase().includes(q) ||
      (user.role || "").toLowerCase().includes(q),
  );
});

const roleLabel = (role) => {
  const match = roleItems.value.find((item) => item.value === role);
  return match?.label || role;
};

const emptyForm = () => ({
  email: "",
  name: "",
  role: "user",
  password: "",
  confirmPassword: "",
});

const loadUsers = async () => {
  try {
    loading.value = true;
    const response = await api.getAdminUsers();
    if (response.success) {
      users.value = response.users;
    }
  } catch (error) {
    showToast(
      error.response?.data?.error || t("failedToLoadUsers"),
      "error",
    );
  } finally {
    loading.value = false;
  }
};

const openCreate = () => {
  editingId.value = null;
  form.value = emptyForm();
  showModal.value = true;
};

const openEdit = (user) => {
  editingId.value = user.id;
  form.value = {
    email: user.email,
    name: user.name || "",
    role: user.role || "user",
    password: "",
    confirmPassword: "",
  };
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  editingId.value = null;
  form.value = emptyForm();
};

const saveUser = async () => {
  if (!form.value.email.trim() || !/.+@.+\..+/.test(form.value.email)) {
    showToast(t("emailValid"), "error");
    return;
  }
  if (!form.value.name.trim()) {
    showToast(t("nameRequired"), "error");
    return;
  }
  if (!editingId.value && !form.value.password) {
    showToast(t("passwordRequired"), "error");
    return;
  }
  if (form.value.password) {
    if (form.value.password.length < 6) {
      showToast(t("passwordMinLength"), "error");
      return;
    }
    if (form.value.password !== form.value.confirmPassword) {
      showToast(t("passwordsMismatch"), "error");
      return;
    }
  }

  try {
    saving.value = true;
    const payload = {
      email: form.value.email.trim(),
      name: form.value.name.trim(),
      role: form.value.role,
    };
    if (form.value.password) payload.password = form.value.password;

    if (editingId.value) {
      await api.updateAdminUser(editingId.value, payload);
      showToast(t("userUpdated"), "success");
    } else {
      payload.password = form.value.password;
      await api.createAdminUser(payload);
      showToast(t("userCreated"), "success");
    }
    closeModal();
    await loadUsers();
  } catch (error) {
    showToast(
      error.response?.data?.error || t("failedToSaveUser"),
      "error",
    );
  } finally {
    saving.value = false;
  }
};

const deleteUser = (user) => {
  if (user.id === currentUser.value.id) {
    showToast(t("cannotDeleteSelf"), "error");
    return;
  }
  pendingDeleteUser.value = user;
  showDeleteModal.value = true;
};

const cancelDeleteUser = () => {
  showDeleteModal.value = false;
  pendingDeleteUser.value = null;
};

const confirmDeleteUser = async () => {
  if (!pendingDeleteUser.value) return;

  try {
    deleting.value = true;
    await api.deleteAdminUser(pendingDeleteUser.value.id);
    showDeleteModal.value = false;
    pendingDeleteUser.value = null;
    showToast(t("userDeleted"), "success");
    await loadUsers();
  } catch (error) {
    showToast(
      error.response?.data?.error || t("failedToDeleteUser"),
      "error",
    );
  } finally {
    deleting.value = false;
  }
};

onMounted(() => {
  if (!isManagement.value) {
    router.replace("/");
    return;
  }
  loadUsers();
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
        </div>
        <Button class="h-10" @click="openCreate">
          <Plus class="h-4 w-4" />
          {{ t("createUser") }}
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

      <div class="relative max-w-md">
        <Search
          class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400"
        />
        <Input
          v-model="search"
          class="h-11 pl-9"
          :placeholder="t('searchUsers')"
        />
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
                <th class="whitespace-nowrap px-4 py-3 font-medium text-neutral-500">
                  {{ t("role") }}
                </th>
                <th class="whitespace-nowrap px-4 py-3 font-medium text-neutral-500">
                  {{ t("createdAt") }}
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
                <td colspan="5" class="px-4 py-8 text-center text-neutral-500">
                  Loading…
                </td>
              </tr>
              <tr v-else-if="filteredUsers.length === 0">
                <td colspan="5" class="px-4 py-8 text-center text-neutral-500">
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
                <td class="whitespace-nowrap px-4 py-3">
                  {{ roleLabel(user.role) }}
                </td>
                <td class="whitespace-nowrap px-4 py-3 font-mono text-neutral-600">
                  {{
                    user.createdAt
                      ? new Date(user.createdAt).toLocaleDateString()
                      : "—"
                  }}
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-right">
                  <div class="inline-flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      @click="openEdit(user)"
                    >
                      <Pencil class="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      class="text-red-600 hover:bg-red-50 hover:text-red-700"
                      @click="deleteUser(user)"
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

    <Dialog
      :open="showModal"
      :title="editingId ? t('editUser') : t('createUser')"
      class="max-w-lg"
      @update:open="(v) => (v ? (showModal = true) : closeModal())"
    >
      <form id="user-form" class="space-y-4" @submit.prevent="saveUser">
        <div class="space-y-2">
          <Label for="user-name">{{ t("fullName") }}</Label>
          <Input id="user-name" v-model="form.name" required />
        </div>
        <div class="space-y-2">
          <Label for="user-email">{{ t("email") }}</Label>
          <Input id="user-email" v-model="form.email" type="email" required />
        </div>
        <div class="space-y-2">
          <Label>{{ t("role") }}</Label>
          <Select
            :model-value="form.role"
            :items="roleItems"
            @update:model-value="(v) => (form.role = v)"
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem
                  v-for="item in roleItems"
                  :key="item.value"
                  :value="item.value"
                >
                  {{ item.label }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <Label for="user-password">
              {{ t("password") }}
              <span v-if="editingId" class="font-normal text-neutral-400">
                ({{ t("passwordOptional") }})
              </span>
            </Label>
            <Input
              id="user-password"
              v-model="form.password"
              type="password"
              :required="!editingId"
            />
          </div>
          <div class="space-y-2">
            <Label for="user-confirm">{{ t("confirmPassword") }}</Label>
            <Input
              id="user-confirm"
              v-model="form.confirmPassword"
              type="password"
              :required="!editingId || !!form.password"
            />
          </div>
        </div>
      </form>
      <template #actions>
        <Button variant="outline" type="button" @click="closeModal">
          {{ t("cancel") }}
        </Button>
        <Button type="submit" form="user-form" class="h-11" :loading="saving">
          {{ editingId ? t("saveUser") : t("createUser") }}
        </Button>
      </template>
    </Dialog>

    <ConfirmDialog
      :open="showDeleteModal"
      :title="t('areYouSureDeleteUser')"
      :description="pendingDeleteUser?.email || ''"
      :loading="deleting"
      @update:open="(v) => !v && cancelDeleteUser()"
      @confirm="confirmDeleteUser"
      @cancel="cancelDeleteUser"
    />
  </AppShell>
</template>
