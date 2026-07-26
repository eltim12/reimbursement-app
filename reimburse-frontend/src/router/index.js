import { createRouter, createWebHistory } from "vue-router";
import Home from "../views/Home.vue";
import ListDetail from "../views/ListDetail.vue";
import Profile from "../views/Profile.vue";
import Users from "../views/Users.vue";
import Analytics from "../views/Analytics.vue";
import Login from "../views/Login.vue";
import Register from "../views/Register.vue";

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
    path: "/profile",
    name: "Profile",
    component: Profile,
    meta: { requiresAuth: true },
  },
  {
    path: "/users",
    name: "Users",
    component: Users,
    meta: { requiresAuth: true, requiresManagement: true },
  },
  {
    path: "/analytics",
    name: "Analytics",
    component: Analytics,
    meta: { requiresAuth: true },
  },
  {
    path: "/login",
    name: "Login",
    component: Login,
    meta: { guestOnly: true },
  },
  {
    path: "/register",
    name: "Register",
    component: Register,
    meta: { guestOnly: true },
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

  if (to.meta.requiresAuth && !isAuthenticated) {
    next("/login");
  } else if (to.meta.guestOnly && isAuthenticated) {
    next("/");
  } else if (to.meta.requiresManagement && user.role !== "management") {
    next("/");
  } else {
    next();
  }
});

export default router;
