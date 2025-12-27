<template>
  <div class="upload-image-component">
    <!-- Existing Images Section -->
    <div v-if="showExisting && existingImages && existingImages.length > 0" class="existing-section">
      <div class="section-header">EXISTING IMAGES</div>
      <div class="file-list">
        <div
          v-for="(image, index) in existingImages"
          :key="`existing-${index}`"
          class="file-item existing-item"
        >
          <div class="file-item-left-border existing-border"></div>
          <div class="file-thumbnail">
            <img
              v-if="getImageUrl(image)"
              :src="getImageUrl(image)"
              alt="Existing image"
              @error="handleImageError"
            />
            <v-icon v-else size="32" color="rgba(255, 255, 255, 0.5)">mdi-image</v-icon>
          </div>
          <div class="file-info">
            <div class="file-name">Existing Image {{ index + 1 }}</div>
            <div class="file-size">Saved</div>
          </div>
          <div class="file-actions">
            <v-btn
              icon
              size="small"
              variant="text"
              color="error"
              class="remove-btn"
              @click="removeExistingImage(index)"
            >
              <v-icon size="20">mdi-close</v-icon>
            </v-btn>
          </div>
        </div>
      </div>
    </div>

    <!-- Upload Zone -->
    <div
      ref="uploadZone"
      class="upload-zone"
      :class="{
        'has-files': fileList.length > 0,
        'drag-over': isDragOver,
        'has-existing': showExisting && existingImages && existingImages.length > 0
      }"
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
        class="file-input"
        @change="handleFileSelect"
      />

      <!-- Empty State -->
      <div v-if="fileList.length === 0" class="upload-zone-content">
        <div class="upload-icon">
          <v-icon size="64" color="#8B5CF6">mdi-cloud-upload-outline</v-icon>
        </div>
        <div class="upload-text-primary">Drag and drop or browse</div>
        <div class="upload-text-secondary">{{ hint || 'Select image files to upload' }}</div>
        <div class="gradient-overlay" :class="{ 'visible': isDragOver }"></div>
      </div>

      <!-- Has Files State -->
      <div v-else class="upload-zone-content has-files-content">
        <div class="upload-text-primary">{{ fileList.length }} file(s) selected</div>
        <div class="upload-text-secondary">Click to change the file</div>
      </div>
    </div>

    <!-- File List -->
    <div v-if="fileList.length > 0" class="file-list">
      <div
        v-for="(file, index) in fileList"
        :key="file.id"
        class="file-item"
        :class="{
          'uploading': file.status === 'uploading',
          'compressing': file.status === 'compressing',
          'complete': file.status === 'complete',
          'error': file.status === 'error'
        }"
      >
        <div
          class="file-item-left-border"
          :class="{
            'success': file.status === 'complete',
            'error': file.status === 'error',
            'visible': file.status === 'complete' || file.status === 'error'
          }"
        ></div>
        <div class="file-thumbnail">
          <img
            v-if="file.preview"
            :src="file.preview"
            alt="Preview"
            @error="handlePreviewError(file)"
          />
          <v-icon v-else size="32" color="rgba(255, 255, 255, 0.5)">mdi-image</v-icon>
        </div>
        <div class="file-info">
          <div class="file-name" :title="file.name">{{ file.name }}</div>
          <div class="file-size">{{ formatFileSize(file.size) }}</div>
          <div v-if="file.status === 'uploading'" class="progress-bar-container">
            <div class="progress-bar" :style="{ width: `${file.progress}%` }"></div>
          </div>
          <div v-if="file.status === 'compressing'" class="compressing-message">Compressing...</div>
          <div v-if="file.status === 'error'" class="error-message">{{ file.errorMessage }}</div>
        </div>
        <div class="file-actions">
          <v-icon
            v-if="file.status === 'complete'"
            size="24"
            color="#10B981"
            class="success-checkmark"
          >
            mdi-check-circle
          </v-icon>
          <v-btn
            icon
            size="small"
            variant="text"
            color="error"
            class="remove-btn"
            @click="removeFile(index)"
          >
            <v-icon size="20">mdi-close</v-icon>
          </v-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, reactive } from 'vue'
import { compressImageToBlob } from '../utils/imageCompression'

const props = defineProps({
  modelValue: {
    type: [File, Array],
    default: null
  },
  multiple: {
    type: Boolean,
    default: false
  },
  accept: {
    type: String,
    default: 'image/*'
  },
  hint: {
    type: String,
    default: ''
  },
  maxSize: {
    type: Number,
    default: 5 * 1024 * 1024 // 5MB
  },
  maxFiles: {
    type: Number,
    default: 10
  },
  existingImages: {
    type: Array,
    default: () => []
  },
  showExisting: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue', 'upload-progress', 'file-added', 'file-removed', 'existing-removed'])

const uploadZone = ref(null)
const fileInput = ref(null)
const isDragOver = ref(false)
const fileList = ref([])
let fileIdCounter = 0

// Generate unique ID for each file
function generateFileId() {
  return `file-${Date.now()}-${fileIdCounter++}`
}

// Get image URL from various formats
function getImageUrl(image) {
  if (!image) return null
  if (typeof image === 'string') return image
  if (typeof image === 'object') {
    return image.url || image.image_url || image.path || image.base64 || null
  }
  return null
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

// Validate file
function validateFile(file) {
  // Check file type
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'File must be an image' }
  }

  // Size check removed as we now compress automatically
  return { valid: true }
}

// Generate preview
function generatePreview(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

// Add file to list
async function addFile(file) {
  // If not multiple mode and we already have a file, replace it
  if (!props.multiple && fileList.value.length > 0) {
    const existing = fileList.value[0]
    if (existing.preview && existing.preview.startsWith('blob:')) {
      URL.revokeObjectURL(existing.preview)
    }
    fileList.value = []
  }

  const validation = validateFile(file)
  if (!validation.valid) {
    fileList.value.push(reactive({
      id: generateFileId(),
      name: file.name,
      size: file.size,
      file: file,
      status: 'error',
      errorMessage: validation.error,
      preview: null
    }))
    updateModelValue()
    return
  }

  // Create temporary entry
  const fileObj = reactive({
    id: generateFileId(),
    name: file.name,
    size: file.size,
    file: file,
    status: 'compressing', // Set initial status to compressing
    progress: 0,
    preview: null
  })
  
  // Add to list immediately to show in UI
  fileList.value.push(fileObj)

  // Generate preview
  const preview = await generatePreview(file)
  fileObj.preview = preview
  
  try {
    // Compress image
    // Calculate max size in MB
    const maxSizeMB = props.maxSize / (1024 * 1024)
    const compressedBlob = await compressImageToBlob(file, maxSizeMB)
    
    // Create new File object from compressed blob
    // Replace extension with .jpg as compression converts to jpeg
    const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg"
    const compressedFile = new File([compressedBlob], newName, { 
      type: 'image/jpeg',
      lastModified: Date.now()
    })
    
    // Update file object
    fileObj.file = compressedFile
    fileObj.size = compressedFile.size
    fileObj.name = newName
    fileObj.status = 'pending'
    
    emit('file-added', fileObj)
    updateModelValue()
    
  } catch (error) {
    console.error('Image compression failed:', error)
    fileObj.status = 'error'
    fileObj.errorMessage = 'Compression failed'
    // Fallback? Or just keep error? 
    // If compression fails, we probably shouldn't upload the huge file if it was explicitly huge.
    // Use original file as fallback if it's within limits?
    if (file.size <= props.maxSize) {
        fileObj.status = 'pending'
        fileObj.file = file
        emit('file-added', fileObj)
        updateModelValue()
    }
  }
}

// Remove file
function removeFile(index) {
  const file = fileList.value[index]
  if (file.preview && file.preview.startsWith('blob:')) {
    URL.revokeObjectURL(file.preview)
  }
  fileList.value.splice(index, 1)
  emit('file-removed', file)
  updateModelValue()
}

// Remove existing image
function removeExistingImage(index) {
  const image = props.existingImages[index]
  emit('existing-removed', image, index)
}

// Update model value
function updateModelValue() {
  if (props.multiple) {
    const files = fileList.value
      .filter(f => f.status !== 'error' && f.status !== 'compressing') // Wait for compression
      .map(f => f.file)
      // Only emit if we have files valid and ready? 
      // If compressing, we might wait, but emit empty or partial?
      // Usually better to wait until ready to emit model update if strict?
      // But user can click submit?
      // If we filter out 'compressing', the modelValue won't have the file yet, 
      // so 'required' validation on parent form will fail until compression done. This is GOOD.
    emit('update:modelValue', files.length > 0 ? files : null)
  } else {
    const file = fileList.value.find(f => f.status !== 'error' && f.status !== 'compressing')
    emit('update:modelValue', file ? file.file : null)
  }
}

// Handle file select
async function handleFileSelect(event) {
  const files = Array.from(event.target.files || [])
  if (files.length === 0) return

  // If not multiple mode, only allow one file
  if (!props.multiple) {
    if (files.length > 1) {
      alert('Only one image can be uploaded at a time. Using the first selected file.')
    }
    // Clear existing files first
    fileList.value.forEach(f => {
      if (f.preview && f.preview.startsWith('blob:')) {
        URL.revokeObjectURL(f.preview)
      }
    })
    fileList.value = []
    // Only process the first file
    await addFile(files[0])
  } else {
    // Multiple mode: check max files limit
    if (fileList.value.length + files.length > props.maxFiles) {
      alert(`Maximum ${props.maxFiles} files allowed`)
      return
    }
    // Add all files
    for (const file of files) {
      await addFile(file)
    }
  }

  // Reset input
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

// Trigger file input
function triggerFileInput() {
  if (fileInput.value) {
    fileInput.value.click()
  }
}

// Drag and drop handlers
function handleDragEnter(e) {
  e.preventDefault()
  isDragOver.value = true
}

function handleDragOver(e) {
  e.preventDefault()
  isDragOver.value = true
}

function handleDragLeave(e) {
  e.preventDefault()
  // Only set to false if leaving the upload zone itself
  if (!uploadZone.value?.contains(e.relatedTarget)) {
    isDragOver.value = false
  }
}

async function handleDrop(e) {
  e.preventDefault()
  isDragOver.value = false

  const files = Array.from(e.dataTransfer.files || [])
  if (files.length === 0) return

  // If not multiple mode, only allow one file
  if (!props.multiple) {
    if (files.length > 1) {
      alert('Only one image can be uploaded at a time. Using the first dropped file.')
    }
    // Clear existing files first
    fileList.value.forEach(f => {
      if (f.preview && f.preview.startsWith('blob:')) {
        URL.revokeObjectURL(f.preview)
      }
    })
    fileList.value = []
    // Only process the first file
    await addFile(files[0])
  } else {
    // Multiple mode: check max files limit
    if (fileList.value.length + files.length > props.maxFiles) {
      alert(`Maximum ${props.maxFiles} files allowed`)
      return
    }
    // Add all files
    for (const file of files) {
      await addFile(file)
    }
  }
}

// Handle image errors
function handleImageError(event) {
  event.target.style.display = 'none'
}

function handlePreviewError(file) {
  file.preview = null
}

// Watch for external model value changes (only clear when set to null)
watch(() => props.modelValue, (newValue, oldValue) => {
  // Only clear if explicitly set to null/undefined and we have files
  if (!newValue && fileList.value.length > 0) {
    // Clear all previews
    fileList.value.forEach(f => {
      if (f.preview && f.preview.startsWith('blob:')) {
        URL.revokeObjectURL(f.preview)
      }
    })
    fileList.value = []
  }
})

// Cleanup on unmount
onUnmounted(() => {
  fileList.value.forEach(f => {
    if (f.preview && f.preview.startsWith('blob:')) {
      URL.revokeObjectURL(f.preview)
    }
  })
})
</script>

<style scoped>
.upload-image-component {
  width: 100%;
}

/* Existing Images Section */
.existing-section {
  margin-bottom: 16px;
}

.section-header {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}

/* Upload Zone */
.upload-zone {
  position: relative;
  width: 100%;
  border: 2px dashed rgba(139, 92, 246, 0.3);
  border-radius: 16px;
  background: rgba(139, 92, 246, 0.05);
  padding: 48px 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.upload-zone.has-files {
  padding: 24px;
  border-color: rgba(139, 92, 246, 0.2);
  background: rgba(139, 92, 246, 0.03);
}

.upload-zone.has-existing {
  margin-top: 0;
}

.upload-zone:hover:not(.drag-over) {
  border-color: rgba(139, 92, 246, 0.5);
  background: rgba(139, 92, 246, 0.08);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(139, 92, 246, 0.15);
}

.upload-zone.drag-over {
  border-color: rgba(139, 92, 246, 0.8);
  background: rgba(139, 92, 246, 0.15);
  transform: scale(1.02);
  box-shadow: 0 12px 32px rgba(139, 92, 246, 0.25);
}

.file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.upload-zone-content {
  position: relative;
  z-index: 1;
}

.upload-icon {
  margin-bottom: 16px;
}

.upload-text-primary {
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 0.3px;
  margin: 0 0 8px 0;
}

.upload-text-secondary {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
}

.has-files-content .upload-text-primary {
  font-size: 14px;
}

.gradient-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(167, 139, 250, 0.05) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.gradient-overlay.visible {
  opacity: 1;
}

/* File List */
.file-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.file-list:first-child {
  margin-top: 0;
}

/* File Item */
.file-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: rgba(17, 24, 39, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.file-item:hover {
  background: rgba(17, 24, 39, 0.8);
  border-color: rgba(139, 92, 246, 0.3);
  transform: translateX(4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.file-item:hover .file-item-left-border {
  transform: scaleY(1);
}

.file-item.existing-item {
  border-color: rgba(139, 92, 246, 0.2);
  background: rgba(139, 92, 246, 0.03);
}

.file-item.existing-item .file-item-left-border.existing-border {
  transform: scaleY(1);
  background: rgba(139, 92, 246, 0.6);
}

.file-item.error {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.05);
}

.file-item.error .file-item-left-border {
  transform: scaleY(1);
  background: rgba(239, 68, 68, 0.8);
}

.file-item.complete .file-item-left-border {
  transform: scaleY(1);
  background: rgba(16, 185, 129, 0.8);
}

.file-item-left-border {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: rgba(139, 92, 246, 0.5);
  transform: scaleY(0);
  transform-origin: top;
  transition: transform 0.3s ease;
}

.file-item-left-border.visible {
  transform: scaleY(1);
}

.file-item-left-border.success {
  background: rgba(16, 185, 129, 0.8);
}

.file-item-left-border.error {
  background: rgba(239, 68, 68, 0.8);
}

/* Thumbnail */
.file-thumbnail {
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.file-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* File Info */
.file-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-size {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.progress-bar-container {
  margin-top: 8px;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: #8B5CF6;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.error-message {
  font-size: 12px;
  color: rgba(239, 68, 68, 0.9);
  margin-top: 4px;
}

.compressing-message {
  font-size: 12px;
  color: #8B5CF6;
  margin-top: 4px;
  font-weight: 500;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
}

/* File Actions */
.file-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.success-checkmark {
  animation: checkmark-appear 0.3s ease;
}

@keyframes checkmark-appear {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.remove-btn {
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.file-item:hover .remove-btn {
  opacity: 1;
}

/* Mobile Responsive */
@media (max-width: 600px) {
  .upload-zone {
    padding: 32px 16px;
  }

  .upload-zone.has-files {
    padding: 16px;
  }

  .upload-icon {
    margin-bottom: 12px;
  }

  .upload-icon :deep(.v-icon) {
    font-size: 48px !important;
  }

  .upload-text-primary {
    font-size: 14px;
  }

  .upload-text-secondary {
    font-size: 12px;
  }

  .file-item {
    padding: 12px;
    gap: 12px;
  }

  .file-thumbnail {
    width: 48px;
    height: 48px;
  }

  .file-name {
    font-size: 13px;
  }

  .file-size {
    font-size: 11px;
  }
}
</style>

