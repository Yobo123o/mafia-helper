"use client";

import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "theme";

export function useThemePreference() {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(THEME_STORAGE_KEY) !== "light";
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem(THEME_STORAGE_KEY, "dark");
      return;
    }
    document.documentElement.classList.remove("dark");
    localStorage.setItem(THEME_STORAGE_KEY, "light");
  }, [darkMode]);

  return { darkMode, setDarkMode };
}
