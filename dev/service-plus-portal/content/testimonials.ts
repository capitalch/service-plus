export type TestimonialType = {
	business: string;
	city: string;
	name: string;
	/** Split into paragraphs so a long quote stays scannable on the card. */
	quote: string[];
	role: string;
	serviceCentre?: string;
};

// Customer quotes, published with their permission. The wording below has been edited for length
// and readability from what each customer originally said, so it reads as copy rather than as a
// transcript. Keep the sense of what was said, get sign-off from the person named before changing
// it again, and never add a quote nobody actually gave: a quote attributed to a named person is
// advertising, and making one up is misleading.
export const testimonials: TestimonialType[] = [
	{
		business: "Capital Electronics",
		city: "Kolkata",
		name: "Abhishek Mukherjee",
		quote: [
			"Running our Casio Authorized Service Center without Service+ is hard to imagine. It saves us a tremendous amount of time and keeps the service process organized.",
			"The WhatsApp integration has been a real boon — service receipts and delivery notifications are now paperless, and customers know the moment their device is ready for collection.",
			"The whole experience runs smoother, for our staff and for our customers.",
		],
		role: "Manager",
		serviceCentre: "Casio Authorized Service Center",
	},
	{
		business: "Nav Technology Pvt Ltd.",
		city: "Kolkata",
		name: "Sk Ali Imam",
		quote: [
			"In our Sony Authorized Service Center, Service+ has given us far better visibility into our spare-parts inventory and outstanding service jobs.",
			"We can see exactly where money is tied up, and follow up with customers who have not yet collected their devices — which recovers outstanding payments and keeps operations moving.",
			"It is intuitive enough that our staff started using it without extensive training or complicated instructions.",
		],
		role: "Manager",
		serviceCentre: "Sony Authorized Service Center",
	},
];
