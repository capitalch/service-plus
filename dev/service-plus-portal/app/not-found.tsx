import Link from "next/link";

import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";

const NotFound = () => {
	return (
		<section className="mx-auto flex w-full max-w-xl flex-col items-center px-page py-24 text-center">
			<p className="text-gradient-brand text-7xl font-extrabold">404</p>
			<h1 className="mt-4 text-2xl font-bold">{MESSAGES.notFoundTitle}</h1>
			<p className="mt-2 text-muted-foreground">{MESSAGES.notFoundBody}</p>
			<Button asChild className="mt-8">
				<Link href="/">Back to home</Link>
			</Button>
		</section>
	);
};

export default NotFound;
