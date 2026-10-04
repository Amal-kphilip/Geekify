import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces (flat, no blur - cheap to paint)
        ink: "#0c0b11",
        surface: "#15141b",
        panel: "#15141b",
        elevated: "#1e1c25",
        chip: "#26242f",
        // Text
        muted: "#9b98aa",
        // Accents
        lime: "#c6e84a",
        brand: "#c6e84a", // legacy alias: existing classes (text-brand, fill-brand...) now render lime
        brand2: "#d4a2f6",
        lilac: "#d4a2f6",
        peach: "#f5b79a",
        sky: "#9fd8f2",
        rose: "#f2a6c8",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      keyframes: {
        pop: {
          "0%": { transform: "scale(0.7)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        sheet: {
          "0%": { transform: "translateY(24px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fade: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        pop: "pop 160ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
        sheet: "sheet 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
        fade: "fade 160ms ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
