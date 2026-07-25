<script setup>
import { onUnmounted, reactive, ref, watch } from "vue";
import { CheckCircle2, ImageIcon, Upload, X } from "@lucide/vue";
import Button from "@/components/ui/Button.vue";
import { useI18n } from "@/composables/useI18n";
import { cn } from "@/lib/utils";
import { compressImageToBlob } from "@/utils/imageCompression";

const props = defineProps({
  modelValue: {
    type: [File, Array],
    default: null,
  },
  multiple: {
    type: Boolean,
    default: false,
  },
  accept: {
    type: String,
    default: "image/*",
  },
  hint: {
    type: String,
    default: "",
  },
  maxSize: {
    type: Number,
    default: 5 * 1024 * 1024,
  },
  maxFiles: {
    type: Number,
    default: 10,
  },
  existingImages: {
    type: Array,
    default: () => [],
  },
  showExisting: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits([
  "update:modelValue",
  "upload-progress",
  "file-added",
  "file-removed",
  "existing-removed",
]);

const { t } = useI18n();
const uploadZone = ref(null);
const fileInput = ref(null);
const isDragOver = ref(false);
const fileList = ref([]);
let fileIdCounter = 0;

function generateFileId() {
  return `file-${Date.now()}-${fileIdCounter++}`;
}

function getImageUrl(image) {
  if (!image) return null;
  if (typeof image === "string") return image;
  if (typeof image === "object") {
    return image.url || image.image_url || image.path || image.base64 || null;
  }
  return null;
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

function validateFile(file) {
  if (!file.type.startsWith("image/")) {
    return { valid: false, error: "File must be an image" };
  }
  return { valid: true };
}

function generatePreview(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

async function addFile(file) {
  if (!props.multiple && fileList.value.length > 0) {
    const existing = fileList.value[0];
    if (existing.preview && existing.preview.startsWith("blob:")) {
      URL.revokeObjectURL(existing.preview);
    }
    fileList.value = [];
  }

  const validation = validateFile(file);
  if (!validation.valid) {
    fileList.value.push(
      reactive({
        id: generateFileId(),
        name: file.name,
        size: file.size,
        file,
        status: "error",
        errorMessage: validation.error,
        preview: null,
      }),
    );
    updateModelValue();
    return;
  }

  const fileObj = reactive({
    id: generateFileId(),
    name: file.name,
    size: file.size,
    file,
    status: "compressing",
    progress: 0,
    preview: null,
  });

  fileList.value.push(fileObj);
  fileObj.preview = await generatePreview(file);

  try {
    const maxSizeMB = props.maxSize / (1024 * 1024);
    const compressedBlob = await compressImageToBlob(file, maxSizeMB);
    const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
    const compressedFile = new File([compressedBlob], newName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });

    fileObj.file = compressedFile;
    fileObj.size = compressedFile.size;
    fileObj.name = newName;
    fileObj.status = "pending";
    emit("file-added", fileObj);
    updateModelValue();
  } catch (error) {
    console.error("Image compression failed:", error);
    fileObj.status = "error";
    fileObj.errorMessage = "Compression failed";
    if (file.size <= props.maxSize) {
      fileObj.status = "pending";
      fileObj.file = file;
      emit("file-added", fileObj);
      updateModelValue();
    }
  }
}

function removeFile(index) {
  const file = fileList.value[index];
  if (file.preview && file.preview.startsWith("blob:")) {
    URL.revokeObjectURL(file.preview);
  }
  fileList.value.splice(index, 1);
  emit("file-removed", file);
  updateModelValue();
}

function removeExistingImage(index) {
  emit("existing-removed", props.existingImages[index], index);
}

function updateModelValue() {
  if (props.multiple) {
    const files = fileList.value
      .filter((f) => f.status !== "error" && f.status !== "compressing")
      .map((f) => f.file);
    emit("update:modelValue", files.length > 0 ? files : null);
  } else {
    const file = fileList.value.find(
      (f) => f.status !== "error" && f.status !== "compressing",
    );
    emit("update:modelValue", file ? file.file : null);
  }
}

async function handleFileSelect(event) {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;

  if (!props.multiple) {
    fileList.value.forEach((f) => {
      if (f.preview && f.preview.startsWith("blob:")) {
        URL.revokeObjectURL(f.preview);
      }
    });
    fileList.value = [];
    await addFile(files[0]);
  } else {
    if (fileList.value.length + files.length > props.maxFiles) {
      alert(`Maximum ${props.maxFiles} files allowed`);
      return;
    }
    for (const file of files) await addFile(file);
  }

  if (fileInput.value) fileInput.value.value = "";
}

function triggerFileInput() {
  fileInput.value?.click();
}

function handleDragEnter(e) {
  e.preventDefault();
  isDragOver.value = true;
}

function handleDragOver(e) {
  e.preventDefault();
  isDragOver.value = true;
}

function handleDragLeave(e) {
  e.preventDefault();
  if (!uploadZone.value?.contains(e.relatedTarget)) {
    isDragOver.value = false;
  }
}

async function handleDrop(e) {
  e.preventDefault();
  isDragOver.value = false;
  const files = Array.from(e.dataTransfer.files || []);
  if (files.length === 0) return;

  if (!props.multiple) {
    fileList.value.forEach((f) => {
      if (f.preview && f.preview.startsWith("blob:")) {
        URL.revokeObjectURL(f.preview);
      }
    });
    fileList.value = [];
    await addFile(files[0]);
  } else {
    if (fileList.value.length + files.length > props.maxFiles) {
      alert(`Maximum ${props.maxFiles} files allowed`);
      return;
    }
    for (const file of files) await addFile(file);
  }
}

watch(
  () => props.modelValue,
  (newValue) => {
    if (!newValue && fileList.value.length > 0) {
      fileList.value.forEach((f) => {
        if (f.preview && f.preview.startsWith("blob:")) {
          URL.revokeObjectURL(f.preview);
        }
      });
      fileList.value = [];
    }
  },
);

onUnmounted(() => {
  fileList.value.forEach((f) => {
    if (f.preview && f.preview.startsWith("blob:")) {
      URL.revokeObjectURL(f.preview);
    }
  });
});
</script>

<template>
  <div class="w-full min-w-0 space-y-3">
    <div
      v-if="showExisting && existingImages?.length"
      class="space-y-2"
    >
      <div class="text-xs font-medium text-neutral-500">Existing images</div>
      <div
        v-for="(image, index) in existingImages"
        :key="`existing-${index}`"
        class="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3"
      >
        <img
          v-if="getImageUrl(image)"
          :src="getImageUrl(image)"
          alt="Existing"
          class="h-12 w-12 rounded-md border border-neutral-200 object-cover"
        />
        <ImageIcon v-else class="h-8 w-8 text-neutral-300" />
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium">Existing image {{ index + 1 }}</div>
          <div class="text-xs text-neutral-500">Saved</div>
        </div>
        <Button
          variant="secondary"
          size="icon-sm"
          @click="removeExistingImage(index)"
        >
          <X class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <div
      ref="uploadZone"
      :class="
        cn(
          'relative cursor-pointer rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center transition-colors',
          isDragOver && 'border-neutral-900 bg-neutral-100',
          fileList.length > 0 && 'p-4',
        )
      "
      @click="triggerFileInput"
      @dragover.prevent="handleDragOver"
      @dragenter.prevent="handleDragEnter"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
    >
      <input
        ref="fileInput"
        type="file"
        :accept="accept"
        :multiple="false"
        class="hidden"
        @change="handleFileSelect"
      />

      <div v-if="fileList.length === 0" class="space-y-2">
        <div class="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100">
          <Upload class="h-5 w-5 text-neutral-600" />
        </div>
        <div class="text-sm font-medium text-neutral-900">
          {{ t("dragDropBrowse") }}
        </div>
        <div class="text-xs text-neutral-500">
          {{ hint || t("selectImage") }}
        </div>
      </div>
      <div v-else class="space-y-1">
        <div class="text-sm font-medium text-neutral-900">
          {{ fileList.length }} {{ t("fileSelected") }}
        </div>
        <div class="text-xs text-neutral-500">{{ t("clickToChange") }}</div>
      </div>
    </div>

    <div v-if="fileList.length > 0" class="w-full min-w-0 space-y-2">
      <div
        v-for="(file, index) in fileList"
        :key="file.id"
        class="flex w-full min-w-0 flex-col gap-3 overflow-hidden rounded-lg border border-neutral-200 bg-white p-3 sm:flex-row sm:items-center"
      >
        <div
          class="flex w-full min-w-0 max-w-full items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 sm:w-auto sm:shrink-0"
        >
          <img
            v-if="file.preview"
            :src="file.preview"
            alt="Preview"
            class="max-h-40 max-w-full object-contain"
          />
          <ImageIcon v-else class="m-4 h-8 w-8 text-neutral-300" />
        </div>
        <div class="flex min-w-0 flex-1 items-start gap-2 sm:items-center">
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium" :title="file.name">
              {{ file.name }}
            </div>
            <div class="text-xs text-neutral-500">
              {{ formatFileSize(file.size) }}
            </div>
            <div
              v-if="file.status === 'compressing'"
              class="mt-1 text-xs text-neutral-500"
            >
              Compressing…
            </div>
            <div
              v-if="file.status === 'error'"
              class="mt-1 text-xs text-red-600"
            >
              {{ file.errorMessage }}
            </div>
          </div>
          <CheckCircle2
            v-if="file.status === 'complete' || file.status === 'pending'"
            class="h-5 w-5 shrink-0 text-emerald-600"
          />
          <Button
            variant="secondary"
            size="icon-sm"
            class="shrink-0"
            @click.stop="removeFile(index)"
          >
            <X class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
