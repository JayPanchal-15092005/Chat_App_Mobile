import { ThemeContext } from "@/constants/Theme";
import { useContext } from "react";

/**
 * Returns the current theme colors, whether it's dark, and a toggleTheme function.
 * Must be used inside a <ThemeProvider>.
 */
export function useTheme() {
  return useContext(ThemeContext);
}
