/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bgBase: '#0B0D10',
        bgPanel: '#14171C',
        bgPanelAlt: '#1A1E24',
        borderHairline: '#262B33',
        textPrimary: '#E6E9ED',
        textMuted: '#7C8593',
        accent: '#3D8BFF',
        accentHover: '#2A76EA',
        up: '#1FBF75',
        down: '#F0433D',
        warn: '#E8A33D',
        gold: '#F59E0B',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        sans: ['Inter', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        none: '0px',
        sm: '1px',
        DEFAULT: '2px',
        md: '2px',
        lg: '2px',
        xl: '2px',
      },
    },
  },
  plugins: [],
};
