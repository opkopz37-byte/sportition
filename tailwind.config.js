/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    // TIER_COLORS 등 lib 안의 동적 className 도 JIT 가 인식하도록 포함
    './lib/**/*.{js,ts}',
  ],
  // 배포 환경 JIT 가 동적 문자열을 못 찾는 케이스 대비 — 티어/테마/존 컬러 안전망
  safelist: [
    // tier text colors
    'text-amber-600', 'text-slate-300', 'text-yellow-400', 'text-teal-300',
    'text-sky-200', 'text-purple-300', 'text-fuchsia-300', 'text-amber-200',
    // tier border colors
    'border-amber-700/50', 'border-slate-300/40', 'border-yellow-400/60',
    'border-teal-400/55', 'border-sky-300/60', 'border-purple-500/60',
    'border-fuchsia-400/60', 'border-amber-300/70',
    // tier bg gradient stops (with alpha)
    {
      pattern: /(from|via|to)-(amber|orange|slate|yellow|teal|cyan|sky|purple|violet|fuchsia|pink|rose|red|blue|emerald|green)-(200|300|400|500|600|700|800|900)\/(10|15|20|25|30|35|40|55|60|70)/,
    },
    // tier bar gradient stops (no alpha)
    {
      pattern: /(from|via|to)-(amber|orange|slate|yellow|teal|cyan|sky|purple|violet|fuchsia|pink|rose|red|blue|emerald|green)-(200|300|400|500|600|700|800)/,
    },
    // glow class
    'tier-challenger-glow',
  ],
  theme: {
    extend: {
      screens: {
        'xs': '375px',  // iPhone SE
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in': 'fade-in 0.3s ease-out forwards',
        'pulse-slow': 'pulse-slow 4s ease-in-out infinite',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '0.5' },
        },
      },
      fontSize: {
        'xxs': '0.625rem',  // 10px for very small screens
      },
    },
  },
  plugins: [],
}
