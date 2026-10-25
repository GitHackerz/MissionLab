import type { Config } from "tailwindcss";

// Brand tokens from the MissionLab brand kit (sampled from the logo).
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        space: { DEFAULT: "#0e0b0c", 2: "#171213", 3: "#221a19", line: "#3a2a23" },
        cream: "#fdfaf5",
        dust: { DEFAULT: "#bcaca3", 2: "#8f817a" },
        flare: { DEFAULT: "#fe5319", hover: "#ff6a33", ink: "#1a0d08" },
        ember: "#f47a3a",
        rust: "#944127",
        status: {
          ok: "#3ddc97",
          warn: "#ffb020",
          degraded: "#ff8a3d",
          crit: "#ff4d6d",
          offline: "#8c817b",
          repair: "#38c6f4",
        },
        // Legacy palette used by the Phase 0 mission UI; kept until those screens are restyled.
        mars: {
          surface: "#1a0b08",
          dark: "#120705",
          panel: "#1e1311",
          border: "#3d1f19",
          dust: "#c86d51",
          rust: "#b94a28",
          sand: "#e28743",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Nunito", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "Segoe UI", "system-ui", "sans-serif"],
        data: ["var(--font-data)", "ui-monospace", "Consolas", "monospace"],
      },
      borderRadius: { sm: "6px", md: "10px", lg: "16px" },
      minHeight: { target: "44px" },
      keyframes: {
        bob: { "0%, 100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
      },
      animation: { bob: "bob 4.5s ease-in-out infinite" },
    },
  },
  plugins: [],
};
export default config;
