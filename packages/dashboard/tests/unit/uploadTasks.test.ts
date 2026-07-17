import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createUploadTasks,
	loadUploadTasks,
	matchesUploadTask,
	restartUploadTask,
	updateUploadTask,
	uploadTask,
} from "src/uploadTasks";

const { multipartCreate, multipartUpload, multipartComplete, uploadObjects } =
	vi.hoisted(() => ({
		multipartCreate: vi.fn(),
		multipartUpload: vi.fn(),
		multipartComplete: vi.fn(),
		uploadObjects: vi.fn(),
	}));

vi.mock("src/appUtils", () => ({
	apiHandler: {
		multipartCreate,
		multipartUpload,
		multipartComplete,
		uploadObjects,
	},
}));

describe("uploadTasks", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
		vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "task-1") });
	});

	it("persists tasks per bucket with normalized target paths", () => {
		const file = new File(["content"], "photo.jpg", {
			type: "image/jpeg",
			lastModified: 123,
		});
		createUploadTasks("bucket-a", "photos", [file]);
		vi.mocked(crypto.randomUUID).mockReturnValue("task-2");
		createUploadTasks("bucket-b", "", [file]);

		expect(loadUploadTasks("bucket-a")[0]).toMatchObject({
			id: "task-1",
			key: "photos/photo.jpg",
			status: "waiting",
		});
		expect(loadUploadTasks("bucket-b")[0].id).toBe("task-2");
	});

	it("matches only the original file", () => {
		const task = { name: "data.bin", size: 4, lastModified: 123 };
		expect(
			matchesUploadTask(
				task,
				new File(["data"], "data.bin", { lastModified: 123 }),
			),
		).toBe(true);
		expect(
			matchesUploadTask(
				task,
				new File(["data"], "other.bin", { lastModified: 123 }),
			),
		).toBe(false);
	});

	it("marks an interrupted upload as resumable after reload", () => {
		const file = new File(["content"], "data.bin", { lastModified: 123 });
		const [task] = createUploadTasks("bucket-a", "", [file]);
		updateUploadTask("bucket-a", task.id, { status: "uploading" });

		expect(loadUploadTasks("bucket-a")[0].status).toBe("paused");
	});

	it("clears stale multipart state when restarting a task", () => {
		const file = new File(["content"], "data.bin", { lastModified: 123 });
		const [task] = createUploadTasks("bucket-a", "", [file]);
		updateUploadTask("bucket-a", task.id, {
			uploadId: "expired-upload",
			parts: [{ partNumber: 1, etag: "etag-1" }],
			status: "paused",
			error: "The specified multipart upload does not exist",
		});

		expect(restartUploadTask("bucket-a", task.id)).toMatchObject({
			uploadId: null,
			parts: [],
			status: "waiting",
			error: null,
		});
	});

	it("continues from persisted multipart parts", async () => {
		const file = new File(["abcdef"], "data.bin", { lastModified: 123 });
		const [created] = createUploadTasks("bucket-a", "", [file]);
		const task = updateUploadTask("bucket-a", created.id, {
			chunkSize: 3,
			uploadId: "upload-1",
			parts: [{ partNumber: 1, etag: "etag-1" }],
		});
		multipartUpload.mockResolvedValue({
			data: { partNumber: 2, etag: "etag-2" },
		});
		multipartComplete.mockResolvedValue({ data: { success: true } });

		await uploadTask(task, file);

		expect(multipartCreate).not.toHaveBeenCalled();
		expect(multipartUpload).toHaveBeenCalledTimes(1);
		expect(multipartUpload).toHaveBeenCalledWith(
			"upload-1",
			2,
			"bucket-a",
			"data.bin",
			expect.any(Blob),
			expect.any(Function),
		);
		expect(multipartComplete).toHaveBeenCalledWith(
			file,
			"data.bin",
			"bucket-a",
			[
				{ partNumber: 1, etag: "etag-1" },
				{ partNumber: 2, etag: "etag-2" },
			],
			"upload-1",
		);
		expect(loadUploadTasks("bucket-a")[0].status).toBe("completed");
	});
});
