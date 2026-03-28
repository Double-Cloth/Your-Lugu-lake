/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        lake: {
          25: "#f9fcff",
          50: "#eef9ff",
          100: "#d8f0ff",
          200: "#b3e1ff",
          300: "#7ec9ff",
          400: "#49b4ff",
          500: "#239cc9",
          600: "#1a7da3",
          700: "#176b89",
          800: "#0f3d4d",
          900: "#0a1f27",
        },
        wood: {
          50: "#fef9f3",
          100: "#f5e7d5",
          200: "#ebcfae",
          300: "#d3aa7a",
          400: "#bb8550",
          500: "#a26f3e",
          600: "#8b5a33",
          700: "#6d4526",
          800: "#4f321b",
          900: "#3a2413",
        },
        accent: {
          coral: "#ff6b6b",
          mint: "#26c485",
          amber: "#f59e0b",
        },
      },
      fontFamily: {
        sans: ["PingFang SC", "Noto Sans SC", "system-ui", "sans-serif"],
        serif: ["Georgia", "serif"],
      },
      fontSize: {
        xs: ["12px", "1.5"],
        sm: ["14px", "1.6"],
        base: ["16px", "1.6"],
        lg: ["18px", "1.7"],
        xl: ["20px", "1.7"],
        "2xl": ["24px", "1.8"],
        "3xl": ["28px", "1.8"],
      },
      borderRadius: {
        card: "20px",
        lg: "12px",
        md: "8px",
        sm: "4px",
      },
      spacing: {
        safe: "max(1rem, env(safe-area-inset-left))",
      },
      opacity: {
        8: "0.08",
        12: "0.12",
        15: "0.15",
        16: "0.16",
        45: "0.45",
        85: "0.85",
      },
      boxShadow: {
        card: "0 4px 12px rgba(23, 107, 137, 0.08)",
        "card-hover": "0 8px 24px rgba(23, 107, 137, 0.12)",
        smooth: "0 2px 8px rgba(35, 156, 201, 0.06)",
        "smooth-lg": "0 4px 16px rgba(35, 156, 201, 0.1)",
      },
      backdropBlur: {
        xs: "2px",
        sm: "4px",
        md: "6px",
        lg: "8px",
        xl: "12px",
      },
      animation: {
        "blob-drift": "blob-drift 6s ease-in-out infinite",
        "fade-in": "fade-in 0.3s ease-in-out",
        "slide-up": "slide-up 0.3s ease-out",
        "slide-down": "slide-down 0.3s ease-out",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },
      keyframes: {
        "blob-drift": {
          "0%": { transform: "translate3d(0, 0, 0) scale(1)" },
          "33%": { transform: "translate3d(22px, -18px, 0) scale(1.12)" },
          "66%": { transform: "translate3d(-26px, 20px, 0) scale(0.9)" },
          "100%": { transform: "translate3d(0, 0, 0) scale(1)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { transform: "translate(0, 10px)", opacity: "0" },
          "100%": { transform: "translate(0, 0)", opacity: "1" },
        },
        "slide-down": {
          "0%": { transform: "translate(0, -10px)", opacity: "0" },
          "100%": { transform: "translate(0, 0)", opacity: "1" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
    },
  },
  plugins: [],
};

