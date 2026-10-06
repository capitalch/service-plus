/** Generated Date columns as they arrive over genericQuery: ISO strings. */
export type IsoDatesType<T> = {
	[K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K];
};
