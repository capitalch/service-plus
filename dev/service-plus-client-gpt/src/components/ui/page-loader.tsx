import { motion } from "framer-motion";
import { Loader2Icon } from "lucide-react";

type PageLoaderPropsType = {
	message?: string;
};

export const PageLoader = ({ message }: PageLoaderPropsType) => (
	<div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-white/70 backdrop-blur-sm">
		<motion.div
			animate={{ rotate: 360 }}
			transition={{ duration: 0.8, ease: "linear", repeat: Infinity }}
		>
			<Loader2Icon className="h-8 w-8 text-emerald-600" />
		</motion.div>
		{message && (
			<p className="text-sm font-medium text-slate-500">{message}</p>
		)}
	</div>
);
