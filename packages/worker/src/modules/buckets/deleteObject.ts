import { OpenAPIRoute } from "chanfana";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { AppContext, ShareMetadata, ShareOrganization } from "../../types";

const SHARE_PREFIX = ".r2-explorer/sharable-links/";
const ORGANIZATION_KEY = ".r2-explorer/share-management.json";

async function revokeObjectShares(bucket: R2Bucket, objectKey: string) {
	const shareKeys: string[] = [];
	const shareIds: string[] = [];
	let cursor: string | undefined;

	do {
		const listed = await bucket.list({ prefix: SHARE_PREFIX, cursor });
		for (const item of listed.objects) {
			const object = await bucket.get(item.key);
			if (!object) continue;

			const metadata = JSON.parse(await object.text()) as ShareMetadata;
			if (metadata.key !== objectKey) continue;

			shareKeys.push(item.key);
			shareIds.push(
				item.key.slice(SHARE_PREFIX.length, -".json".length),
			);
		}
		cursor = listed.truncated ? listed.cursor : undefined;
	} while (cursor);

	if (shareKeys.length === 0) return;

	for (let index = 0; index < shareKeys.length; index += 1000) {
		await bucket.delete(shareKeys.slice(index, index + 1000));
	}

	const organizationObject = await bucket.get(ORGANIZATION_KEY);
	if (!organizationObject) return;

	const organization = JSON.parse(
		await organizationObject.text(),
	) as ShareOrganization;
	let changed = false;
	for (const shareId of shareIds) {
		if (organization.assignments[shareId]) {
			delete organization.assignments[shareId];
			changed = true;
		}
	}

	if (changed) {
		await bucket.put(ORGANIZATION_KEY, JSON.stringify(organization), {
			httpMetadata: { contentType: "application/json" },
		});
	}
}

export class DeleteObject extends OpenAPIRoute {
	schema = {
		operationId: "post-bucket-delete-object",
		tags: ["Buckets"],
		summary: "Delete object",
		request: {
			params: z.object({
				bucket: z.string(),
			}),
			body: {
				content: {
					"application/json": {
						schema: z.object({
							key: z.string().describe("base64 encoded file key"),
						}),
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();

		const bucketName = data.params.bucket; // Store bucket name
		const bucket = c.env[bucketName] as R2Bucket | undefined; // Explicitly type as potentially undefined

		if (!bucket) {
			// Using Hono's HTTPException for proper error response
			throw new HTTPException(500, {
				message: `Bucket binding not found: ${bucketName}`,
			});
		}

		const key = decodeURIComponent(escape(atob(data.body.key)));

		await revokeObjectShares(bucket, key);
		await bucket.delete(key);

		return { success: true };
	}
}
