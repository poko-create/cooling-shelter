import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17211f",
        mist: "#f5f9f7",
        leaf: "#146b43",
        water: "#0ea5e9",
        warning: "#f4c430"
      }
    }
  },
  plugins: []
} satisfies Config;
