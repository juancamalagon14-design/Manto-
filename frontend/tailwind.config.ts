import type { Config } from 'tailwindcss';

/**
 * Sistema visual de Manto.
 *
 * Paleta oficial (cuatro colores, nada más):
 *   Ground  #EDEFF2   fondo de la aplicación — gris frío con sesgo navy
 *   Ink     #0A1C34   tipografía principal
 *   Accent  #CF5224   CTAs y una palabra del titular. En ningún otro lugar.
 *   Línea   #DCE1E7   bordes, divisores, campos vacíos
 *
 * Tipografía: Poppins en toda la interfaz.
 *   Títulos 700 (máx. 3.1rem) · Subtítulos 600 · Cuerpo 400 · Etiquetas 500 · CTAs 600
 *
 * Los nombres de token se mantienen estables (navy-900, orange-cta, canvas…) para que
 * los componentes existentes sigan funcionando; lo que cambia son los valores.
 */
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: '#EDEFF2', // Ground oficial
          pure: '#FFFFFF',
          soft: '#F4F5F7',
          subtle: '#E4E8EE',
        },
        navy: {
          DEFAULT: '#0A1C34', // Ink oficial
          950: '#060F1E',
          900: '#0A1C34', // tipografía principal
          800: '#12283E',
          700: '#1E3853',
          600: '#33506E',
          500: '#4A5A6F', // texto secundario
          400: '#77889E',
          300: '#A6B4C4',
          200: '#CBD4DE',
          100: '#E4E8EE',
          50: '#F2F4F7',
        },
        orange: {
          brand: '#CF5224', // Accent oficial
          cta: '#CF5224', // CTA primario
          hover: '#B83E1A', // CTA hover (~20% más oscuro)
          subtle: '#FDF0EA',
          border: '#F3C9B6',
        },
        line: {
          DEFAULT: '#DCE1E7', // divisores y campos vacíos
          soft: '#E7EBF0',
        },
        // Escala neutra alineada al sesgo navy del ground.
        // slate-500 y slate-600 aterrizan en el texto secundario oficial (#4A5A6F).
        slate: {
          50: '#F6F7F9',
          100: '#EDEFF2',
          200: '#DCE1E7',
          300: '#C3CBD6',
          400: '#8E9BAC',
          500: '#4A5A6F',
          600: '#4A5A6F',
          700: '#33506E',
          800: '#1E3853',
          900: '#0A1C34',
        },
      },
      fontFamily: {
        sans: ['var(--font-poppins)', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Techo de titular fijado por la guía de marca: 3.1rem.
        display: ['3.1rem', { lineHeight: '1.08', letterSpacing: '-0.03em', fontWeight: '700' }],
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(10,28,52,0.05), 0 1px 2px rgba(10,28,52,0.03)',
        'card-hover':
          '0 10px 25px -5px rgba(10, 28, 52, 0.08), 0 8px 10px -6px rgba(10, 28, 52, 0.04)',
        cta: '0 4px 14px 0 rgba(207, 82, 36, 0.30)',
        'cta-hover': '0 6px 20px rgba(207, 82, 36, 0.40)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-subtle': 'pulseSubtle 2.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.88', transform: 'scale(1.02)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
