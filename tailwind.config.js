/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        cairo: ["Cairo", "sans-serif"],
      },
      colors: {
        navy: {
          50:  "#f0f4ff",
          100: "#dce8ff",
          200: "#bbd1ff",
          500: "#3b6cb7",
          700: "#1a3a6e",
          800: "#122d58",
          900: "#0b1f3e",
        },
        brand: {
          50:  "#f6f8fb",
          100: "#edf1f7",
          600: "#1f3a5f",
          700: "#162c4a",
        },
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 23, 42, 0.08)",
        card: "0 1px 4px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)",
        "card-hover": "0 6px 20px rgba(15, 23, 42, 0.10), 0 2px 6px rgba(15, 23, 42, 0.06)",
      },
    },
  },
  plugins: [],
};
