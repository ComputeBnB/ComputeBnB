/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "app-bg": "#0a0a0b",
        "app-surface": "#111113",
        "app-surface-elevated": "#18181b",
        "app-border": "#27272a",
        "app-border-light": "#3f3f46",
        "app-text": "#fafafa",
        "app-text-secondary": "#a1a1aa",
        "app-text-tertiary": "#71717a",
        "app-accent": "#3b82f6",
        "app-accent-hover": "#2563eb",
        "app-success": "#10b981",
        "app-warning": "#f59e0b",
        "app-error": "#ef4444",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
        mono: ["SF Mono", "Monaco", "Consolas", "monospace"],
      },
      animation: {
        "slide-in": "slideIn 0.3s ease-out",
        "fade-in": "fadeIn 0.2s ease-out",
        "pulse-subtle": "pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        slideIn: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
