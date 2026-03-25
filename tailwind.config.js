/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.{html,js}"],
  theme: {
    extend: {},
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        light: {
          primary: "#0ea5e9",
          secondary: "#6366f1",
          accent: "#e879f9",
          neutral: "#2b3440",
          "base-100": "#ffffff",
          "base-200": "#f8f9fb",
          "base-300": "#f0f1f3",
          info: "#3abff8",
          success: "#22c55e",
          warning: "#f59e0b",
          error: "#ef4444",
        },
      },
      {
        dark: {
          primary: "#22d3ee",
          secondary: "#818cf8",
          accent: "#f472b6",
          neutral: "#191d24",
          "base-100": "#1d232a",
          "base-200": "#191d24",
          "base-300": "#15191e",
          info: "#3abff8",
          success: "#36d399",
          warning: "#fbbd23",
          error: "#f87272",
        },
      },
    ],
  },
};
