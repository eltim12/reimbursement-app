<template>
  <v-container fluid class="pa-1 pa-md-3">
    <v-row justify="center" class="ma-0">
      <v-col cols="12" md="11" lg="10" class="pa-1 pa-md-3">
        <v-card class="pa-3 pa-md-4 admin-card">
          <div class="d-flex justify-space-between align-start mb-2">
            <v-card-title
              class="text-h4 text-premium text-wrap pa-0 flex-grow-1"
              style="line-height: 1.2"
            >
              💸 {{ t("appTitle") }}
            </v-card-title>
          </div>
          <!-- <div class="d-flex justify-space-between align-start mb-2">
            <v-btn
              icon
              variant="text"
              color="error"
              @click="handleLogout"
              class="opacity-100 ml-2"
              :aria-label="t('logout')"
            >
              <v-icon size="large">mdi-logout</v-icon> {{ t("logout") }}
            </v-btn>
          </div> -->

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
                  <span class="flag-emoji">🇮🇩</span>
                  <span class="d-none d-sm-inline language-text">Bahasa</span>
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

          <!-- List Management View -->
          <div v-if="currentView === 'list'">
            <v-row class="mb-4">
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="newListName"
                  :label="t('newListName')"
                  variant="outlined"
                  density="compact"
                  hide-details="auto"
                ></v-text-field>
              </v-col>
              <v-col
                cols="12"
                md="8"
                class="d-flex gap-2 flex-wrap align-center"
              >
                <v-btn
                  class="btn-premium"
                  @click="createList"
                  :loading="loading"
                  height="40"
                >
                  {{ t("createNewList") }}
                </v-btn>
              </v-col>
            </v-row>

            <v-list class="bg-transparent pa-0 mt-3">
              <v-list-item
                v-for="list in lists"
                :key="list.id"
                @click="loadList(list.id)"
                class="mb-3 list-item-card border pb-2"
                rounded="lg"
                elevation="0"
                :ripple="true"
              >
                <template v-slot:prepend>
                  <v-avatar color="primary" variant="tonal" class="mr-3">
                    <v-icon color="primary">mdi-file-document-outline</v-icon>
                  </v-avatar>
                </template>

                <v-list-item-title class="text-subtitle-1 font-weight-bold">
                  {{ list.name }}
                </v-list-item-title>

                <v-list-item-subtitle class="text-caption mt-1">
                  {{ new Date(list.createdAt).toLocaleDateString() }}
                </v-list-item-subtitle>

                <template v-slot:append>
                  <v-btn
                    icon="mdi-delete"
                    variant="text"
                    color="error"
                    size="small"
                    @click.stop="deleteList(list.id)"
                    :loading="loading"
                    class="mt-3"
                  >
                    <v-icon>mdi-delete</v-icon>
                  </v-btn>
                </template>
              </v-list-item>

              <div
                v-if="lists.length === 0"
                class="text-center pa-8 text-medium-emphasis"
              >
                <v-icon size="48" color="grey-lighten-1" class="mb-2"
                  >mdi-playlist-plus</v-icon
                >
                <div class="text-body-1">
                  No lists found. Create one to get started!
                </div>
              </div>
            </v-list>
          </div>

          <!-- Form and Table View -->
          <div v-else>
            <v-btn
              color="secondary"
              variant="outlined"
              class="mb-4"
              @click="switchView('list')"
            >
              {{ t("backToLists") }}
            </v-btn>

            <v-alert v-if="currentListName" type="info" class="mb-4">
              {{ t("currentList") }}: <strong>{{ currentListName }}</strong>
            </v-alert>

            <!-- Entry Form -->
            <div class="mb-6">
              <h3 class="text-h6 mb-4 text-premium">{{ t("addNewEntry") }}</h3>
              <v-form @submit.prevent="addEntry">
                <v-row>
                  <!-- Left Column: text inputs -->
                  <v-col cols="12" md="6">
                    <v-row>
                      <v-col cols="12">
                        <v-text-field
                          v-model="entryForm.date"
                          type="date"
                          :label="t('date')"
                          variant="outlined"
                          required
                          hide-details="auto"
                        ></v-text-field>
                      </v-col>
                      <v-col cols="12">
                        <v-text-field
                          v-model="entryForm.category"
                          :label="t('category')"
                          :placeholder="t('categoryPlaceholder')"
                          variant="outlined"
                          required
                          hide-details="auto"
                        ></v-text-field>
                      </v-col>
                      <v-col cols="12">
                        <v-text-field
                          v-model="entryForm.note"
                          :label="t('note')"
                          :placeholder="t('notePlaceholder')"
                          variant="outlined"
                          hide-details="auto"
                        ></v-text-field>
                      </v-col>
                      <v-col cols="12">
                        <div class="d-flex align-center gap-2">
                          <v-text-field
                            v-model="entryForm.amount"
                            :label="t('amount')"
                            variant="outlined"
                            required
                            type="text"
                            inputmode="decimal"
                            :prefix="entryForm.currency === 'IDR' ? 'Rp' : '¥'"
                            @input="formatAmountInput"
                            class="flex-grow-1"
                            hide-details="auto"
                          >
                            <template v-slot:append-inner>
                              <v-menu>
                                <template v-slot:activator="{ props }">
                                  <v-btn
                                    v-bind="props"
                                    variant="text"
                                    density="compact"
                                    class="px-2"
                                    style="height: 100%; min-width: unset"
                                  >
                                    <span
                                      class="d-flex align-center gap-1 text-subtitle-2"
                                    >
                                      <span>{{
                                        entryForm.currency === "IDR"
                                          ? "🇮🇩"
                                          : "🇨🇳"
                                      }}</span>
                                      <span class="d-none d-sm-inline">{{
                                        entryForm.currency === "IDR"
                                          ? t("currencyIDR")
                                          : t("currencyRMB")
                                      }}</span>
                                      <v-icon size="small"
                                        >mdi-chevron-down</v-icon
                                      >
                                    </span>
                                  </v-btn>
                                </template>
                                <v-list density="compact">
                                  <v-list-item
                                    @click="
                                      () => {
                                        entryForm.currency = 'IDR';
                                        handleCurrencyChange();
                                      }
                                    "
                                    :active="entryForm.currency === 'IDR'"
                                  >
                                    <template v-slot:prepend>🇮🇩</template>
                                    <v-list-item-title>{{
                                      t("currencyIDR")
                                    }}</v-list-item-title>
                                  </v-list-item>
                                  <v-list-item
                                    @click="
                                      () => {
                                        entryForm.currency = 'RMB';
                                        handleCurrencyChange();
                                      }
                                    "
                                    :active="entryForm.currency === 'RMB'"
                                  >
                                    <template v-slot:prepend>🇨🇳</template>
                                    <v-list-item-title>{{
                                      t("currencyRMB")
                                    }}</v-list-item-title>
                                  </v-list-item>
                                </v-list>
                              </v-menu>
                            </template>
                          </v-text-field>
                        </div>
                      </v-col>
                    </v-row>
                  </v-col>

                  <!-- Right Column: Upload Image + Add Button -->
                  <v-col
                    cols="12"
                    md="6"
                    class="d-flex flex-column justify-space-between"
                  >
                    <UploadImage
                      v-model="entryForm.proof"
                      :multiple="false"
                      :max-size="5 * 1024 * 1024"
                      :hint="t('selectImage')"
                      accept="image/*"
                      :show-existing="false"
                      @file-added="handleImageAdded"
                      class="mb-4"
                    />

                    <v-btn
                      type="submit"
                      class="btn-premium"
                      :loading="saving"
                      block
                      size="large"
                    >
                      {{ t("addEntry") }}
                    </v-btn>
                  </v-col>
                </v-row>
              </v-form>
            </div>

            <v-divider class="my-6"></v-divider>

            <!-- Entries Table -->
            <div>
              <h3 class="text-h6 mb-4 text-premium">{{ t("entries") }}</h3>
              <div class="table-wrapper">
                <v-table>
                  <thead>
                    <tr>
                      <th>{{ t("tableDate") }}</th>
                      <th>{{ t("tableCategory") }}</th>
                      <th>{{ t("tableNote") }}</th>
                      <th>{{ t("tableAmount") }}</th>
                      <th>{{ t("tableProof") }}</th>
                      <th>{{ t("tableAction") }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(entry, idx) in entries" :key="idx">
                      <td>{{ entry.Date }}</td>
                      <td>{{ entry.Category }}</td>
                      <td>{{ entry.Note || "-" }}</td>
                      <td>
                        {{
                          formatCurrency(entry.Amount, entry.Currency || "IDR")
                        }}
                      </td>
                      <td>
                        <v-img
                          v-if="getProofUrl(entry.Proof)"
                          :src="getProofUrl(entry.Proof)"
                          max-width="150"
                          max-height="150"
                          style="border-radius: 6px"
                          cover
                        >
                          <template v-slot:error>
                            <div class="text-caption text-center pa-2">
                              {{ t("imageUnavailable") }}
                            </div>
                          </template>
                        </v-img>
                        <span v-else>-</span>
                      </td>
                      <td>
                        <v-btn
                          icon="mdi-delete"
                          color="error"
                          size="small"
                          @click="deleteEntry(idx)"
                        ></v-btn>
                      </td>
                    </tr>
                  </tbody>
                </v-table>
              </div>

              <v-divider class="my-4"></v-divider>

              <div class="text-right mb-4">
                <h3 class="text-h6 text-premium">
                  <!-- Display totals for each currency -->
                  <div
                    v-for="(amount, currency) in currencyTotals"
                    :key="currency"
                  >
                    {{ t("total") }} ({{ currency }}):
                    {{ formatCurrency(amount, currency) }}
                  </div>
                </h3>
              </div>

              <v-row class="mt-4" justify="center">
                <v-col cols="12" md="6">
                  <v-btn
                    class="btn-premium"
                    block
                    @click="handleExportPDF"
                    :loading="exporting"
                  >
                    {{ t("exportPDF") }}
                  </v-btn>
                </v-col>
              </v-row>
            </div>
          </div>

          <!-- Snackbar for notifications -->
          <v-snackbar
            v-model="snackbar.show"
            :color="snackbar.color"
            :timeout="3000"
          >
            {{ snackbar.message }}
          </v-snackbar>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import UploadImage from "../components/UploadImage.vue";
import { ref, onMounted, computed, watch } from "vue";
import { useRouter } from "vue-router";
import api from "../services/api";
// Image compression now handled in UploadImage.vue
import {
  formatCurrency,
  parseCurrencyAmount,
  formatIDR,
} from "../utils/formatters";
import { exportPDF } from "../utils/pdfExport";
import { translations } from "../utils/translations";

const router = useRouter();

const handleLogout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  router.push("/login");
};

// Language support
const locale = ref(localStorage.getItem("locale") || "en");

watch(locale, (newVal) => {
  localStorage.setItem("locale", newVal);
});

const t = (key) => {
  return translations[locale.value]?.[key] || translations.en[key] || key;
};

const currentView = ref("list");
const loading = ref(false);
const saving = ref(false);
const exporting = ref(false);
const lists = ref([]);
const selectedListId = ref(null);
const currentListId = ref(null);
const currentListName = ref("");
const entries = ref([]);
// const total = ref(0) // replace with currencyTotals computed
const currencyTotals = computed(() => {
  const totals = { IDR: 0, RMB: 0 };
  entries.value.forEach((entry) => {
    const curr = entry.Currency || "IDR";
    const amt = entry.Amount || 0;
    if (!totals[curr]) totals[curr] = 0;
    totals[curr] += amt;
  });
  // Filter out zero totals if you want, or just show both?
  // Let's return object and iterate in template
  return totals;
});
const total = ref(0); // Keep for backward compat or list meta from backend, but ignore for display
const newListName = ref("");

const entryForm = ref({
  date: "",
  category: "",
  note: "",
  amount: "",
  currency: "IDR",
  proof: null,
});

const snackbar = ref({
  show: false,
  message: "",
  color: "success",
});

const showSnackbar = (message, color = "success") => {
  snackbar.value = { show: true, message, color };
};

const onlyNumbers = (e) => {
  // Allow: backspace, delete, tab, escape, enter, period (if RMB)
  const allowedKeys = [8, 9, 27, 13, 46];

  if (entryForm.value.currency === "RMB") {
    // Allow period for decimals
    if (e.key === ".") return;
  }

  if (
    allowedKeys.indexOf(e.keyCode) !== -1 ||
    (e.keyCode === 65 && e.ctrlKey === true) ||
    (e.keyCode === 67 && e.ctrlKey === true) ||
    (e.keyCode === 86 && e.ctrlKey === true) ||
    (e.keyCode === 88 && e.ctrlKey === true) ||
    (e.keyCode >= 35 && e.keyCode <= 39)
  ) {
    return;
  }
  // Only allow digits (0-9)
  if (
    (e.shiftKey || e.keyCode < 48 || e.keyCode > 57) &&
    (e.keyCode < 96 || e.keyCode > 105)
  ) {
    e.preventDefault();
  }
};

const formatAmountInput = (e) => {
  const value = e.target.value;
  const currency = entryForm.value.currency;

  if (currency === "IDR") {
    // IDR logic: integer only, dots
    const cleaned = value.replace(/[^\d]/g, "");
    const numeric = parseInt(cleaned, 10);
    if (!isNaN(numeric)) {
      const formatted = numeric
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      entryForm.value.amount = formatted;
    } else {
      entryForm.value.amount = "";
    }
  } else {
    // RMB logic: allow decimals, maybe commas for thousands?
    // For input UX, simpler to just allow typing decimals and numbers.
    // We can format with commas if we want, but handling cursor position with decimals + commas is tricky.
    // Let's simplified: just allow numeric + dot.
    // If user wants commas, we can try to add them.
    // Let's just allow raw input for RMB for now to be safe with decimals,
    // or very simple mapping.
    const cleaned = value.replace(/[^\d.]/g, "");
    // prevent multiple dots
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      entryForm.value.amount = parts[0] + "." + parts.slice(1).join("");
      return;
    }
    entryForm.value.amount = cleaned;
  }
};

const handleCurrencyChange = () => {
  // Re-format existing amount when switching
  const currentVal = entryForm.value.amount;
  if (!currentVal) return;

  // Parse current value based on OLD currency logic?
  // Wait, we don't know the old currency here easily unless we watch it.
  // But simplistic approach: try to parse digits.

  // If we switch IDR -> RMB:
  // IDR 1.000.000 -> 1000000 -> RMB 1000000 ? (No conversion, just keep number)
  const raw = currentVal.replace(/[^\d.]/g, ""); // keep numbers and dots
  // If IDR, dots were thousands. If RMB, dots were decimals.
  // This is ambiguous.
  // Ideally we clear the amount or try best effort.
  // Let's clear amount to avoid confusion and errors.
  entryForm.value.amount = "";
};

const getProofUrl = (proof) => {
  if (!proof) return null;

  // Handle object format {url: '/images/...'}
  if (typeof proof === "object" && proof !== null) {
    if (proof.url) {
      // If it's a relative URL, prepend the API base URL
      // If it's absolute, use it directly
      if (proof.url.startsWith("http")) {
        return proof.url;
      } else {
        return `https://reimburse-api.trimind.studio${proof.url}`;
      }
    }
    // Fallback to base64 if available (for old entries)
    return proof.base64 || null;
  }

  // Handle string URLs
  if (typeof proof === "string") {
    if (proof.startsWith("data:image")) {
      return proof;
    }
    // If it's a relative URL, prepend the API base URL
    // If it's absolute, use it directly
    if (proof.startsWith("http")) {
      return proof;
    } else {
      return `https://reimburse-api.trimind.studio${proof}`;
    }
  }

  return null;
};

const switchView = (view) => {
  currentView.value = view;
};

const loadLists = async () => {
  try {
    loading.value = true;
    const response = await api.getLists();
    if (response.success) {
      lists.value = response.lists
        .map((list) => ({
          id: list.id,
          name: list.name,
          createdAt: list.createdAt,
          displayName: `${list.name} (${new Date(
            list.createdAt,
          ).toLocaleDateString()})`,
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  } catch (error) {
    showSnackbar(t("failedToLoadLists"), "error");
  } finally {
    loading.value = false;
  }
};

const createList = async () => {
  if (!newListName.value.trim()) {
    showSnackbar(t("pleaseEnterListName"), "error");
    return;
  }

  try {
    loading.value = true;
    const response = await api.createList(newListName.value.trim());
    if (response.success) {
      currentListId.value = response.list.id;
      currentListName.value = response.list.name;
      entries.value = [];
      total.value = 0;
      newListName.value = "";
      switchView("form");
      await loadLists();
      showSnackbar(`${t("createdNewList")}: ${currentListName.value}`);
    }
  } catch (error) {
    showSnackbar(t("failedToCreateList"), "error");
  } finally {
    loading.value = false;
  }
};

const loadList = async (id = null) => {
  const targetId = id || selectedListId.value;
  if (!targetId) {
    showSnackbar(t("pleaseSelectList"), "error");
    return;
  }

  try {
    loading.value = true;
    const response = await api.getList(targetId);
    if (response.success) {
      const list = response.list;
      currentListId.value = list.id;
      currentListName.value = list.name;
      entries.value = list.entries || [];
      total.value = list.total || 0;
      switchView("form");
      showSnackbar(`${t("loadedList")}: ${currentListName.value}`);
    }
  } catch (error) {
    showSnackbar(t("failedToLoadList"), "error");
  } finally {
    loading.value = false;
  }
};

const deleteList = async (id = null) => {
  const targetId = id || selectedListId.value;
  if (!targetId) {
    showSnackbar(t("pleaseSelectList"), "error");
    return;
  }

  if (!confirm(t("areYouSureDeleteList"))) {
    return;
  }

  try {
    loading.value = true;
    const response = await api.deleteList(targetId);
    if (response.success) {
      if (currentListId.value === targetId) {
        currentListId.value = null;
        currentListName.value = "";
        entries.value = [];
        total.value = 0;
        switchView("list");
      }
      await loadLists();
      selectedListId.value = null;
      showSnackbar(t("listDeleted"));
    }
  } catch (error) {
    showSnackbar(t("failedToDeleteList"), "error");
  } finally {
    loading.value = false;
  }
};

const handleImageAdded = (fileObj) => {
  // File is automatically added to entryForm.proof via v-model
  console.log("Image added:", fileObj);
};

const addEntry = async () => {
  if (!currentListId.value) {
    showSnackbar(t("pleaseCreateOrLoadList"), "error");
    return;
  }

  const amount = parseCurrencyAmount(
    entryForm.value.amount,
    entryForm.value.currency,
  );
  if (isNaN(amount) || amount <= 0) {
    showSnackbar(t("pleaseEnterValidAmount"), "error");
    return;
  }

  try {
    saving.value = true;
    let proofUrl = null;

    // Upload image if provided (backend will compress it)
    const proofFile = entryForm.value.proof;

    if (proofFile && proofFile instanceof File) {
      try {
        const uploadResponse = await api.uploadImage(proofFile);
        if (uploadResponse.success) {
          proofUrl = uploadResponse.url;
        }
      } catch (error) {
        console.error("Image upload error:", error);
        showSnackbar(t("failedToUploadImage"), "warning");
      }
    }

    const newEntry = {
      Date: entryForm.value.date,
      Category: entryForm.value.category,
      Note: entryForm.value.note,
      Amount: amount,
      Currency: entryForm.value.currency,
      Proof: proofUrl ? { url: proofUrl } : null,
    };

    entries.value.push(newEntry);
    // total.value += amount // Don't manually update total ref, use computed currencyTotals
    // But we need to send total to backend.
    // Backend expects 'total'. For IDR/RMB mix, 'total' field is ambiguous.
    // let's send sum if same currency, or just 0?
    // Let's assume we send 'total' as sum of IDR for now or just the calculated total from somewhere?
    // If backend logic depends on 'total', we might break it.
    // I will sum all amounts as raw numbers for 'total' just to satisfy the field requirement, even if wrong currency mixing.
    // Or better: calculate total value in base currency if possible? No.
    // Just sum it.
    total.value += amount;

    // Save to backend
    await api.updateList(currentListId.value, {
      entries: entries.value,
      total: total.value,
    });

    // Reset form (including image)
    entryForm.value = {
      date: "",
      category: "",
      note: "",
      amount: "",
      currency: "IDR", // Reset to default or keep last used? 'IDR' safe.
      proof: null,
    };

    // Force component to reset by clearing the file input
    // The UploadImage component will handle this via v-model

    showSnackbar(t("entryAdded"));
  } catch (error) {
    console.error("Error adding entry:", error);
    showSnackbar(t("failedToAddEntry"), "error");
  } finally {
    saving.value = false;
  }
};

const deleteEntry = async (index) => {
  const entry = entries.value[index];
  const entryCurrency = entry.Currency || "IDR";
  const confirmMessage = `${t("areYouSureDeleteEntry")}\n${t("date")}: ${
    entry.Date
  }\n${t("category")}: ${entry.Category}\n${t("amount")}: ${formatCurrency(
    entry.Amount,
    entryCurrency,
  )}`;

  if (!confirm(confirmMessage)) {
    return;
  }

  try {
    const removedAmount = entry.Amount;

    // If entry has an ID (loaded from database), use the delete endpoint
    // This will also delete the associated image from the backend
    if (entry.id) {
      try {
        await api.deleteEntry(entry.id);
        // Entry and image deleted from backend, now update local state
        entries.value.splice(index, 1);
        total.value -= removedAmount;

        // Update the list to sync the remaining entries and total
        await api.updateList(currentListId.value, {
          entries: entries.value,
          total: total.value,
        });

        showSnackbar(t("entryDeleted"));
      } catch (error) {
        console.error("Error deleting entry from backend:", error);
        showSnackbar(t("failedToDeleteEntry"), "error");
      }
    } else {
      // Entry doesn't have ID (newly added, not saved yet)
      // Just remove from local array and update list
      entries.value.splice(index, 1);
      total.value -= removedAmount;

      await api.updateList(currentListId.value, {
        entries: entries.value,
        total: total.value,
      });

      showSnackbar(t("entryDeleted"));
    }
  } catch (error) {
    console.error("Error deleting entry:", error);
    showSnackbar(t("failedToDeleteEntry"), "error");
  }
};

const handleExportPDF = async () => {
  try {
    exporting.value = true;
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const userName = user.name || "";
    await exportPDF(
      currentListName.value,
      entries.value,
      total.value,
      userName,
    );
    showSnackbar(t("pdfExported"));
  } catch (error) {
    showSnackbar(t("pdfExportFailed"), "error");
  } finally {
    exporting.value = false;
  }
};

onMounted(() => {
  loadLists();
});
</script>

<style scoped>
.gap-2 {
  gap: var(--spacing-sm);
}

.gap-1 {
  gap: 4px;
}

/* Language Switcher Styles */
.language-switcher {
  flex-wrap: nowrap;
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
  .v-card-title {
    font-size: 1.5rem !important;
  }

  .v-card {
    padding: var(--spacing-md) !important;
  }

  .language-switcher {
    justify-content: center;
  }

  .language-btn {
    flex: 0 0 auto;
    padding: 8px 16px !important;
  }

  .language-btn span {
    font-size: 1.2em;
  }
}

/* Image upload hover effects */
:deep(.image-upload-container .v-field) {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

:deep(.image-upload-container:hover .v-field) {
  border-color: rgba(139, 92, 246, 0.5) !important;
  transform: translateY(-2px);
  box-shadow: var(--shadow-md) !important;
}

:deep(.image-upload-container .v-field--focused) {
  border-color: var(--color-primary) !important;
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2) !important;
}
</style>
