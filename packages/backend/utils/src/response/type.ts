export interface IRequestResult<T> {
	code: number; // 错误码，0始终代表无错误
	message: string; // 错误信息，当错误码为0时，该字段必须为"success"
	data: T; // 实际的响应体内容
}
