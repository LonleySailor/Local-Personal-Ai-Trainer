"use client";

import { useTheme } from "next-themes";

function setThemeCookie(theme: "light" | "dark") {
  document.cookie = `theme=${theme};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
}

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => {
        const nextTheme = isDark ? "light" : "dark";
        setTheme(nextTheme);
        setThemeCookie(nextTheme);
      }}
      className="inline-flex items-center gap-2 rounded-full border border-zinc-950 bg-zinc-950 px-4 py-2 text-sm font-medium text-white shadow-sm backdrop-blur transition hover:bg-zinc-800 dark:border-zinc-200 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      aria-label="Toggle color theme"
      title="Toggle color theme"
    >
      <span
        className="h-2.5 w-2.5 rounded-full bg-current opacity-70"
        aria-hidden="true"
      />
      <span>{isDark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}