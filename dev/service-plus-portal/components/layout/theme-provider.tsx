"use client";

import { createContext, useContext, useEffect, useState } from "react";

type ThemeType = "dark" | "light";

type ThemeContextValueType = {
	setTheme: (theme: ThemeType) => void;
	theme: ThemeType;
	toggleTheme: () => void;
};

// Same key as service-plus-web, so a visitor's choice carries between the two sites on one domain.
export const THEME_KEY = "sp-theme";

const ThemeContext = createContext<ThemeContextValueType | null>(null);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
	const [theme, setThemeState] = useState<ThemeType>("light");

	useEffect(() => {
		let stored: string | null = null;
		try {
			stored = window.localStorage.getItem(THEME_KEY);
		} catch {
			// localStorage unavailable — fall back to light.
		}
		const resolved: ThemeType = stored === "dark" ? "dark" : "light";
		// Syncing React state with the class the inline init script already applied before paint.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setThemeState(resolved);
		document.documentElement.classList.toggle("dark", resolved === "dark");
	}, []);

	function setTheme(next: ThemeType) {
		setThemeState(next);
		document.documentElement.classList.toggle("dark", next === "dark");
		try {
			window.localStorage.setItem(THEME_KEY, next);
		} catch {
			// localStorage unavailable — theme just won't persist.
		}
	}

	function toggleTheme() {
		setTheme(theme === "dark" ? "light" : "dark");
	}

	return <ThemeContext.Provider value={{ setTheme, theme, toggleTheme }}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValueType => {
	const context = useContext(ThemeContext);
	if (!context) throw new Error("useTheme must be used within a ThemeProvider");
	return context;
};
