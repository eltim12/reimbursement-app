import axios from 'axios'

const api = axios.create({
  baseURL: 'https://reimburse-api.trimind.studio/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

export default {
  // Lists
  async getLists() {
    const response = await api.get('/lists')
    return response.data
  },

  async getList(id) {
    const response = await api.get(`/lists/${id}`)
    return response.data
  },

  async createList(name) {
    const response = await api.post('/lists', { name })
    return response.data
  },

  async updateList(id, data) {
    const response = await api.put(`/lists/${id}`, data)
    return response.data
  },

  async deleteList(id) {
    const response = await api.delete(`/lists/${id}`)
    return response.data
  },

  // Image upload (multipart/form-data)
  async uploadImage(file) {
    const formData = new FormData()
    formData.append('image', file)
    
    const response = await api.post('/upload-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  // Delete entry
  async deleteEntry(id) {
    const response = await api.delete(`/entries/${id}`)
    return response.data
  },
}

