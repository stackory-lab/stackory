import { errorResponse } from '@stackory/backend-utils';
import { error } from '@stackory/constants';
import type { ErrorHandler } from 'hono';

const { StandardError, errorCode } = error;

/**
 * 全局错误处理中间件
 * 捕获所有未处理的错误，返回统一的 IRequestResult 格式
 */
export const errorHandlerMiddleware: ErrorHandler = (error, c) => {
	console.error(error);
	const message = 'Internal Server Error';
	if (error instanceof StandardError) {
		return c.json(errorResponse(error.code, message), 200);
	}
	return c.json(errorResponse(errorCode.INTERNAL_SERVER_ERROR, message), 200);
};
