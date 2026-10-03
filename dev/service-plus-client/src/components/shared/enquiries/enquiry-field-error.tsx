/** A field's validation message under its control (red is for errors only). */
export const EnquiryFieldError = ({ message }: { message?: string }) =>
	message ? <p className="text-xs text-red-500">{message}</p> : null;
