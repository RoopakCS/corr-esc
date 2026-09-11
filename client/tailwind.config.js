/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: {
          DEFAULT: "#0A0C10",
          surface: "#12151D",
          hover: "#181D28",
          card: "#131722",
          elevated: "#1E2433",
          border: "#252C3D",
          muted: "#161B26",
          subtle: "#2A3245",
        },
        status: {
          safe: {
            DEFAULT: "#10B981",
            bg: "rgba(16, 185, 129, 0.12)",
            border: "rgba(16, 185, 129, 0.3)",
          },
          warning: {
            DEFAULT: "#F59E0B",
            bg: "rgba(245, 158, 11, 0.12)",
            border: "rgba(245, 158, 11, 0.3)",
          },
          breached: {
            DEFAULT: "#EF4444",
            bg: "rgba(239, 68, 68, 0.12)",
            border: "rgba(239, 68, 68, 0.3)",
          },
          cobalt: {
            DEFAULT: "#3B82F6",
            bg: "rgba(59, 130, 246, 0.12)",
            border: "rgba(59, 130, 246, 0.3)",
          },
          violet: {
            DEFAULT: "#6366F1",
            bg: "rgba(99, 102, 241, 0.12)",
            border: "rgba(99, 102, 241, 0.3)",
          },
        },
      },
      fontFamily: {
        sans: [
          "Plus Jakarta Sans",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        glowSafe: "0 0 20px -3px rgba(16, 185, 129, 0.25)",
        glowWarning: "0 0 20px -3px rgba(245, 158, 11, 0.25)",
        glowBreached: "0 0 20px -3px rgba(239, 68, 68, 0.3)",
        glowViolet: "0 0 20px -3px rgba(99, 102, 241, 0.25)",
        surface: "0 4px 20px -2px rgba(0, 0, 0, 0.4)",
        elevated: "0 10px 30px -5px rgba(0, 0, 0, 0.6)",
      },
    },
  },
  plugins: [],
};
