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
        // Incident operational lifecycle phase (CONTEXT.md)
        lifecycle: {
          new: {
            DEFAULT: "#38BDF8", // sky-400
            bg: "rgba(56, 189, 248, 0.12)",
            border: "rgba(56, 189, 248, 0.3)",
          },
          assigned: {
            DEFAULT: "#FBBF24", // amber-400
            bg: "rgba(251, 191, 36, 0.12)",
            border: "rgba(251, 191, 36, 0.3)",
          },
          inProgress: {
            DEFAULT: "#60A5FA", // blue-400
            bg: "rgba(96, 165, 250, 0.12)",
            border: "rgba(96, 165, 250, 0.3)",
          },
          resolved: {
            DEFAULT: "#34D399", // emerald-400
            bg: "rgba(52, 211, 153, 0.12)",
            border: "rgba(52, 211, 153, 0.3)",
          },
          closed: {
            DEFAULT: "#94A3B8", // slate-400
            bg: "rgba(148, 163, 184, 0.12)",
            border: "rgba(148, 163, 184, 0.3)",
          },
        },
        // SLA Urgency & Contraction Metrics
        slaUrgency: {
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
          corroboration: {
            DEFAULT: "#818CF8",
            bg: "rgba(129, 140, 248, 0.12)",
            border: "rgba(129, 140, 248, 0.3)",
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
      letterSpacing: {
        tighter: "-0.04em",
        tight: "-0.02em",
      },
      maxWidth: {
        prose: "65ch",
      },
      transitionDuration: {
        tactile: "200ms",
        smooth: "300ms",
      },
    },
  },
  plugins: [],
};
