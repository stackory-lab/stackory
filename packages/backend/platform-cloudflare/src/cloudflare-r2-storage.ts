import type {
	IObjectStorage,
	IStorageListResult,
	IStorageObject,
	IStorageObjectMetadata,
} from '@stackory/backend-platform';

export class CloudflareR2Storage implements IObjectStorage {
	constructor(private bucket: R2Bucket) {}

	put = async (
		key: string,
		body: ReadableStream | ArrayBuffer | string,
		options?: {
			contentType?: string;
			customMetadata?: Record<string, string>;
		},
	) => {
		await this.bucket.put(key, body, {
			httpMetadata: options?.contentType
				? { contentType: options.contentType }
				: undefined,
			customMetadata: options?.customMetadata,
		});
	};

	get = async (key: string): Promise<IStorageObject | null> => {
		const object = await this.bucket.get(key);
		if (!object) {
			return null;
		}
		return {
			body: object.body,
			size: object.size,
			httpEtag: object.httpEtag,
			contentType: object.httpMetadata?.contentType,
			customMetadata: object.customMetadata,
			writeHttpMetadata: (headers: Headers) => {
				object.writeHttpMetadata(headers);
			},
		};
	};

	delete = async (key: string) => {
		await this.bucket.delete(key);
	};

	deleteMany = async (keys: string[]) => {
		await this.bucket.delete(keys);
	};

	list = async (options?: {
		prefix?: string;
		limit?: number;
		cursor?: string;
	}): Promise<IStorageListResult> => {
		const result = await this.bucket.list(options);
		return {
			objects: result.objects.map((obj) => ({
				key: obj.key,
				size: obj.size,
				httpEtag: obj.httpEtag,
				contentType: obj.httpMetadata?.contentType,
				customMetadata: obj.customMetadata,
				uploaded: obj.uploaded,
			})),
			truncated: result.truncated,
			cursor: result.truncated ? result.cursor : undefined,
		};
	};

	head = async (key: string): Promise<IStorageObjectMetadata | null> => {
		const object = await this.bucket.head(key);
		if (!object) {
			return null;
		}
		return {
			key: object.key,
			size: object.size,
			httpEtag: object.httpEtag,
			contentType: object.httpMetadata?.contentType,
			customMetadata: object.customMetadata,
			uploaded: object.uploaded,
		};
	};
}
