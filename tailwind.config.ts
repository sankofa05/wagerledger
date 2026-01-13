import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        surface2: "rgb(var(--surface2) / <alpha-value>)",
        gold: "rgb(var(--gold) / <alpha-value>)",
        ruby: "rgb(var(--ruby) / <alpha-value>)",
      },
      boxShadow: {
        soft: "0 18px 45px rgba(0,0,0,.35)",
        glow: "0 0 0 1px rgba(255,255,255,.06), 0 18px 50px rgba(0,0,0,.45)",
        gold: "0 0 0 1px rgba(212,175,55,.22), 0 18px 55px rgba(0,0,0,.45)",
      },
      borderRadius: {
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"],
        serif: ["ui-serif", "Georgia", "Times New Roman", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
