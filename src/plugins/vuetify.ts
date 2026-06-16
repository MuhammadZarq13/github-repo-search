import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'

export const vuetify = createVuetify({
  icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        dark: false,
        colors: { primary: '#2563eb', secondary: '#475569' },
      },
      dark: {
        dark: true,
        colors: { primary: '#60a5fa', secondary: '#94a3b8' },
      },
    },
  },
  defaults: {
    VTextField: { variant: 'outlined', density: 'comfortable', hideDetails: 'auto' },
    VCard: { rounded: 'lg' },
    VBtn: { rounded: 'lg' },
  },
})
