export type TestimonialType = {
	business: string;
	city: string;
	name: string;
	quote: string;
	role: string;
};

// TODO(real): add real quotes, with each customer's written permission to publish them.
// Invented quotes attributed to named people are misleading advertising, so this stays empty
// and the home page hides the testimonials section until it has entries.
export const testimonials: TestimonialType[] = [];
