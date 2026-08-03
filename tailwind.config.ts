import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        paper: "rgb(var(--paper) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        sage: {
          50: "rgb(var(--sage-50) / <alpha-value>)",
          100: "rgb(var(--sage-100) / <alpha-value>)",
          200: "rgb(var(--sage-200) / <alpha-value>)",
          300: "rgb(var(--sage-300) / <alpha-value>)",
          400: "rgb(var(--sage-400) / <alpha-value>)",
          500: "rgb(var(--sage-500) / <alpha-value>)",
          600: "rgb(var(--sage-600) / <alpha-value>)",
          700: "rgb(var(--sage-700) / <alpha-value>)",
          800: "rgb(var(--sage-800) / <alpha-value>)",
          900: "rgb(var(--sage-900) / <alpha-value>)"
        },
        gold: {
          50: "rgb(var(--gold-50) / <alpha-value>)",
          100: "rgb(var(--gold-100) / <alpha-value>)",
          200: "rgb(var(--gold-200) / <alpha-value>)",
          300: "rgb(var(--gold-300) / <alpha-value>)",
          400: "rgb(var(--gold-400) / <alpha-value>)",
          500: "rgb(var(--gold-500) / <alpha-value>)",
          600: "rgb(var(--gold-600) / <alpha-value>)",
          700: "rgb(var(--gold-700) / <alpha-value>)"
        },
        clay: {
          50: "rgb(var(--clay-50) / <alpha-value>)",
          100: "rgb(var(--clay-100) / <alpha-value>)",
          200: "rgb(var(--clay-200) / <alpha-value>)",
          500: "rgb(var(--clay-500) / <alpha-value>)",
          600: "rgb(var(--clay-600) / <alpha-value>)"
        },
        success: {
          50: "rgb(var(--success-50) / <alpha-value>)",
          100: "rgb(var(--success-100) / <alpha-value>)",
          400: "rgb(var(--success-400) / <alpha-value>)",
          500: "rgb(var(--success-500) / <alpha-value>)",
          600: "rgb(var(--success-600) / <alpha-value>)",
          700: "rgb(var(--success-700) / <alpha-value>)"
        }
      },
      boxShadow: {
        soft: "0 1px 2px rgba(26, 20, 30, .05), 0 12px 32px rgba(26, 20, 30, .06)",
        lift: "0 18px 50px rgba(26, 20, 30, .12)"
      },
      borderRadius: {
        "4xl": "2rem"
      },
      fontFamily: {
        sans: ["Montserrat", "Arial", "sans-serif"],
        serif: ["Montserrat", "Arial", "sans-serif"],
        secondary: ["Roboto", "Arial", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
