<template>
  <v-container fluid class="pa-1 pa-md-3">
    <v-row justify="center" class="ma-0">
      <v-col cols="12" md="11" lg="10" class="pa-1 pa-md-3">
        <v-card class="pa-3 pa-md-4 admin-card">
          <v-card-title class="text-h4 mb-4 text-premium">
            💸 Reimbursement Tracker
          </v-card-title>

          <!-- List Management View -->
          <div v-if="currentView === 'list'">
            <v-row class="mb-4">
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="newListName"
                  label="New list name"
                  variant="outlined"
                  density="compact"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="8" class="d-flex gap-2 flex-wrap">
                <v-btn
                  class="btn-premium"
                  @click="createList"
                  :loading="loading"
                >
                  📝 Create New List
                </v-btn>
                <v-select
                  v-model="selectedListId"
                  :items="lists"
                  item-title="displayName"
                  item-value="id"
                  label="Select a list..."
                  variant="outlined"
                  density="compact"
                  style="max-width: 300px;"
                ></v-select>
                <v-btn
                  color="primary"
                  variant="outlined"
                  @click="loadList"
                  :disabled="!selectedListId"
                  :loading="loading"
                >
                  📂 Load List
                </v-btn>
                <v-btn
                  color="error"
                  variant="outlined"
                  @click="deleteList"
                  :disabled="!selectedListId"
                  :loading="loading"
                >
                  🗑️ Delete List
                </v-btn>
              </v-col>
            </v-row>
            <v-alert
              v-if="currentListName"
              type="info"
              class="mb-4"
            >
              Current List: <strong>{{ currentListName }}</strong>
            </v-alert>
          </div>

          <!-- Form and Table View -->
          <div v-else>
            <v-btn
              color="secondary"
              variant="outlined"
              class="mb-4"
              @click="switchView('list')"
            >
              ← Back to Lists
            </v-btn>

            <v-alert
              v-if="currentListName"
              type="info"
              class="mb-4"
            >
              Current List: <strong>{{ currentListName }}</strong>
            </v-alert>

            <!-- Entry Form -->
            <div class="mb-6">
              <h3 class="text-h6 mb-4 text-premium">Add New Entry</h3>
              <v-form @submit.prevent="addEntry">
                <v-row>
                  <v-col cols="12" md="3">
                    <v-text-field
                      v-model="entryForm.date"
                      type="date"
                      label="Date"
                      variant="outlined"
                      required
                    ></v-text-field>
                  </v-col>
                  <v-col cols="12" md="3">
                    <v-text-field
                      v-model="entryForm.category"
                      label="Category"
                      placeholder="e.g. Transport, Meals"
                      variant="outlined"
                      required
                    ></v-text-field>
                  </v-col>
                  <v-col cols="12" md="3">
                    <v-text-field
                      v-model="entryForm.note"
                      label="Note"
                      placeholder="Optional"
                      variant="outlined"
                    ></v-text-field>
                  </v-col>
                  <v-col cols="12" md="3">
                    <v-text-field
                      v-model="entryForm.amount"
                      label="Amount (IDR)"
                      variant="outlined"
                      required
                      @input="formatAmountInput"
                    ></v-text-field>
                  </v-col>
                  <v-col cols="12" md="6">
                    <UploadImage
                      v-model="entryForm.proof"
                      :multiple="false"
                      :max-size="10 * 1024 * 1024"
                      hint="Select one image file (max 10MB)"
                      accept="image/*"
                      :show-existing="false"
                      @file-added="handleImageAdded"
                    />
                  </v-col>
                  <v-col cols="12" md="6" class="d-flex align-center">
                    <v-btn
                      type="submit"
                      class="btn-premium"
                      :loading="saving"
                      block
                    >
                      ＋ Add Entry
                    </v-btn>
                  </v-col>
                </v-row>
              </v-form>
            </div>

            <v-divider class="my-6"></v-divider>

            <!-- Entries Table -->
            <div>
              <h3 class="text-h6 mb-4 text-premium">Entries</h3>
              <div class="table-wrapper">
                <v-table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Note</th>
                      <th>Amount</th>
                      <th>Proof</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(entry, idx) in entries" :key="idx">
                      <td>{{ entry.Date }}</td>
                      <td>{{ entry.Category }}</td>
                      <td>{{ entry.Note || '-' }}</td>
                      <td>{{ formatIDR(entry.Amount) }}</td>
                      <td>
                        <v-img
                          v-if="getProofUrl(entry.Proof)"
                          :src="getProofUrl(entry.Proof)"
                          max-width="150"
                          max-height="150"
                          style="border-radius: 6px;"
                          cover
                        >
                          <template v-slot:error>
                            <div class="text-caption text-center pa-2">
                              Image unavailable
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
                  Total: {{ formatIDR(total) }}
                </h3>
              </div>

              <v-row class="mt-4">
                <v-col cols="12" md="6">
                  <v-btn
                    class="btn-premium"
                    block
                    @click="handleExportPDFEnglish"
                    :loading="exporting"
                  >
                    📄 Export PDF (English)
                  </v-btn>
                </v-col>
                <v-col cols="12" md="6">
                  <v-btn
                    class="btn-premium"
                    block
                    @click="handleExportPDFChinese"
                    :loading="exporting"
                  >
                    📄 Export PDF (中文)
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
import UploadImage from '../components/UploadImage.vue'
import { ref, onMounted, computed } from 'vue'
import api from '../services/api'
// Image compression utilities no longer needed - backend handles it
import { formatIDR, parseAmount } from '../utils/formatters'
import { exportPDFEnglish, exportPDFChinese } from '../utils/pdfExport'

const currentView = ref('list')
const loading = ref(false)
const saving = ref(false)
const exporting = ref(false)
const lists = ref([])
const selectedListId = ref(null)
const currentListId = ref(null)
const currentListName = ref('')
const entries = ref([])
const total = ref(0)
const newListName = ref('')

const entryForm = ref({
  date: '',
  category: '',
  note: '',
  amount: '',
  proof: null
})

const snackbar = ref({
  show: false,
  message: '',
  color: 'success'
})

const showSnackbar = (message, color = 'success') => {
  snackbar.value = { show: true, message, color }
}

const formatAmountInput = (e) => {
  const value = e.target.value
  const numeric = parseAmount(value)
  if (!isNaN(numeric) && numeric >= 0) {
    const formatted = numeric.toFixed().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    entryForm.value.amount = formatted
  }
}

const getProofUrl = (proof) => {
  if (!proof) return null
  
  // Handle object format {url: '/images/...'}
  if (typeof proof === 'object' && proof !== null) {
    if (proof.url) {
      // If it's a relative URL, the proxy will handle it
      // If it's absolute, use it directly
      return proof.url.startsWith('http') ? proof.url : proof.url
    }
    // Fallback to base64 if available (for old entries)
    return proof.base64 || null
  }
  
  // Handle string URLs
  if (typeof proof === 'string') {
    if (proof.startsWith('data:image')) {
      return proof
    }
    // Relative or absolute URL
    return proof.startsWith('http') ? proof : proof
  }
  
  return null
}

const switchView = (view) => {
  currentView.value = view
}

const loadLists = async () => {
  try {
    loading.value = true
    const response = await api.getLists()
    if (response.success) {
      lists.value = response.lists.map(list => ({
        id: list.id,
        name: list.name,
        displayName: `${list.name} (${new Date(list.createdAt).toLocaleDateString()})`
      }))
    }
  } catch (error) {
    showSnackbar('Failed to load lists', 'error')
  } finally {
    loading.value = false
  }
}

const createList = async () => {
  if (!newListName.value.trim()) {
    showSnackbar('Please enter a list name', 'error')
    return
  }

  try {
    loading.value = true
    const response = await api.createList(newListName.value.trim())
    if (response.success) {
      currentListId.value = response.list.id
      currentListName.value = response.list.name
      entries.value = []
      total.value = 0
      newListName.value = ''
      switchView('form')
      await loadLists()
      showSnackbar(`Created new list: ${currentListName.value}`)
    }
  } catch (error) {
    showSnackbar('Failed to create list', 'error')
  } finally {
    loading.value = false
  }
}

const loadList = async () => {
  if (!selectedListId.value) {
    showSnackbar('Please select a list to load', 'error')
    return
  }

  try {
    loading.value = true
    const response = await api.getList(selectedListId.value)
    if (response.success) {
      const list = response.list
      currentListId.value = list.id
      currentListName.value = list.name
      entries.value = list.entries || []
      total.value = list.total || 0
      switchView('form')
      showSnackbar(`Loaded list: ${currentListName.value}`)
    }
  } catch (error) {
    showSnackbar('Failed to load list', 'error')
  } finally {
    loading.value = false
  }
}

const deleteList = async () => {
  if (!selectedListId.value) {
    showSnackbar('Please select a list to delete', 'error')
    return
  }

  if (!confirm('Are you sure you want to delete this list? This action cannot be undone.')) {
    return
  }

  try {
    loading.value = true
    const response = await api.deleteList(selectedListId.value)
    if (response.success) {
      if (currentListId.value === selectedListId.value) {
        currentListId.value = null
        currentListName.value = ''
        entries.value = []
        total.value = 0
        switchView('list')
      }
      await loadLists()
      selectedListId.value = null
      showSnackbar('List deleted successfully')
    }
  } catch (error) {
    showSnackbar('Failed to delete list', 'error')
  } finally {
    loading.value = false
  }
}

const handleImageAdded = (fileObj) => {
  // File is automatically added to entryForm.proof via v-model
  console.log('Image added:', fileObj)
}

const addEntry = async () => {
  if (!currentListId.value) {
    showSnackbar('Please create or load a list first', 'error')
    return
  }

  const amount = parseAmount(entryForm.value.amount)
  if (isNaN(amount) || amount <= 0) {
    showSnackbar('Please enter a valid amount', 'error')
    return
  }

  try {
    saving.value = true
    let proofUrl = null

    // Upload image if provided (backend will compress it)
    const proofFile = entryForm.value.proof
    
    if (proofFile && proofFile instanceof File) {
      try {
        const uploadResponse = await api.uploadImage(proofFile)
        if (uploadResponse.success) {
          proofUrl = uploadResponse.url
        }
      } catch (error) {
        console.error('Image upload error:', error)
        showSnackbar('Failed to upload image, entry will be saved without image', 'warning')
      }
    }

    const newEntry = {
      Date: entryForm.value.date,
      Category: entryForm.value.category,
      Note: entryForm.value.note,
      Amount: amount,
      Proof: proofUrl ? { url: proofUrl } : null
    }

    entries.value.push(newEntry)
    total.value += amount

    // Save to backend
    await api.updateList(currentListId.value, {
      entries: entries.value,
      total: total.value
    })

    // Reset form (including image)
    entryForm.value = {
      date: '',
      category: '',
      note: '',
      amount: '',
      proof: null
    }
    
    // Force component to reset by clearing the file input
    // The UploadImage component will handle this via v-model

    showSnackbar('Entry added successfully')
  } catch (error) {
    console.error('Error adding entry:', error)
    showSnackbar('Failed to add entry', 'error')
  } finally {
    saving.value = false
  }
}

const deleteEntry = async (index) => {
  const entry = entries.value[index]
  if (!confirm(`Are you sure you want to delete this entry?\nDate: ${entry.Date}\nCategory: ${entry.Category}\nAmount: ${formatIDR(entry.Amount)}`)) {
    return
  }

  try {
    const removedAmount = entry.Amount
    
    // If entry has an ID (loaded from database), use the delete endpoint
    // This will also delete the associated image from the backend
    if (entry.id) {
      try {
        await api.deleteEntry(entry.id)
        // Entry and image deleted from backend, now update local state
        entries.value.splice(index, 1)
        total.value -= removedAmount
        
        // Update the list to sync the remaining entries and total
        await api.updateList(currentListId.value, {
          entries: entries.value,
          total: total.value
        })
        
        showSnackbar('Entry deleted successfully')
      } catch (error) {
        console.error('Error deleting entry from backend:', error)
        showSnackbar('Failed to delete entry', 'error')
      }
    } else {
      // Entry doesn't have ID (newly added, not saved yet)
      // Just remove from local array and update list
      entries.value.splice(index, 1)
      total.value -= removedAmount

      await api.updateList(currentListId.value, {
        entries: entries.value,
        total: total.value
      })

      showSnackbar('Entry deleted successfully')
    }
  } catch (error) {
    console.error('Error deleting entry:', error)
    showSnackbar('Failed to delete entry', 'error')
  }
}

const handleExportPDFEnglish = async () => {
  try {
    exporting.value = true
    await exportPDFEnglish(currentListName.value, entries.value, total.value)
    showSnackbar('PDF exported successfully')
  } catch (error) {
    showSnackbar('Failed to export PDF', 'error')
  } finally {
    exporting.value = false
  }
}

const handleExportPDFChinese = async () => {
  try {
    exporting.value = true
    await exportPDFChinese(currentListName.value, entries.value, total.value)
    showSnackbar('PDF导出成功！')
  } catch (error) {
    showSnackbar('PDF生成失败', 'error')
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  loadLists()
})
</script>

<style scoped>
.gap-2 {
  gap: var(--spacing-sm);
}

/* Mobile-specific adjustments */
@media (max-width: 600px) {
  .v-card-title {
    font-size: 1.5rem !important;
  }
  
  .v-card {
    padding: var(--spacing-md) !important;
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

