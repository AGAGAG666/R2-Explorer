import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	cacheThumbnail,
	enqueueThumbnail,
	getCachedThumbnail,
	resetThumbnailState,
} from "components/files/thumbnailQueue";

describe("thumbnailQueue", () => {
	beforeEach(() => {
		resetThumbnailState();
	});

	it("runs thumbnail jobs one at a time in insertion order", async () => {
		let finishFirst: () => void;
		const calls: string[] = [];
		const first = enqueueThumbnail(
			() =>
				new Promise((resolve) => {
					calls.push("first-start");
					finishFirst = () => {
						calls.push("first-end");
						resolve("first");
					};
				}),
		);
		const secondTask = vi.fn(async () => {
			calls.push("second-start");
			return "second";
		});
		const second = enqueueThumbnail(secondTask);

		expect(calls).toEqual(["first-start"]);
		expect(secondTask).not.toHaveBeenCalled();

		finishFirst!();
		await expect(first.promise).resolves.toBe("first");
		await expect(second.promise).resolves.toBe("second");
		expect(calls).toEqual(["first-start", "first-end", "second-start"]);
	});

	it("skips a queued job after cancellation", async () => {
		let finishFirst: () => void;
		const first = enqueueThumbnail(
			() =>
				new Promise((resolve) => {
					finishFirst = () => resolve("first");
				}),
		);
		const secondTask = vi.fn(async () => "second");
		const second = enqueueThumbnail(secondTask);
		second.cancel();

		finishFirst!();
		await first.promise;
		await expect(second.promise).resolves.toBeNull();
		expect(secondTask).not.toHaveBeenCalled();
	});

	it("stores generated thumbnails by file fingerprint", async () => {
		const blob = new Blob(["thumbnail"]);
		await cacheThumbnail("bucket:key:etag", blob);

		await expect(getCachedThumbnail("bucket:key:etag")).resolves.toBe(blob);
		await expect(
			getCachedThumbnail("bucket:key:new-etag"),
		).resolves.toBeUndefined();
	});
});
