export const gzipText = async (text: string) => {
	const source = new Response(text).body;
	if (!source) {
		throw new Error('[gzip] Response.body unavailable');
	}
	const compressed = source.pipeThrough(new CompressionStream('gzip'));
	return new Uint8Array(await new Response(compressed).arrayBuffer());
};

export const gunzipText = async (buffer: ArrayBuffer) => {
	const source = new Response(buffer).body;
	if (!source) {
		throw new Error('[gunzip] Response.body unavailable');
	}
	const decompressed = source.pipeThrough(new DecompressionStream('gzip'));
	return await new Response(decompressed).text();
};

export default {
	gzipText,
	gunzipText,
};
