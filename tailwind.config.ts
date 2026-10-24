import type { Config } from "tailwindcss";

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
    },
  },
  plugins: [],
};
export default config;
