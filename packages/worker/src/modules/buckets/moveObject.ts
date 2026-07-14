import { OpenAPIRoute } from "chanfana";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { AppContext, ShareMetadata } from "../../types";

const SHARE_PREFIX = ".r2-explorer/sharable-links/";

async function updateShareTargets(
	bucket: R2Bucket,
	oldKey: string,
	newKey: string,
) {
	const updated: Array<{ key: string; metadata: ShareMetadata }> = [];
	let cursor: string | undefined;
	try {
		do {
			const listed = await bucket.list({ prefix: SHARE_PREFIX, cursor });
			for (const item of listed.objects) {
				const object = await bucket.get(item.key);
				if (!object) continue;

				const metadata = JSON.parse(await object.text()) as ShareMetadata;
				if (metadata.key !== oldKey) continue;

				updated.push({ key: item.key, metadata: { ...metadata } });
				metadata.key = newKey;
				await bucket.put(item.key, JSON.stringify(metadata), {
					httpMetadata: { contentType: "application/json" },
				});
			}
			cursor = listed.truncated ? listed.cursor : undefined;
		} while (cursor);
	} catch (error) {
		await Promise.all(
			updated.map(({ key, metadata }) =>
				bucket.put(key, JSON.stringify(metadata), {
					httpMetadata: { contentType: "application/json" },
				}),
			),
		);
		throw error;
	}
}

export class MoveObject extends OpenAPIRoute {
	schema = {
		operationId: "post-bucket-move-object",
		tags: ["Buckets"],
		summary: "Move object",
		request: {
			params: z.object({
				bucket: z.string(),
			}),
			body: {
				content: {
					"application/json": {
						schema: z.object({
							oldKey: z.string().describe("base64 encoded file key"),
							newKey: z.string().describe("base64 encoded file key"),
						}),
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();

		const bucketName = data.params.bucket;
		const bucket = c.env[bucketName] as R2Bucket | undefined;

		if (!bucket) {
			throw new HTTPException(500, {
				message: `Bucket binding not found: ${bucketName}`,
			});
		}

		const oldKey = decodeURIComponent(escape(atob(data.body.oldKey)));
		const newKey = decodeURIComponent(escape(atob(data.body.newKey)));

		if (!(await bucket.head(oldKey))) {
			throw new HTTPException(404, {
				message: `Source object not found: ${oldKey}`,
			});
		}
		if (oldKey === newKey) {
			throw new HTTPException(400, {
				message: "Source and destination must be different",
			});
		}
		if (await bucket.head(newKey)) {
			throw new HTTPException(409, {
				message: `Destination object already exists: ${newKey}`,
			});
		}

		const object = await bucket.get(oldKey);
		if (!object) {
			throw new HTTPException(404, {
				message: `Source object not found: ${oldKey}`,
			});
		}

		const resp = await bucket.put(newKey, object.body, {
			customMetadata: object.customMetadata,
			httpMetadata: object.httpMetadata,
		});

		try {
			await updateShareTargets(bucket, oldKey, newKey);
		} catch (error) {
			await bucket.delete(newKey);
			throw error;
		}
		await bucket.delete(oldKey);

		return resp;
	}
}
