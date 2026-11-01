import React, { createContext, useCallback, useContext, useState } from "react";

// ─────────────────────────────────────────────
// Color Palettes (Refined with Palette 1: Midnight Twilight & Amber Gold)
// ─────────────────────────────────────────────

export const DarkColors = {
  primary: {
    default: "#F4A62A", // Palette 1: Amber Gold
    light: "#F7BE6D",
    dark: "#D68612",
    soft: "#F0D9B5", // Palette 1: Champagne Cream
  },
  surface: {
    default: "#1A1A1F", // Palette 1: Deep Midnight
    light: "#2D2B55",   // Palette 1: Twilight Navy
    dark: "#111116",    // Deepest Midnight
    card: "#23223D",    // Rich Midnight Card
  },
  foreground: "#FFFFFF",
  mutedForeground: "#A8A6BC",
  subtleForeground: "#6F6D85",
  isDark: true,
} as const;

export const LightColors = {
  primary: {
    default: "#E76F51",
    light: "#F4A62A",
    dark: "#C55A3C",
    soft: "#F0D9B5",
  },
  surface: {
    default: "#F5F5F7",
    light: "#E8E8EC",
    dark: "#FFFFFF",
    card: "#FFFFFF",
  },
  foreground: "#0D0D0F",
  mutedForeground: "#5A5A60",
  subtleForeground: "#8A8A90",
  isDark: false,
} as const;

export type ColorPalette = {
  readonly primary: {
    readonly default: string;
    readonly light: string;
    readonly dark: string;
    readonly soft: string;
  };
  readonly surface: {
    readonly default: string;
    readonly light: string;
    readonly dark: string;
    readonly card: string;
  };
  readonly foreground: string;
  readonly mutedForeground: string;
  readonly subtleForeground: string;
  readonly isDark: boolean;
};

// ─────────────────────────────────────────────
// Theme Context
// ─────────────────────────────────────────────

type ThemeContextType = {
  colors: ColorPalette;
  isDark: boolean;
  toggleTheme: () => void;
};

export const ThemeContext = createContext<ThemeContextType>({
  colors: DarkColors,
  isDark: true,
  toggleTheme: () => {},
});

// ─────────────────────────────────────────────
// Theme Provider
// Using React.createElement instead of JSX so this .ts file
// doesn't cause a "Unexpected token" SyntaxError during EAS bundling.
// (JSX syntax is only valid in .tsx files)
// ─────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true); // default: dark mode

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => !prev);
  }, []);

  const colors = isDark ? DarkColors : LightColors;

  return React.createElement(
    ThemeContext.Provider,
    { value: { colors, isDark, toggleTheme } },
    children,
  );
}
