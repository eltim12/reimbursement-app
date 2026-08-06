<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  LayoutDashboard,
  FileText,
  LogOut,
  Menu,
  Receipt,
  BarChart3,
  Tags,
  UserRound,
  Users,
  Building2,
  ShoppingCart,
  X,
} from "@lucide/vue";
import LangToggle from "@/components/LangToggle.vue";
import Button from "@/components/ui/Button.vue";
import { useI18n } from "@/composables/useI18n";
import { cn } from "@/lib/utils";
import api from "@/services/api";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const mobileOpen = ref(false);
const userTick = ref(0);

const user = computed(() => {
  userTick.value;
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
});

onMounted(async () => {
  try {
    const response = await api.getProfile();
    if (response.success) {
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem(
        "user",
        JSON.stringify({ ...stored, ...response.user }),
      );
      userTick.value += 1;
    }
  } catch {
    /* ignore */
  }
});

const isManagement = computed(() => user.value.role === "management");
const isSuperadmin = computed(() => user.value.role === "superadmin");
const canManageCategories = computed(() =>
  ["management", "finance", "admin"].includes(user.value.role),
);
const canAccessPurchasing = computed(
  () => isSuperadmin.value || !!user.value.purchasing_enabled,
);

const navItems = computed(() => {
  if (isSuperadmin.value) {
    const items = [
      {
        to: "/superadmin/companies",
        label: t("navCompanies"),
        icon: Building2,
        exact: true,
      },
      { to: "/", label: t("navHome"), icon: LayoutDashboard, exact: true },
      {
        to: "/analytics",
        label: t("navAnalytics"),
        icon: BarChart3,
        exact: true,
      },
      {
        to: "/purchasing",
        label: t("navPurchasing"),
        icon: ShoppingCart,
        exact: true,
      },
      {
        to: "/categories",
        label: t("navCategories"),
        icon: Tags,
        exact: true,
      },
      {
        to: "/users",
        label: t("navUsers"),
        icon: Users,
        exact: true,
      },
    ];
    if (route.name === "ListDetail" && route.params.id) {
      items.push({
        to: `/lists/${route.params.id}`,
        label: t("navList"),
        icon: FileText,
        exact: false,
      });
    }
    items.push({
      to: "/profile",
      label: t("navProfile"),
      icon: UserRound,
      exact: true,
    });
    return items;
  }

  const items = [
    { to: "/", label: t("navHome"), icon: LayoutDashboard, exact: true },
    {
      to: "/analytics",
      label: t("navAnalytics"),
      icon: BarChart3,
      exact: true,
    },
  ];
  if (canAccessPurchasing.value) {
    items.push({
      to: "/purchasing",
      label: t("navPurchasing"),
      icon: ShoppingCart,
      exact: true,
    });
  }
  if (canManageCategories.value) {
    items.push({
      to: "/categories",
      label: t("navCategories"),
      icon: Tags,
      exact: true,
    });
  }
  if (isManagement.value) {
    items.push({
      to: "/users",
      label: t("navUsers"),
      icon: Users,
      exact: true,
    });
  }
  if (route.name === "ListDetail" && route.params.id) {
    items.push({
      to: `/lists/${route.params.id}`,
      label: t("navList"),
      icon: FileText,
      exact: false,
    });
  }
  items.push({
    to: "/profile",
    label: t("navProfile"),
    icon: UserRound,
    exact: true,
  });
  return items;
});

const isActive = (item) => {
  if (item.exact) return route.path === item.to;
  return route.path.startsWith(item.to);
};

const handleLogout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  router.push("/login");
};

const go = (item) => {
  if (!item.to) return;
  router.push(item.to);
  mobileOpen.value = false;
};
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-neutral-50 text-neutral-900">
    <!-- Desktop sidebar -->
    <aside
      class="hidden w-60 shrink-0 flex-col border-r border-neutral-200 bg-white md:flex"
    >
      <div
        class="flex h-16 items-center gap-2 border-b border-neutral-200 px-5"
      >
        <div class="rounded-lg bg-neutral-100 p-2">
          <Receipt class="h-4 w-4 text-neutral-900" />
        </div>
        <span class="text-sm font-semibold">{{ t("appTitle") }}</span>
      </div>

      <nav class="flex-1 space-y-1 p-3">
        <button
          v-for="item in navItems"
          :key="item.label"
          type="button"
          :class="
            cn(
              'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors',
              isActive(item)
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-100',
            )
          "
          @click="go(item)"
        >
          <component :is="item.icon" class="h-4 w-4 shrink-0" />
          {{ item.label }}
        </button>
      </nav>

      <div class="border-t border-neutral-200 p-3">
        <div class="mb-2 space-y-0.5 px-3">
          <div class="truncate text-sm font-medium text-neutral-900">
            {{ user.name || "—" }}
          </div>
          <div class="truncate text-xs text-neutral-500">
            {{ user.email || "" }}
          </div>
        </div>
        <Button
          variant="ghost"
          class="w-full justify-start text-neutral-600"
          @click="handleLogout"
        >
          <LogOut class="h-4 w-4" />
          {{ t("logout") }}
        </Button>
      </div>
    </aside>

    <!-- Mobile drawer -->
    <div
      v-if="mobileOpen"
      class="fixed inset-0 z-40 bg-black/40 md:hidden"
      @click="mobileOpen = false"
    />
    <aside
      :class="
        cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-neutral-200 bg-white transition-transform md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )
      "
    >
      <div
        class="flex h-16 items-center justify-between border-b border-neutral-200 px-5"
      >
        <span class="text-sm font-semibold">{{ t("appTitle") }}</span>
        <Button variant="ghost" size="icon-sm" @click="mobileOpen = false">
          <X class="h-4 w-4" />
        </Button>
      </div>
      <nav class="flex-1 space-y-1 p-3">
        <button
          v-for="item in navItems"
          :key="`m-${item.label}`"
          type="button"
          :class="
            cn(
              'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors',
              isActive(item)
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-100',
            )
          "
          @click="go(item)"
        >
          <component :is="item.icon" class="h-4 w-4 shrink-0" />
          {{ item.label }}
        </button>
      </nav>
      <div class="border-t border-neutral-200 p-3">
        <div class="mb-2 space-y-0.5 px-3">
          <div class="truncate text-sm font-medium text-neutral-900">
            {{ user.name || "—" }}
          </div>
          <div class="truncate text-xs text-neutral-500">
            {{ user.email || "" }}
          </div>
        </div>
        <Button
          variant="ghost"
          class="w-full justify-start text-neutral-600"
          @click="handleLogout"
        >
          <LogOut class="h-4 w-4" />
          {{ t("logout") }}
        </Button>
      </div>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-4 md:px-6"
      >
        <Button
          variant="ghost"
          size="icon"
          class="md:hidden"
          @click="mobileOpen = true"
        >
          <Menu class="h-5 w-5" />
        </Button>
        <div class="hidden md:block" />
        <LangToggle />
      </header>

      <main class="flex-1 overflow-y-auto p-4 md:p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
