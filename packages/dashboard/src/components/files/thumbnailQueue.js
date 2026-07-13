const queue = [];
const cache = new Map();
let running = false;
const CACHE_NAME = "r2-explorer-thumbnails-v1";

function cacheRequest(key) {
	return new Request(
		`${window.location.origin}/__thumbnail_cache__/${encodeURIComponent(key)}`,
	);
}

async function drainQueue() {
	if (running) return;
	running = true;

	while (queue.length > 0) {
		const job = queue.shift();
		if (job.cancelled) {
			job.resolve(null);
			continue;
		}

		try {
			job.resolve(await job.task());
		} catch (error) {
			job.reject(error);
		}
	}

	running = false;
}

export function enqueueThumbnail(task) {
	const job = { task, cancelled: false };
	const promise = new Promise((resolve, reject) => {
		job.resolve = resolve;
		job.reject = reject;
	});

	queue.push(job);
	drainQueue();

	return {
		promise,
		cancel: () => {
			job.cancelled = true;
		},
	};
}

export async function getCachedThumbnail(key) {
	if (cache.has(key)) return cache.get(key);
	if (typeof caches === "undefined") return undefined;

	const response = await (await caches.open(CACHE_NAME)).match(cacheRequest(key));
	if (!response) return undefined;

	const blob = await response.blob();
	cache.set(key, blob);
	return blob;
}

export async function cacheThumbnail(key, blob) {
	cache.set(key, blob);
	if (typeof caches !== "undefined") {
		await (await caches.open(CACHE_NAME)).put(
			cacheRequest(key),
			new Response(blob),
		);
	}
}

export function resetThumbnailState() {
	queue.length = 0;
	cache.clear();
	running = false;
}
