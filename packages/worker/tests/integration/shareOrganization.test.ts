import { createExecutionContext, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp, createTestRequest } from "./setup";

describe("Share organization endpoints", () => {
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

	it("returns an empty organization by default", async () => {
		const response = await app.fetch(
			createTestRequest(`/api/buckets/${bucketName}/share-organization`),
			env,
			createExecutionContext(),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			version: 1,
			folders: [],
			assignments: {},
		});
	});

	it("stores nested folders and share assignments separately", async () => {
		const organization = {
			version: 1,
			folders: [
				{ id: "clients", name: "客户", parentId: null },
				{ id: "project", name: "项目甲", parentId: "clients" },
			],
			assignments: { share123: "project" },
		};
		const putResponse = await app.fetch(
			createTestRequest(
				`/api/buckets/${bucketName}/share-organization`,
				"PUT",
				organization,
			),
			env,
			createExecutionContext(),
		);

		expect(putResponse.status).toBe(200);
		const stored = await bucket.get(".r2-explorer/share-management.json");
		expect(JSON.parse((await stored?.text()) || "{}")).toEqual(organization);
	});

	it("rejects folder cycles", async () => {
		const response = await app.fetch(
			createTestRequest(
				`/api/buckets/${bucketName}/share-organization`,
				"PUT",
				{
					version: 1,
					folders: [
						{ id: "a", name: "A", parentId: "b" },
						{ id: "b", name: "B", parentId: "a" },
					],
					assignments: {},
				},
			),
			env,
			createExecutionContext(),
		);

		expect(response.status).toBe(400);
	});

	it("is blocked by readonly mode on update", async () => {
		app = createTestApp({ readonly: true });
		const response = await app.fetch(
			createTestRequest(
				`/api/buckets/${bucketName}/share-organization`,
				"PUT",
				{ version: 1, folders: [], assignments: {} },
			),
			env,
			createExecutionContext(),
		);

		expect(response.status).toBe(401);
	});

	it("removes an assignment when its share is revoked", async () => {
		await bucket.put("test.txt", "test");
		const createResponse = await app.fetch(
			createTestRequest(
				`/api/buckets/${bucketName}/${btoa("test.txt")}/share`,
				"POST",
				{},
			),
			env,
			createExecutionContext(),
		);
		const { shareId } = (await createResponse.json()) as { shareId: string };
		await bucket.put(
			".r2-explorer/share-management.json",
			JSON.stringify({
				version: 1,
				folders: [{ id: "folder", name: "Folder", parentId: null }],
				assignments: { [shareId]: "folder" },
			}),
		);

		const response = await app.fetch(
			createTestRequest(
				`/api/buckets/${bucketName}/share/${shareId}`,
				"DELETE",
			),
			env,
			createExecutionContext(),
		);

		expect(response.status).toBe(200);
		const stored = await bucket.get(".r2-explorer/share-management.json");
		expect(JSON.parse((await stored?.text()) || "{}").assignments).toEqual({});
	});
});
