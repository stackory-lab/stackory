import {
	createServiceCaller,
	type IServiceTransport,
} from '@stackory/backend-platform';
import {
	createHmacSigningInterceptor,
	errorResponse,
	successResponse,
} from '@stackory/backend-utils';
import { describe, expect, it, vi } from 'vitest';
import {
	createInternalRpcClient,
	InternalRpcError,
	type IUnwrapHonoRpcClient,
} from '../src';

interface ITestRpcClient {
	api: {
		agent: {
			create: {
				$post: (input: {
					json: {
						adapter: string;
						name: string;
					};
				}) => Promise<{
					json(): Promise<{
						code: number;
						message: string;
						data: {
							agentId: string;
							name: string;
						};
					}>;
				}>;
			};
		};
	};
}

describe('createInternalRpcClient', () => {
	it('uses service caller fetch, merges headers, and parses json', async () => {
		const transport: IServiceTransport = {
			fetch: vi.fn(async () => {
				return new Response(
					JSON.stringify(
						successResponse({
							agentId: 'agent-1',
							name: 'Coder',
						}),
					),
					{
						headers: {
							'Content-Type': 'application/json',
						},
						status: 201,
					},
				);
			}),
		};
		const serviceCaller = createServiceCaller(transport, [
			createHmacSigningInterceptor(async () => 'test-secret'),
		]);
		const client = createInternalRpcClient<ITestRpcClient>({
			baseUrl: 'https://platform.internal',
			getHeaders: () => ({
				'X-User-Id': 'user-1',
			}),
			serviceCaller,
			serviceName: 'PLATFORM_WORKER',
		});

		const result = await client.api.agent.create.$post({
			json: {
				name: 'Coder',
				adapter: 'openai',
			},
		});

		expect(result).toEqual(
			successResponse({
				agentId: 'agent-1',
				name: 'Coder',
			}),
		);

		expect(transport.fetch).toHaveBeenCalledOnce();
		const [serviceName, request] = vi.mocked(transport.fetch).mock.calls[0];
		expect(serviceName).toBe('PLATFORM_WORKER');
		expect(request.url).toBe('https://platform.internal/api/agent/create');
		expect(request.headers.get('X-User-Id')).toBe('user-1');
		expect(request.headers.get('X-Internal-Signature')).toBeTruthy();
		expect(request.headers.get('X-Internal-Timestamp')).toBeTruthy();
	});

	it('throws parsed backend payload on non-ok responses', async () => {
		const transport: IServiceTransport = {
			fetch: vi.fn(async () => {
				return new Response(JSON.stringify(errorResponse('AGENT_NOT_FOUND')), {
					headers: {
						'Content-Type': 'application/json',
					},
					status: 404,
				});
			}),
		};
		const serviceCaller = createServiceCaller(transport);
		const client: IUnwrapHonoRpcClient<ITestRpcClient> =
			createInternalRpcClient<ITestRpcClient>({
				baseUrl: 'https://platform.internal',
				serviceCaller,
				serviceName: 'PLATFORM_WORKER',
			});

		await expect(
			client.api.agent.create.$post({
				json: {
					name: 'missing',
					adapter: 'openai',
				},
			}),
		).rejects.toEqual(
			expect.objectContaining<Partial<InternalRpcError>>({
				status: 404,
				data: errorResponse('AGENT_NOT_FOUND'),
			}),
		);
	});
});
