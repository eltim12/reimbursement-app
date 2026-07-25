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

const email = ref("");
const password = ref("");
const loading = ref(false);

const handleLogin = async () => {
  if (!email.value || !password.value) {
    showToast(t("emailRequired"), "error");
    return;
  }
  if (!/.+@.+\..+/.test(email.value)) {
    showToast(t("emailValid"), "error");
    return;
  }

  loading.value = true;
  try {
    const response = await api.login(email.value, password.value);
    if (response.success) {
      localStorage.setItem("token", response.token);
      localStorage.setItem("user", JSON.stringify(response.user));
      router.push("/");
    }
  } catch (error) {
    showToast(error.response?.data?.error || "Login failed", "error");
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
        <CardTitle class="text-2xl">{{ t("welcomeBack") }}</CardTitle>
        <CardDescription>{{ t("signInSubtitle") }}</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="handleLogin">
          <div class="space-y-2">
            <Label for="email">{{ t("email") }}</Label>
            <Input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              required
            />
          </div>
          <div class="space-y-2">
            <Label for="password">{{ t("password") }}</Label>
            <Input
              id="password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              required
            />
          </div>
          <Button type="submit" class="h-11 w-full" :loading="loading">
            {{ t("signIn") }}
          </Button>
          <p class="text-center text-sm text-neutral-500">
            {{ t("dontHaveAccount") }}
            <router-link
              to="/register"
              class="font-medium text-neutral-900 underline-offset-4 hover:underline"
            >
              {{ t("signUp") }}
            </router-link>
          </p>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
