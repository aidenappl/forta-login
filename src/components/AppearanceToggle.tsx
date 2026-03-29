"use client";

import { useAppearance, Appearance } from "@/context/AppearanceContext";

const CYCLE: Appearance[] = ["system", "light", "dark"];

const LABELS: Record<Appearance, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

const ICON: Record<Appearance, React.ReactNode> = {
  light: <SunIcon />,
  dark: <MoonIcon />,
  system: <SystemIcon />,
};

export function AppearanceToggle() {
  const { appearance, setAppearance } = useAppearance();

  const handleClick = () => {
    const idx = CYCLE.indexOf(appearance);
    setAppearance(CYCLE[(idx + 1) % CYCLE.length]);
  };

  return (
    <button
      onClick={handleClick}
      title={`Appearance: ${LABELS[appearance]} — click to cycle`}
      className="fixed bottom-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 hover:text-gray-800 dark:hover:text-neutral-100 shadow-sm hover:shadow transition-all"
    >
      {ICON[appearance]}
    </button>
  );
}
