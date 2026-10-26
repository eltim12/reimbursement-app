import { ref, watch } from "vue";
import { translations } from "@/utils/translations";
import { readSharedLocale, writeSharedLocale } from "@/utils/localePref";

function toAppLocale(raw) {
  return raw === "zh" ? "zh" : "en";
}

function initialLocale() {
  const shared = readSharedLocale();
  if (shared) return toAppLocale(shared);
  const legacy = localStorage.getItem("locale");
  if (legacy === "zh" || legacy === "en" || legacy === "id") {
    const canonical = legacy === "zh" ? "zh" : "id";
    writeSharedLocale(canonical);
    return toAppLocale(canonical);
  }
  return "en";
}

const locale = ref(initialLocale());

watch(locale, (value) => {
  const canonical = value === "zh" ? "zh" : "id";
  writeSharedLocale(canonical);
  localStorage.setItem("locale", value);
});

export function useI18n() {
  const t = (key) =>
    translations[locale.value]?.[key] || translations.en[key] || key;

  const setLocale = (value) => {
    locale.value = value;
  };

  return { locale, t, setLocale };
}
