export class StandardError extends Error {
	public code: number;
	public data?: unknown;

	constructor(params: {
		code: number;
		message: string;
		data?: unknown;
	}) {
		const { code, message, data } = params;
		super(message);
		this.code = code;
		this.data = data;
	}
}
