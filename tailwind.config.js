/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: "#FF7A45",
          green: "#34C759",
          light: "#FF9F66",
        },
        ink: "#1F2937",
        muted: "#6B7280",
      },
      fontFamily: {
        sans: [
          "PingFang-SC",
          "Helvetica Neue",
          "Microsoft YaHei",
          "sans-serif",
        ],
      },
      boxShadow: {
        glass: "0 8px 32px rgba(255, 122, 69, 0.12)",
        card: "0 4px 20px rgba(31, 41, 55, 0.06)",
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, #FF7A45 0%, #FF9F66 50%, #34C759 100%)",
        "soft-bg": "linear-gradient(180deg, #FFF7F0 0%, #F2FBF4 100%)",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pop": {
          "0%": { transform: "scale(0.96)" },
          "60%": { transform: "scale(1.02)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.4s ease-out both",
        "pop": "pop 0.25s ease-out both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
