<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { Receipt } from "@lucide/vue";
import LangToggle from "@/components/LangToggle.vue";
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

const router = useRouter();
const { t } = useI18n();
const { showToast } = useToast();

const name = ref("");
const email = ref("");
const password = ref("");
const confirmPassword = ref("");
const loading = ref(false);

const handleRegister = async () => {
  if (!name.value.trim()) {
    showToast(t("nameRequired"), "error");
    return;
  }
  if (!email.value || !/.+@.+\..+/.test(email.value)) {
    showToast(t("emailValid"), "error");
    return;
  }
  if (!password.value || password.value.length < 6) {
    showToast(t("passwordMinLength"), "error");
    return;
  }
  if (password.value !== confirmPassword.value) {
    showToast(t("passwordsMismatch"), "error");
    return;
  }

  loading.value = true;
  try {
    const response = await api.register(
      email.value,
      password.value,
      name.value,
    );
    if (response.success) {
      showToast("Account created! Please login.", "success");
      setTimeout(() => router.push("/login"), 1000);
    }
  } catch (error) {
    showToast(error.response?.data?.error || "Registration failed", "error");
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <div class="mb-2 flex items-center justify-between">
          <span class="flex items-center gap-2 text-sm font-medium text-neutral-500">
            <Receipt class="h-4 w-4" />
            {{ t("appTitle") }}
          </span>
          <LangToggle />
        </div>
        <CardTitle class="text-2xl">{{ t("createAccount") }}</CardTitle>
        <CardDescription>{{ t("joinUsSubtitle") }}</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="handleRegister">
          <div class="space-y-2">
            <Label for="name">{{ t("name") }}</Label>
            <Input id="name" v-model="name" required />
          </div>
          <div class="space-y-2">
            <Label for="email">{{ t("email") }}</Label>
            <Input id="email" v-model="email" type="email" required />
          </div>
          <div class="space-y-2">
            <Label for="password">{{ t("password") }}</Label>
            <Input id="password" v-model="password" type="password" required />
          </div>
          <div class="space-y-2">
            <Label for="confirm">{{ t("confirmPassword") }}</Label>
            <Input
              id="confirm"
              v-model="confirmPassword"
              type="password"
              required
            />
          </div>
          <Button type="submit" class="h-11 w-full" :loading="loading">
            {{ t("signUp") }}
          </Button>
          <p class="text-center text-sm text-neutral-500">
            {{ t("alreadyHaveAccount") }}
            <router-link
              to="/login"
              class="font-medium text-neutral-900 underline-offset-4 hover:underline"
            >
              {{ t("signIn") }}
            </router-link>
          </p>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
