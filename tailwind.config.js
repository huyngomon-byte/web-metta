import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Legacy tokens (kept for admin panel compatibility)
        navy: { DEFAULT: '#002B5B', deep: '#001F3F', ink: '#061832' },
        metta: { orange: '#F15A24', cyan: '#00A6D6', gray: '#F5F7FA', text: '#4B5563' },
        // New design tokens
        'pure-white':   '#FFFFFF',
        'navy-deep':    '#002F5F',
        'cta-orange':   '#F05A1A',
        'accent-cyan':  '#00A6D6',
        'bg-canvas':    '#F5F9FC',
        'text-main':    '#1A2B3D',
        'on-surface':         '#171c1f',
        'on-surface-variant': '#43474f',
        'surface-variant':    '#dfe3e6',
        'surface-bright':     '#f6fafd',
        'outline-variant':    '#c3c6d0',
        'primary':            '#001a3a',
        'primary-container':  '#002f5f',
        'primary-fixed':      '#d5e3ff',
        'on-primary-fixed-variant': '#234778',
        'secondary-fixed':    '#ffdbcf',
        'on-secondary-fixed-variant': '#822800',
        'tertiary-fixed':     '#bfe9ff',
        'on-tertiary-fixed-variant':  '#004d65',
        'secondary-container': '#fe6425',
        'surface':            '#f6fafd',
        'surface-container':  '#eaeef1',
      },
      fontFamily: {
        // Legacy
        sans: ['"Be Vietnam Pro"', 'Inter', 'system-ui', 'sans-serif'],
        // New design tokens
        montserrat: ['Montserrat', 'sans-serif'],
        inter:      ['Inter', 'sans-serif'],
      },
      fontSize: {
        'headline-xl': ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '700' }],
        'headline-md': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'body-lg':     ['18px', { lineHeight: '28px', fontWeight: '400' }],
        'body-md':     ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'label-sm':    ['14px', { lineHeight: '20px', letterSpacing: '0.05em', fontWeight: '600' }],
      },
      spacing: {
        'section': '48px',
        'gutter':  '24px',
        'page':    '80px',
      },
      boxShadow: {
        soft: '0 24px 80px rgba(0, 31, 63, 0.12)',
        card: '0 16px 50px rgba(0, 43, 91, 0.10)',
      },
      backgroundImage: {
        triangles: "linear-gradient(135deg, rgba(0,166,214,.12) 0 1px, transparent 1px 28px), linear-gradient(45deg, rgba(241,90,36,.12) 0 1px, transparent 1px 32px)",
        'mpattern': "linear-gradient(45deg, transparent 48%, rgba(0,47,95,0.03) 50%, transparent 52%)",
      },
    },
  },
  plugins: [typography],
};
