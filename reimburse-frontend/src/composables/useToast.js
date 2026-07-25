import { ref } from "vue";

const toast = ref({
  show: false,
  title: "",
  description: "",
  type: "default",
  priority: "normal",
});

let timer = null;

const DURATION = {
  normal: 3000,
  high: 5500,
};

function clearToastTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function dismissToast() {
  clearToastTimer();
  toast.value = {
    ...toast.value,
    show: false,
  };
}

function addToast(options = {}) {
  const {
    title = "",
    description = "",
    type = "default",
    priority = type === "error" ? "high" : "normal",
    duration,
  } = options;

  clearToastTimer();
  toast.value = {
    show: true,
    title,
    description,
    type,
    priority,
  };

  const ms =
    duration ??
    (priority === "high" ? DURATION.high : DURATION.normal);

  timer = setTimeout(() => {
    toast.value.show = false;
  }, ms);

  return toast;
}

/** @deprecated Prefer toast.add({ type, description }) — kept for existing call sites. */
function showToast(message, type = "default") {
  return addToast({
    description: message,
    type,
    priority: type === "error" ? "high" : "normal",
  });
}

export const toastApi = {
  add: addToast,
  close: dismissToast,
  dismiss: dismissToast,
};

export function useToast() {
  return {
    toast,
    showToast,
    toastApi,
  };
}
