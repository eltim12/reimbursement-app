import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import '@mdi/font/css/materialdesignicons.css'

export default createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'dark',
    themes: {
      dark: {
        colors: {
          primary: '#8B5CF6',
          secondary: '#A78BFA',
          accent: '#A78BFA',
          error: '#ef5350',
          info: '#8B5CF6',
          success: '#4caf50',
          warning: '#ff9800',
          background: '#0D0D0D',
          surface: '#111827',
          'on-background': '#F5F5F5',
          'on-surface': '#F5F5F5',
        },
        dark: true,
      },
    },
  },
  defaults: {
    VCard: {
      elevation: 0,
      class: 'glass-card',
    },
    VBtn: {
      style: 'text-transform: none; letter-spacing: -0.01em;',
    },
    VTextField: {
      variant: 'outlined',
      density: 'comfortable',
    },
    VSelect: {
      variant: 'outlined',
      density: 'comfortable',
    },
    VFileInput: {
      variant: 'outlined',
      density: 'comfortable',
    },
  },
})

