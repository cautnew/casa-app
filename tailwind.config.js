/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./resources/js/**/*.{js,jsx}",
    "./resources/views/**/*.blade.php",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Sora", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
