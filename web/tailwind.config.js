/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bgBase: 'var(--bg-base)',
        bgPanel: 'var(--bg-panel)',
        bgElevated: 'var(--bg-elevated)',
        bgHover: 'var(--bg-hover)',
        borderHairline: 'var(--border-subtle)',
        borderMedium: 'var(--border-medium)',
        textPrimary: 'var(--text-primary)',
        textSecondary: 'var(--text-secondary)',
        textMuted: 'var(--text-muted)',
        textDisabled: 'var(--text-disabled)',
        accent: 'var(--color-cyan)',
        accentHover: '#0284c7',
        up: 'var(--color-bull)',
        down: 'var(--color-bear)',
        warn: 'var(--color-gold)',
        gold: 'var(--color-gold)',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        none: '0px',
        sm: '4px',
        DEFAULT: '6px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
};
