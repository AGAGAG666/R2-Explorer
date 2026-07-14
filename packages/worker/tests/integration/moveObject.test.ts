import { createExecutionContext, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp, createTestRequest } from "./setup";

describe("Move object endpoint", () => {
	const bucketName = "MY_TEST_BUCKET_1";
	let bucket: R2Bucket;
	let app: ReturnType<typeof createTestApp>;

	beforeEach(async () => {
		app = createTestApp();
		bucket = env.MY_TEST_BUCKET_1;
		const listed = await bucket.list();
		if (listed.objects.length) {
			await bucket.delete(listed.objects.map((object) => object.key));
		}
	});

	it("keeps existing share URLs valid after renaming a file", async () => {
		await bucket.put("old-name.txt", "content");
		const createResponse = await app.fetch(
			createTestRequest(
				`/api/buckets/${bucketName}/${btoa("old-name.txt")}/share`,
				"POST",
				{},
			),
			env,
			createExecutionContext(),
		);
		const { shareId } = (await createResponse.json()) as { shareId: string };

		const moveResponse = await app.fetch(
			createTestRequest(`/api/buckets/${bucketName}/move`, "POST", {
				oldKey: btoa("old-name.txt"),
				newKey: btoa("new-name.txt"),
			}),
			env,
			createExecutionContext(),
		);

		expect(moveResponse.status).toBe(200);
		await moveResponse.text();
		expect(await bucket.get("old-name.txt")).toBeNull();
		expect(await (await bucket.get("new-name.txt"))?.text()).toBe("content");
		const metadata = await bucket.get(
			`.r2-explorer/sharable-links/${shareId}.json`,
		);
		expect(JSON.parse((await metadata?.text()) || "{}").key).toBe(
			"new-name.txt",
		);

		const shareResponse = await app.fetch(
			createTestRequest(`/share/${shareId}`),
			env,
			createExecutionContext(),
		);
		expect(shareResponse.status).toBe(200);
		expect(await shareResponse.text()).toBe("content");
	});

	it("does not overwrite an existing destination", async () => {
		await bucket.put("source.txt", "source");
		await bucket.put("destination.txt", "destination");

		const response = await app.fetch(
			createTestRequest(`/api/buckets/${bucketName}/move`, "POST", {
				oldKey: btoa("source.txt"),
				newKey: btoa("destination.txt"),
			}),
			env,
			createExecutionContext(),
		);

		expect(response.status).toBe(409);
		await response.text();
		expect(await (await bucket.get("source.txt"))?.text()).toBe("source");
		expect(await (await bucket.get("destination.txt"))?.text()).toBe(
			"destination",
		);
	});
});
