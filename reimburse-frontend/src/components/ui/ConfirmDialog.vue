<script setup>
import { computed, useSlots } from "vue";
import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";
import { useI18n } from "@/composables/useI18n";

const props = defineProps({
  open: Boolean,
  title: {
    type: String,
    default: "",
  },
  description: {
    type: String,
    default: "",
  },
  confirmLabel: {
    type: String,
    default: "",
  },
  cancelLabel: {
    type: String,
    default: "",
  },
  loading: Boolean,
});

const emit = defineEmits(["update:open", "confirm", "cancel"]);
const { t } = useI18n();
const slots = useSlots();

const hasBody = computed(
  () => !!props.description || !!slots.default,
);

const onCancel = () => {
  emit("update:open", false);
  emit("cancel");
};

const onConfirm = () => {
  emit("confirm");
};
</script>

<template>
  <Dialog
    :open="open"
    :title="title"
    class="max-w-md"
    actions-class="grid w-full grid-cols-2 gap-2"
    @update:open="onCancel"
  >
    <div v-if="hasBody" class="space-y-3">
      <p v-if="description" class="text-sm text-neutral-600 whitespace-pre-line">
        {{ description }}
      </p>
      <slot />
    </div>
    <template #actions>
      <Button
        variant="outline"
        type="button"
        class="h-11 w-full"
        :disabled="loading"
        @click="onCancel"
      >
        {{ cancelLabel || t("cancel") }}
      </Button>
      <Button
        variant="destructive"
        type="button"
        class="h-11 w-full"
        :loading="loading"
        @click="onConfirm"
      >
        {{ confirmLabel || t("delete") }}
      </Button>
    </template>
  </Dialog>
</template>
