import type { Config } from 'tailwindcss';

// ぐんぐん本体（src/theme）と揃えたブランドカラー
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#2C2A24',
        muted: '#7C776B',
        line: '#E7DFCD',
        cream: '#F7F1E0',
        card: '#FFFFFF',
        green: { DEFAULT: '#2E9E5B', deep: '#237A44', soft: '#E7F1DD' },
        mikan: { DEFAULT: '#EF8E2A', soft: '#FCEBCE' },
        water: '#22A6CC',
        danger: '#D5675C',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
