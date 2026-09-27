"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/layout/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const ThemeToggle = ({ className }: { className?: string }) => {
	const { theme, toggleTheme } = useTheme();
	const isDark = theme === "dark";
	const label = isDark ? "Light theme" : "Dark theme";

	return (
		<Button
			aria-label={label}
			className={cn("relative overflow-hidden", className)}
			onClick={toggleTheme}
			size="icon"
			title={label}
			type="button"
			variant="outline"
		>
			<Sun
				className={cn(
					"size-4 transition-all duration-300",
					isDark ? "-rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100",
				)}
			/>
			<Moon
				className={cn(
					"absolute size-4 transition-all duration-300",
					isDark ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-0 opacity-0",
				)}
			/>
		</Button>
	);
};
