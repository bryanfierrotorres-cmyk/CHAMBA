/** @type {import('tailwindcss').Config} */

module.exports = {

  content: ['./src/**/*.{js,jsx,ts,tsx}', './app/**/*.{js,jsx,ts,tsx}'],

  presets: [require('nativewind/preset')],

  theme: {

    extend: {

      colors: {

        // Material 3 — Stitch worker palette

        primary: '#004ac6',

        'on-primary': '#ffffff',

        'primary-container': '#2563eb',

        'on-primary-container': '#eeefff',

        'primary-fixed': '#dbe1ff',

        'primary-fixed-dim': '#b4c5ff',

        'on-primary-fixed': '#00174b',

        'on-primary-fixed-variant': '#003ea8',

        secondary: '#006c49',

        'on-secondary': '#ffffff',

        'secondary-container': '#6cf8bb',

        'on-secondary-container': '#00714d',

        'secondary-fixed': '#6ffbbe',

        'secondary-fixed-dim': '#4edea3',

        'on-secondary-fixed': '#002113',

        'on-secondary-fixed-variant': '#005236',

        tertiary: '#943700',

        'on-tertiary': '#ffffff',

        'tertiary-container': '#bc4800',

        'on-tertiary-container': '#ffede6',

        'tertiary-fixed': '#ffdbcd',

        'tertiary-fixed-dim': '#ffb596',

        'on-tertiary-fixed': '#360f00',

        'on-tertiary-fixed-variant': '#7d2d00',

        background: '#f8f9ff',

        'on-background': '#0b1c30',

        surface: '#f8f9ff',

        'on-surface': '#0b1c30',

        'surface-variant': '#d3e4fe',

        'on-surface-variant': '#434655',

        'surface-dim': '#cbdbf5',

        'surface-bright': '#f8f9ff',

        'surface-container-lowest': '#ffffff',

        'surface-container-low': '#eff4ff',

        'surface-container': '#e5eeff',

        'surface-container-high': '#dce9ff',

        'surface-container-highest': '#d3e4fe',

        outline: '#737686',

        'outline-variant': '#c3c6d7',

        'inverse-surface': '#213145',

        'inverse-on-surface': '#eaf1ff',

        'inverse-primary': '#b4c5ff',

        error: '#ba1a1a',

        'on-error': '#ffffff',

        'error-container': '#ffdad6',

        'on-error-container': '#93000a',

        // Legacy aliases (admin/client dark theme)

        brand: {

          50:  '#f0fdf4',

          100: '#dcfce7',

          200: '#bbf7d0',

          300: '#86efac',

          400: '#4ade80',

          500: '#22c55e',

          600: '#16a34a',

          700: '#15803d',

          800: '#166534',

          900: '#14532d',

        },

        dark: {

          50:  '#18181b',

          100: '#141414',

          200: '#111111',

          300: '#0d0d0d',

          400: '#0A0A0A',

        },

      },

      spacing: {

        base: '8px',

        'touch-target-min': '48px',

        'stack-gap': '12px',

        'container-padding': '16px',

      },

      fontFamily: {

        sans: ['Inter', 'System', 'sans-serif'],

      },

    },

  },

  plugins: [],

};

