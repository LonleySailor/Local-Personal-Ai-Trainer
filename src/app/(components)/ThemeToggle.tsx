"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : false;

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex items-center gap-2 rounded-full border border-zinc-950 bg-zinc-950 px-4 py-2 text-sm font-medium text-white shadow-sm backdrop-blur transition hover:bg-zinc-800 dark:border-zinc-200 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      aria-label="Toggle color theme"
      title="Toggle color theme"
    >
      <span
        className="h-2.5 w-2.5 rounded-full bg-current opacity-70"
        aria-hidden="true"
      />
      <span>{mounted ? (isDark ? "Light mode" : "Dark mode") : "Theme"}</span>
    </button>
  );
}