import { ArrowUpRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/content/site-config";
import { cn } from "@/lib/utils";

type LiveDemoButtonPropsType = {
	className?: string;
	/** Optional click hook, e.g. to close the mobile menu. */
	onClick?: () => void;
	/** nav: header, beside the size="sm" buttons; default: in-page; lg: hero and closing bands. */
	size?: "default" | "lg" | "nav";
};

// Same heights, radii and padding as the <Button> sizes it sits beside, so it never sticks out.
const BUTTON_SIZE: Record<NonNullable<LiveDemoButtonPropsType["size"]>, "default" | "lg" | "sm"> = {
	default: "default",
	lg: "lg",
	nav: "sm",
};

/** The one teal, animated call to action on the site: opens the app's read-only demo workshop
 *  (`<app>/demo`) in a new tab, signed in with no form. Use this everywhere the demo is offered
 *  so every entry point looks and behaves the same. */
export const LiveDemoButton = ({ className, onClick, size = "default" }: LiveDemoButtonPropsType) => {
	return (
		<a
			className={cn(
				buttonVariants({ size: BUTTON_SIZE[size], variant: null }),
				"bg-gradient-demo glow-demo group/demo sheen font-semibold text-white hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0",
				className,
			)}
			href={siteConfig.demoUrl}
			onClick={onClick}
			rel="noopener"
			target="_blank"
		>
			{/* A pulsing "live" dot: the demo is a running workshop, not a video. */}
			<span aria-hidden className="relative flex size-2">
				<span className="absolute inline-flex size-full animate-ping rounded-full bg-white/80 motion-reduce:animate-none" />
				<span className="relative inline-flex size-2 rounded-full bg-white" />
			</span>
			{size === "nav" ? "Live demo" : "Try the live demo"}
			{size === "lg" && (
				<span className="rounded-full bg-white/20 px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide uppercase">
					No sign-up
				</span>
			)}
			{/* Opens in a new tab. */}
			<ArrowUpRight
				aria-hidden
				className="opacity-80 transition-transform group-hover/demo:translate-x-0.5 group-hover/demo:-translate-y-0.5"
			/>
		</a>
	);
};
