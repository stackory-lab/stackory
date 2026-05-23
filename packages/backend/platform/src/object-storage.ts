export interface IStorageObjectMetadata {
	key: string;
	size: number;
	httpEtag?: string;
	contentType?: string;
	customMetadata?: Record<string, string>;
	uploaded?: Date;
}

export interface IStorageObject {
	body: ReadableStream;
	size: number;
	httpEtag?: string;
	contentType?: string;
	customMetadata?: Record<string, string>;
	writeHttpMetadata(headers: Headers): void;
}

export interface IStorageListResult {
	objects: IStorageObjectMetadata[];
	truncated: boolean;
	cursor?: string;
}

export interface IObjectStorage {
	put(
		key: string,
		body: ReadableStream | ArrayBuffer | string,
		options?: {
			contentType?: string;
			customMetadata?: Record<string, string>;
		},
	): Promise<void>;

	get(key: string): Promise<IStorageObject | null>;

	delete(key: string): Promise<void>;

	deleteMany(keys: string[]): Promise<void>;

	list(options?: {
		prefix?: string;
		limit?: number;
		cursor?: string;
	}): Promise<IStorageListResult>;

	head(key: string): Promise<IStorageObjectMetadata | null>;
}
