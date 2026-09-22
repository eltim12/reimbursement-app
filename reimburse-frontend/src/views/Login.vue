<script setup>
import { onMounted } from "vue";
import Spinner from "@/components/ui/Spinner.vue";
import { redirectToPortalLogin } from "@/utils/portal";

onMounted(() => {
  redirectToPortalLogin();
});
</script>

<template>
  <div
    class="flex min-h-screen flex-col items-center justify-center gap-3 bg-neutral-50 p-4 text-sm text-neutral-500"
  >
    <Spinner class="size-6 text-neutral-400" />
    <p>Mengalihkan ke portal aplikasi…</p>
  </div>
</template>
