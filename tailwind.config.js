/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.html", "./public/js/**/*.js"],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"IBM Plex Mono"', "monospace"],
      },
      colors: {
        bg: {
          DEFAULT: "#0c0b09",
          2: "#111009",
          3: "#161410",
        },
        surface: "#1a1814",
        border: {
          DEFAULT: "#1e1c16",
          2: "#2a2820",
        },
        accent: {
          DEFAULT: "#d4a843",
          dim: "rgba(212,168,67,0.12)",
          glow: "rgba(212,168,67,0.25)",
        },
        green: {
          DEFAULT: "#4a9e6a",
          dim: "rgba(74,158,106,0.12)",
        },
        red: {
          DEFAULT: "#c0483a",
          dim: "rgba(192,72,58,0.1)",
        },
        blue: {
          DEFAULT: "#4a7ec0",
          dim: "rgba(74,126,192,0.12)",
        },
        ink: {
          DEFAULT: "#d4cfc4",
          2: "#7a7668",
          3: "#524f45",
        },
      },
      animation: {
        blink: "blink 1.1s step-end infinite",
        pulse2: "pulse2 1.4s ease-in-out infinite",
      },
      keyframes: {
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        pulse2: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.2" },
        },
      },
    },
  },
  plugins: [],
};
