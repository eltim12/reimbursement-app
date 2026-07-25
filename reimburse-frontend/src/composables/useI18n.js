import { ref, watch } from "vue";
import { translations } from "@/utils/translations";

const locale = ref(localStorage.getItem("locale") || "en");

watch(locale, (value) => {
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
