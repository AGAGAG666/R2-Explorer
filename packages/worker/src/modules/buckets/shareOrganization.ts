import { OpenAPIRoute } from "chanfana";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { AppContext, ShareOrganization } from "../../types";

const ORGANIZATION_KEY = ".r2-explorer/share-management.json";

const folderSchema = z.object({
	id: z.string().min(1),
	name: z.string().trim().min(1).max(100),
	parentId: z.string().min(1).nullable(),
});

const organizationSchema = z.object({
	version: z.literal(1),
	folders: z.array(folderSchema),
	assignments: z.record(z.string(), z.string()),
});

function getBucket(c: AppContext, bucketName: string) {
	const bucket = c.env[bucketName] as R2Bucket | undefined;
	if (!bucket) {
		throw new HTTPException(500, {
			message: `Bucket binding not found: ${bucketName}`,
		});
	}
	return bucket;
}

function validateOrganization(organization: ShareOrganization) {
	const folders = new Map(
		organization.folders.map((folder) => [folder.id, folder]),
	);
	if (folders.size !== organization.folders.length) {
		throw new HTTPException(400, { message: "Folder IDs must be unique" });
	}

	for (const folder of organization.folders) {
		if (folder.parentId && !folders.has(folder.parentId)) {
			throw new HTTPException(400, { message: "Parent folder not found" });
		}

		const visited = new Set([folder.id]);
		let parentId = folder.parentId;
		while (parentId) {
			if (visited.has(parentId)) {
				throw new HTTPException(400, { message: "Folder cycle detected" });
			}
			visited.add(parentId);
			parentId = folders.get(parentId)?.parentId || null;
		}
	}

	for (const folderId of Object.values(organization.assignments)) {
		if (!folders.has(folderId)) {
			throw new HTTPException(400, {
				message: "Assigned folder not found",
			});
		}
	}
}

export class GetShareOrganization extends OpenAPIRoute {
	schema = {
		operationId: "get-bucket-share-organization",
		tags: ["Buckets"],
		summary: "Get share management folders",
		request: {
			params: z.object({ bucket: z.string() }),
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const object = await getBucket(c, data.params.bucket).get(ORGANIZATION_KEY);
		if (!object) {
			return c.json({ version: 1, folders: [], assignments: {} });
		}

		return c.json(organizationSchema.parse(JSON.parse(await object.text())));
	}
}

export class PutShareOrganization extends OpenAPIRoute {
	schema = {
		operationId: "put-bucket-share-organization",
		tags: ["Buckets"],
		summary: "Update share management folders",
		request: {
			params: z.object({ bucket: z.string() }),
			body: {
				content: {
					"application/json": { schema: organizationSchema },
				},
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		validateOrganization(data.body);
		await getBucket(c, data.params.bucket).put(
			ORGANIZATION_KEY,
			JSON.stringify(data.body),
			{ httpMetadata: { contentType: "application/json" } },
		);

		return c.json(data.body);
	}
}
