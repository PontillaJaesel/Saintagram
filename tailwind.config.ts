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
        canvas: "#F8F5EF",
        paper: "#FFFDF8",
        ink: "#27312E",
        muted: "#66736E",
        sage: {
          50: "#F1F5F2",
          100: "#E4ECE6",
          200: "#CBDACF",
          300: "#A5C0AC",
          400: "#7DA087",
          500: "#5E826A",
          600: "#496855",
          700: "#3D5547",
          800: "#34463C",
          900: "#2C3A33"
        },
        gold: {
          50: "#FFF9E9",
          100: "#FDF0C8",
          200: "#F9DF93",
          300: "#F3C75B",
          400: "#E9AA31",
          500: "#CC8520",
          600: "#A8611A",
          700: "#874718"
        },
        clay: {
          50: "#FCF3EE",
          100: "#F7E2D7",
          200: "#EFC5B2",
          500: "#B96D4E",
          600: "#995337"
        }
      },
      boxShadow: {
        soft: "0 18px 50px -28px rgba(42, 55, 48, .35)",
        lift: "0 18px 40px -18px rgba(64, 78, 70, .25)"
      },
      borderRadius: {
        "4xl": "2rem"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"]
      }
    }
  },
  plugins: []
};

export default config;
