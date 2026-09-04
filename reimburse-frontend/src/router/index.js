import { createRouter, createWebHistory } from "vue-router";
import Home from "../views/Home.vue";
import ListDetail from "../views/ListDetail.vue";
import Profile from "../views/Profile.vue";
import Users from "../views/Users.vue";
import Categories from "../views/Categories.vue";
import Analytics from "../views/Analytics.vue";
import Companies from "../views/Companies.vue";
import Purchasing from "../views/Purchasing.vue";
import Login from "../views/Login.vue";

const routes = [
  {
    path: "/",
    name: "Home",
    component: Home,
    meta: { requiresAuth: true },
  },
  {
    path: "/lists/:id",
    name: "ListDetail",
    component: ListDetail,
    meta: { requiresAuth: true },
  },
  {
    path: "/purchasing",
    name: "Purchasing",
    component: Purchasing,
    meta: { requiresAuth: true, requiresPurchasing: true },
  },
  {
    path: "/profile",
    name: "Profile",
    component: Profile,
    meta: { requiresAuth: true },
  },
  {
    path: "/users",
    name: "Users",
    component: Users,
    meta: { requiresAuth: true, requiresUserAdmin: true },
  },
  {
    path: "/categories",
    name: "Categories",
    component: Categories,
    meta: { requiresAuth: true, requiresCategoryAdmin: true },
  },
  {
    path: "/analytics",
    name: "Analytics",
    component: Analytics,
    meta: { requiresAuth: true },
  },
  {
    path: "/superadmin/companies",
    name: "Companies",
    component: Companies,
    meta: { requiresAuth: true, requiresSuperadmin: true },
  },
  {
    path: "/login",
    name: "Login",
    component: Login,
    meta: { guestOnly: true },
  },
  {
    path: "/register",
    redirect: "/login",
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem("token");
  const isAuthenticated = !!token;
  let user = {};
  try {
    user = JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    user = {};
  }

  const isSuperadmin = user.role === "superadmin";
  const canViewCategories =
    isSuperadmin ||
    ["management", "finance", "admin", "stakeholder"].includes(user.role);
  const canViewUsers =
    isSuperadmin || user.role === "management" || user.role === "stakeholder";
  const canAccessPurchasing = isSuperadmin || !!user.purchasing_enabled;

  if (to.meta.requiresAuth && !isAuthenticated) {
    next("/login");
    return;
  }

  if (to.meta.guestOnly && isAuthenticated) {
    next(isSuperadmin ? "/superadmin/companies" : "/");
    return;
  }

  if (to.meta.requiresSuperadmin && !isSuperadmin) {
    next("/");
    return;
  }

  if (to.meta.requiresUserAdmin && !canViewUsers) {
    next("/");
    return;
  }

  if (to.meta.requiresCategoryAdmin && !canViewCategories) {
    next("/");
    return;
  }

  if (to.meta.requiresPurchasing && !canAccessPurchasing) {
    next("/");
    return;
  }

  next();
});

export default router;
