import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0c0c0e", // Deep charcoal/near-black
        foreground: "#f5f5f5",
        charcoal: {
          900: "#08080a",
          800: "#0c0c0e",
          700: "#131316",
          600: "#1a1a1e",
          500: "#222227",
        },
        gold: {
          500: "#C9A227", // Primary accent
          400: "#d9b641",
          600: "#a6831d",
        }
      },
      fontFamily: {
        serif: ["var(--font-fraunces)", "serif"],
        mono: ["var(--font-mono)", "monospace"],
        sans: ["var(--font-inter)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
