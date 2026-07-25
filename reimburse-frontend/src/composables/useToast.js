import { ref } from "vue";

const toast = ref({
  show: false,
  message: "",
  type: "default",
});

let timer = null;

export function useToast() {
  const showToast = (message, type = "default") => {
    if (timer) clearTimeout(timer);
    toast.value = { show: true, message, type };
    timer = setTimeout(() => {
      toast.value.show = false;
    }, 3000);
  };

  return { toast, showToast };
}
