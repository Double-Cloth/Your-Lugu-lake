/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        lake: {
          50: "#eef9ff",
          100: "#d8f0ff",
          500: "#239cc9",
          700: "#176b89",
        },
        wood: {
          100: "#f5e7d5",
          300: "#d3aa7a",
          500: "#a26f3e",
        },
      },
      borderRadius: {
        card: "20px",
      },
    },
  },
  plugins: [],
};
