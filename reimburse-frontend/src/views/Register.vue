<template>
  <v-container fluid class="fill-height justify-center pa-0">
    <v-card
      class="pa-4 pa-sm-8"
      width="100%"
      max-width="400"
      elevation="8"
      rounded="xl"
      color="rgba(30, 41, 59, 0.95)"
    >
      <div class="text-center mb-6">
        <!-- Language Switcher -->
        <div class="mb-4 d-flex justify-center">
          <v-btn-toggle
            v-model="locale"
            mandatory
            variant="outlined"
            density="compact"
            class="language-switcher"
          >
            <v-btn value="en" size="small" class="language-btn">
              <span class="d-flex align-center language-btn-content">
                <span class="flag-emoji">🇺🇸</span>
                <span class="d-none d-sm-inline language-text">English</span>
              </span>
            </v-btn>
            <v-btn value="zh" size="small" class="language-btn">
              <span class="d-flex align-center language-btn-content">
                <span class="flag-emoji">🇨🇳</span>
                <span class="d-none d-sm-inline language-text">中文</span>
              </span>
            </v-btn>
          </v-btn-toggle>
        </div>
        <h1 class="text-h4 font-weight-bold text-white mb-2">
          {{ t("createAccount") || "Create Account" }}
        </h1>
        <p class="text-medium-emphasis">
          {{ t("joinUsSubtitle") || "Join us to track your reimbursements" }}
        </p>
      </div>

      <v-form @submit.prevent="handleRegister" v-model="formValid">
        <v-text-field
          v-model="name"
          :label="t('name') || 'Name'"
          variant="outlined"
          color="primary"
          bg-color="rgba(255, 255, 255, 0.05)"
          :rules="[(v) => !!v || t('nameRequired') || 'Name is required']"
          prepend-inner-icon="mdi-account"
          class="mb-2"
        ></v-text-field>
        <v-text-field
          v-model="email"
          :label="t('email') || 'Email'"
          type="email"
          variant="outlined"
          color="primary"
          bg-color="rgba(255, 255, 255, 0.05)"
          :rules="[
            (v) => !!v || t('emailRequired') || 'Email is required',
            (v) =>
              /.+@.+\..+/.test(v) || t('emailValid') || 'Email must be valid',
          ]"
          prepend-inner-icon="mdi-email"
          class="mb-2"
        ></v-text-field>

        <v-text-field
          v-model="password"
          :label="t('password') || 'Password'"
          type="password"
          variant="outlined"
          color="primary"
          bg-color="rgba(255, 255, 255, 0.05)"
          :rules="[
            (v) => !!v || t('passwordRequired') || 'Password is required',
            (v) =>
              v.length >= 6 || t('passwordMinLength') || 'Min 6 characters',
          ]"
          prepend-inner-icon="mdi-lock"
          class="mb-2"
        ></v-text-field>

        <v-text-field
          v-model="confirmPassword"
          :label="t('confirmPassword') || 'Confirm Password'"
          type="password"
          variant="outlined"
          color="primary"
          bg-color="rgba(255, 255, 255, 0.05)"
          :rules="[
            (v) =>
              !!v ||
              t('confirmPasswordRequired') ||
              'Confirm Password is required',
            (v) =>
              v === password ||
              t('passwordsMismatch') ||
              'Passwords do not match',
          ]"
          prepend-inner-icon="mdi-lock-check"
          class="mb-6"
        ></v-text-field>

        <v-btn
          type="submit"
          block
          color="primary"
          size="large"
          class="text-capitalize mb-4"
          :loading="loading"
          :disabled="!formValid"
        >
          {{ t("signUp") || "Sign Up" }}
        </v-btn>

        <div class="text-center text-body-2 text-medium-emphasis">
          {{ t("alreadyHaveAccount") || "Already have an account?" }}
          <router-link
            to="/login"
            class="text-primary text-decoration-none font-weight-bold"
          >
            {{ t("signIn") || "Sign In" }}
          </router-link>
        </div>
      </v-form>

      <v-snackbar
        v-model="snackbar.show"
        :color="snackbar.color"
        location="top"
      >
        {{ snackbar.message }}
      </v-snackbar>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import api from "../services/api";
import { translations } from "../utils/translations";

const router = useRouter();
const name = ref("");
const email = ref("");
const password = ref("");
const confirmPassword = ref("");
const loading = ref(false);
const formValid = ref(false);
const snackbar = ref({ show: false, message: "", color: "error" });
const locale = ref(localStorage.getItem("locale") || "en");

watch(locale, (newVal) => {
  localStorage.setItem("locale", newVal);
});

onMounted(() => {
  // Ensure we have a valid locale
  if (!["en", "zh"].includes(locale.value)) {
    locale.value = "en";
  }
});

const t = (key) => {
  return translations[locale.value]?.[key] || translations.en[key] || key;
};

const handleRegister = async () => {
  if (!formValid.value) return;

  loading.value = true;
  try {
    const response = await api.register(
      email.value,
      password.value,
      name.value
    );
    if (response.success) {
      snackbar.value = {
        show: true,
        message: "Account created! Please login.",
        color: "success",
      };
      setTimeout(() => {
        router.push("/login");
      }, 1500);
    }
  } catch (error) {
    snackbar.value = {
      show: true,
      message: error.response?.data?.error || "Registration failed",
      color: "error",
    };
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.fill-height {
  min-height: 100vh;
  background: radial-gradient(
      circle at top right,
      rgba(139, 92, 246, 0.1),
      transparent 40%
    ),
    radial-gradient(
      circle at bottom left,
      rgba(56, 189, 248, 0.1),
      transparent 40%
    );
}

/* Language Switcher Styles - Matched with Home.vue */
.language-switcher {
  flex-wrap: nowrap;
  max-width: 100%;
}

.v-btn-group--density-compact.v-btn-group {
  height: 100%;
  overflow: visible;
}

.language-btn {
  width: 100px;
  padding: 8px 12px !important;
  margin: 0 4px;
}

.language-btn-content {
  gap: 6px;
}

.flag-emoji {
  font-size: 1.1em;
  line-height: 1;
}

.language-text {
  margin-left: 4px;
}

/* Mobile-specific adjustments */
@media (max-width: 600px) {
  .language-switcher {
    justify-content: center;
  }

  .language-btn {
    flex: 0 0 auto;
    padding: 8px 16px !important;
    /* Reset width for mobile if needed, or flex handles it */
    width: auto !important;
  }

  .language-btn span {
    font-size: 1.2em;
  }
}
</style>
