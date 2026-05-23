import type { IRequestResult } from './type';

/**
 * 成功响应包装函数
 */
export const successResponse = <T>(data: T): IRequestResult<T> => {
	return {
		code: 0,
		message: 'success',
		data,
	};
};

/**
 * 错误响应包装函数
 */
export const errorResponse = (
	override?: number | string,
	message?: string,
): IRequestResult<null> => {
	const defaultMessage = 'Some error';
	const defaultCode = 1;
	const code = typeof override === 'number' ? override : defaultCode;
	const resolvedMessage =
		typeof override === 'string' ? override : (message ?? defaultMessage);
	return {
		code,
		message: resolvedMessage,
		data: null,
	};
};
