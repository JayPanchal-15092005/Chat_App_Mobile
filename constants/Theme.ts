import React, { createContext, useCallback, useContext, useState } from "react";

// ─────────────────────────────────────────────
// Color Palettes
// ─────────────────────────────────────────────

export const DarkColors = {
  primary: {
    default: "#F4A261",
    light: "#F4B183",
    dark: "#E76F51",
    soft: "#FFD7BA",
  },
  surface: {
    default: "#1A1A1D",
    light: "#2D2D30",
    dark: "#0D0D0F",
    card: "#242428",
  },
  foreground: "#FFFFFF",
  mutedForeground: "#A0A0A5",
  subtleForeground: "#6B6B70",
  isDark: true,
} as const;

export const LightColors = {
  primary: {
    default: "#E76F51",
    light: "#F4A261",
    dark: "#C55A3C",
    soft: "#FFD7BA",
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

export type ColorPalette = typeof DarkColors;

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
// ─────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true); // default: dark mode

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => !prev);
  }, []);

  const colors = isDark ? DarkColors : LightColors;

  return (
    <ThemeContext.Provider value={{ colors, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
