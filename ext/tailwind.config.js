/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{html,js,ts,jsx,tsx,vue}",
    "./src/**/*.vue",
    "!./node_modules/**"
  ],
  theme: {
    extend: {
      colors: {
        'yellow': '#ffc82c',
      },
    },
  },
  plugins: [],
}
