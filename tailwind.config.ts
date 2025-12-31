import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 12px 40px rgba(0,0,0,.15)",
      }
    },
  },
  plugins: [],
} satisfies Config;
