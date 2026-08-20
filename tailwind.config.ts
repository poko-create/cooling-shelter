import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        mist: "#f0f9ff",
        leaf: "#0d9488",
        water: "#06b6d4",
        warning: "#fbbf24",
        frost: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a"
        },
        aqua: {
          50: "#ecfeff",
          100: "#cffafe",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
          800: "#155e75",
          900: "#164e63"
        },
        glacial: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a"
        },
        ice: {
          50: "#f0faff",
          100: "#e0f2fe",
          200: "#b9e5fe",
          300: "#7cd4fd",
          400: "#36bffa",
          500: "#0ca5eb",
          600: "#0084c9",
          700: "#0169a3",
          800: "#065986",
          900: "#0b4a6f"
        }
      },
      boxShadow: {
        frost: "0 4px 30px rgba(6, 182, 212, 0.12)",
        "frost-lg": "0 8px 40px rgba(6, 182, 212, 0.18)",
        "frost-xl": "0 20px 60px rgba(6, 182, 212, 0.22)",
        glass: "0 8px 32px rgba(15, 23, 42, 0.08)",
        "glass-lg": "0 12px 48px rgba(15, 23, 42, 0.12)",
        "sheet": "0 -4px 40px rgba(6, 182, 212, 0.15), 0 -1px 12px rgba(15, 23, 42, 0.05)",
        "glow": "0 0 24px rgba(6, 182, 212, 0.25)",
        "glow-sm": "0 0 12px rgba(6, 182, 212, 0.2)",
        "inner-frost": "inset 0 1px 2px rgba(6, 182, 212, 0.08)"
      },
      backdropBlur: {
        xs: "2px",
        "2xl": "40px",
        "3xl": "64px"
      },
      borderRadius: {
        "4xl": "2rem"
      },
      animation: {
        "fade-in": "fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-up": "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-down": "slideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        "scale-in": "scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-soft": "pulseSoft 3s ease-in-out infinite",
        "shimmer": "shimmer 2.5s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite"
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        slideUp: {
          "0%": { transform: "translateY(16px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" }
        },
        slideDown: {
          "0%": { transform: "translateY(-8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" }
        },
        scaleIn: {
          "0%": { transform: "scale(0.96)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" }
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-4px)" }
        }
      }
    }
  },
  plugins: []
} satisfies Config;
