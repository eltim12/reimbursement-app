<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import api from "@/services/api";
import { setSessionTokens } from "@/utils/session";
import { portalLoginUrl } from "@/utils/portal";
import Spinner from "@/components/ui/Spinner.vue";

const route = useRoute();
const router = useRouter();
const error = ref("");
const portalLoginUrlHref = computed(() => portalLoginUrl());

onMounted(async () => {
  const code = typeof route.query.code === "string" ? route.query.code : "";
  if (!code) {
    error.value = "Kode SSO tidak valid";
    return;
  }
  try {
    const response = await api.exchangeSso(code);
    if (!response.success) {
      throw new Error(response.error || "SSO gagal");
    }
    localStorage.setItem("user", JSON.stringify(response.user));
    setSessionTokens({
      token: response.token,
      refreshToken: response.refreshToken || undefined,
    });
    const next =
      response.redirectPath &&
      response.redirectPath.startsWith("/") &&
      !response.redirectPath.startsWith("//")
        ? response.redirectPath
        : "/";
    router.replace(next);
  } catch (e) {
    error.value =
      e.response?.data?.error || e.message || "Gagal masuk via portal";
  }
});
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-4">
    <div class="text-center text-sm text-neutral-600">
      <div v-if="!error" class="flex flex-col items-center gap-3">
        <Spinner class="size-6 text-neutral-400" />
        <p>Masuk dari portal…</p>
      </div>
      <div v-else class="space-y-3">
        <p class="text-red-600">{{ error }}</p>
        <a class="text-neutral-900 underline" :href="portalLoginUrlHref">
          Kembali ke portal
        </a>
      </div>
    </div>
  </div>
</template>
