"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "medq-theme";

type ThemeMode = "light" | "dark";

function getStoredMode(): ThemeMode {
  if (typeof window === "undefined") return "dark";

  return window.localStorage.getItem(STORAGE_KEY) === "light"
    ? "light"
    : "dark";
}

function subscribeToThemeChanges(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("medq-theme-change", callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("medq-theme-change", callback);
  };
}

export default function ThemeModeToggle() {
  const mode = useSyncExternalStore(
    subscribeToThemeChanges,
    getStoredMode,
    () => "dark",
  );
  const isDark = mode === "dark";

  useEffect(() => {
    document.body.classList.toggle("medq-dark", isDark);
  }, [isDark]);

  const handleToggle = () => {
    const nextMode: ThemeMode = isDark ? "light" : "dark";

    window.localStorage.setItem(STORAGE_KEY, nextMode);
    window.dispatchEvent(new Event("medq-theme-change"));
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="no-print fixed bottom-5 right-5 z-[100] flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-xl transition hover:scale-105 hover:bg-slate-50 medq-theme-toggle"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="h-5 w-5" aria-hidden />
      ) : (
        <Moon className="h-5 w-5" aria-hidden />
      )}
    </button>
  );
}
