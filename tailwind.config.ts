import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Lexend', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Material Design 3 绿松石主题
        surface: '#d8fff0',
        'surface-container-low': '#bffee7',
        'surface-container-lowest': '#ffffff',
        'surface-container-highest': '#9decd2',
        'surface-variant': '#9decd2',
        'on-surface': '#00362a',
        'on-surface-variant': '#2f6555',
        primary: '#006a28',
        'primary-container': '#5cfd80',
        'primary-dim': '#005d22',
        'on-primary': '#cfffce',
        'on-primary-container': '#005d22',
        secondary: '#005e9f',
        'secondary-container': '#b3d4ff',
        'on-secondary': '#edf3ff',
        'on-secondary-container': '#004a7e',
        tertiary: '#6d5a00',
        'tertiary-container': '#fdd400',
        'on-tertiary': '#fff2ce',
        error: '#b31b25',
        'error-container': '#fb5151',
        'on-error': '#ffefee',
      },
      borderRadius: {
        'xl': '3rem',
        'lg': '2rem',
        'default': '1rem',
        'sm': '0.75rem',
      },
      boxShadow: {
        'ambient': '0 32px 64px -12px rgba(0, 54, 42, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
