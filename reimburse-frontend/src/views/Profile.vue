<script setup>
import { computed, onMounted, ref } from "vue";
import { UserRound } from "@lucide/vue";
import AppShell from "@/layouts/AppShell.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardDescription from "@/components/ui/CardDescription.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import { useI18n } from "@/composables/useI18n";
import { useToast } from "@/composables/useToast";
import api from "@/services/api";

const { t } = useI18n();
const { showToast } = useToast();

const loading = ref(false);
const saving = ref(false);

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

const roleLabel = computed(() => {
  const match = roleItems.value.find((item) => item.value === form.value.role);
  return match?.label || form.value.role || t("roleUser");
});

const loadProfile = async () => {
  try {
    loading.value = true;
    const response = await api.getProfile();
    if (response.success) {
      form.value = {
        email: response.user.email || "",
        name: response.user.name || "",
        role: response.user.role || "user",
        password: "",
        confirmPassword: "",
      };
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem(
        "user",
        JSON.stringify({
          ...stored,
          id: response.user.id,
          email: response.user.email,
          name: response.user.name,
          role: response.user.role,
        }),
      );
    }
  } catch (error) {
    showToast(
      error.response?.data?.error || t("failedToLoadProfile"),
      "error",
    );
  } finally {
    loading.value = false;
  }
};

const saveProfile = async () => {
  if (!form.value.email.trim()) {
    showToast(t("emailRequired"), "error");
    return;
  }
  if (!/.+@.+\..+/.test(form.value.email)) {
    showToast(t("emailValid"), "error");
    return;
  }
  if (!form.value.name.trim()) {
    showToast(t("nameRequired"), "error");
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
    };
    if (form.value.password) {
      payload.password = form.value.password;
    }

    const response = await api.updateProfile(payload);
    if (response.success) {
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem(
        "user",
        JSON.stringify({
          ...stored,
          ...response.user,
        }),
      );
      form.value.password = "";
      form.value.confirmPassword = "";
      showToast(t("profileUpdated"), "success");
    }
  } catch (error) {
    showToast(
      error.response?.data?.error || t("failedToUpdateProfile"),
      "error",
    );
  } finally {
    saving.value = false;
  }
};

onMounted(loadProfile);
</script>

<template>
  <AppShell>
    <div class="mx-auto max-w-2xl space-y-5">
      <div class="flex flex-col gap-1">
        <h1 class="text-2xl font-semibold text-neutral-900">
          {{ t("navProfile") }}
        </h1>
        <p class="text-sm text-neutral-500">{{ t("profileSubtitle") }}</p>
      </div>

      <Card>
        <CardHeader>
          <div class="mb-1 flex items-center gap-2">
            <div class="rounded-lg bg-neutral-100 p-2">
              <UserRound class="h-4 w-4 text-neutral-700" />
            </div>
            <CardTitle>{{ t("profileDetails") }}</CardTitle>
          </div>
          <CardDescription>{{ t("profileSubtitle") }}</CardDescription>
        </CardHeader>
        <CardContent>
          <form class="space-y-4" @submit.prevent="saveProfile">
            <div class="space-y-2">
              <Label for="profile-email">{{ t("email") }}</Label>
              <Input
                id="profile-email"
                v-model="form.email"
                type="email"
                :disabled="loading || saving"
                required
              />
            </div>

            <div class="space-y-2">
              <Label for="profile-name">{{ t("fullName") }}</Label>
              <Input
                id="profile-name"
                v-model="form.name"
                :disabled="loading || saving"
                required
              />
            </div>

            <div class="space-y-2">
              <Label for="profile-role">{{ t("role") }}</Label>
              <Input
                id="profile-role"
                :model-value="roleLabel"
                disabled
              />
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <Label for="profile-password">
                  {{ t("password") }}
                  <span class="font-normal text-neutral-400">
                    ({{ t("passwordOptional") }})
                  </span>
                </Label>
                <Input
                  id="profile-password"
                  v-model="form.password"
                  type="password"
                  autocomplete="new-password"
                  :disabled="loading || saving"
                  :placeholder="t('passwordOptional')"
                />
              </div>
              <div class="space-y-2">
                <Label for="profile-confirm">{{ t("confirmPassword") }}</Label>
                <Input
                  id="profile-confirm"
                  v-model="form.confirmPassword"
                  type="password"
                  autocomplete="new-password"
                  :disabled="loading || saving"
                />
              </div>
            </div>

            <div class="flex justify-end pt-2">
              <Button type="submit" class="h-11" :loading="saving || loading">
                {{ t("saveProfile") }}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  </AppShell>
</template>
