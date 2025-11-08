import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Custom colors for department headers based on the image
        "department-sales-red": "#E74C3C",
        "department-logistics-blue": "#3498DB",
        "department-accounting-purple": "#9B59B6",
        "department-treasury-green": "#27AE60",
        "department-it-teal": "#1ABC9C",
        "department-fleet-gray": "#7F8C8D",
        "department-creatives-orange": "#F39C12",
        "department-finance-green": "#2ECC71",
        "department-media-lightblue": "#5DADE2",
        "department-businessdev-darkpurple": "#8E44AD",
        "department-legal-darkred": "#C0392B",
        "department-corporate-lightblue": "#5DADE2", // Same as media
        "department-hr-pink": "#E91E63",
        "department-specialteam-lightpurple": "#AF7AC5",
        "department-marketing-red": "#E74C3C", // Same as sales
        "department-add-darkgray": "#2C3E50",
        // New custom colors for card content backgrounds based on the image
        "card-content-sales": "#FCE4EC", // Light pink
        "card-content-logistics": "#E3F2FD", // Light blue
        "card-content-accounting": "#EDE7F6", // Light lavender
        "card-content-treasury": "#E8F5E9", // Light green
        "card-content-it": "#E0F2F1", // Light teal
        "card-content-fleet": "#F5F5F5", // Light gray
        "card-content-creatives": "#FFF3E0", // Light orange
        "card-content-finance": "#E8F5E9", // Light green (similar to treasury)
        "card-content-media": "#E0F7FA", // Light cyan/aqua
        "card-content-businessdev": "#F3E5F5", // Light blue/purple
        "card-content-legal": "#FFEBEE", // Light red/pink
        "card-content-corporate": "#E3F2FD", // Light blue (same as logistics)
        "card-content-hr": "#FCE4EC", // Light pink (similar to sales)
        "card-content-specialteam": "#EDE7F6", // Light purple (similar to accounting)
        "card-content-marketing": "#FFEBEE", // Light red/pink (similar to legal)
        "card-content-add": "#EEEEEE", // Light gray
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
