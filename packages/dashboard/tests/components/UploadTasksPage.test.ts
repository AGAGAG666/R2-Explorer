import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UploadTasksPage from "pages/uploads/UploadTasksPage.vue";
import { mountWithContext } from "../helpers";

const {
	createUploadTasks,
	loadUploadTasks,
	matchesUploadTask,
	bindUploadTaskFile,
	getUploadTaskFile,
	restartUploadTask,
	uploadTask,
} = vi.hoisted(() => ({
	createUploadTasks: vi.fn(),
	loadUploadTasks: vi.fn(),
	matchesUploadTask: vi.fn(),
	bindUploadTaskFile: vi.fn(),
	getUploadTaskFile: vi.fn(),
	restartUploadTask: vi.fn(),
	uploadTask: vi.fn(),
}));

vi.mock("src/uploadTasks", () => ({
	createUploadTasks,
	loadUploadTasks,
	matchesUploadTask,
	bindUploadTaskFile,
	getUploadTaskFile,
	removeUploadTask: vi.fn(),
	restartUploadTask,
	uploadTask,
}));

describe("UploadTasksPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		loadUploadTasks.mockReturnValue([]);
		getUploadTaskFile.mockReturnValue(undefined);
		restartUploadTask.mockImplementation((_bucket, _id) => null);
		uploadTask.mockResolvedValue({ status: "completed" });
	});

	it("creates upload tasks in the folder from the route", async () => {
		const task = {
			id: "task-1",
			name: "photo.jpg",
			status: "waiting",
			createdAt: 1,
			parts: [],
			size: 10,
			chunkSize: 100,
		};
		createUploadTasks.mockReturnValue([task]);
		loadUploadTasks.mockReturnValue([task]);
		const wrapper = await mountWithContext(UploadTasksPage, {
			initialRoute: "/my-bucket/uploads?folder=photos/2026/",
		});
		const file = new File(["image"], "photo.jpg", { lastModified: 123 });

		wrapper.vm.selectFiles({ target: { files: [file], value: "selected" } });
		await flushPromises();

		expect(createUploadTasks).toHaveBeenCalledWith(
			"my-bucket",
			"photos/2026/",
			[file],
		);
		expect(uploadTask).toHaveBeenCalledWith(
			task,
			file,
			expect.any(Function),
			expect.objectContaining({ signal: expect.any(AbortSignal) }),
		);
	});

	it("rebinds the original file before resuming a persisted task", async () => {
		const task = {
			id: "task-1",
			name: "archive.zip",
			status: "paused",
			createdAt: 1,
			parts: [{ partNumber: 1, etag: "etag-1" }],
			size: 10,
			chunkSize: 5,
		};
		loadUploadTasks.mockReturnValue([task]);
		matchesUploadTask.mockReturnValue(true);
		const wrapper = await mountWithContext(UploadTasksPage, {
			initialRoute: "/my-bucket/uploads",
		});
		const file = new File(["archive"], "archive.zip", { lastModified: 123 });
		wrapper.vm.pendingTask = task;

		wrapper.vm.selectFiles({ target: { files: [file], value: "selected" } });
		await flushPromises();

		expect(bindUploadTaskFile).toHaveBeenCalledWith("task-1", file);
		expect(uploadTask).toHaveBeenCalledWith(
			task,
			file,
			expect.any(Function),
			expect.objectContaining({ signal: expect.any(AbortSignal) }),
		);
	});

	it("clears stale parts before asking for a file to restart", async () => {
		const task = {
			id: "task-1",
			name: "archive.zip",
			status: "paused",
			createdAt: 1,
			parts: [{ partNumber: 1, etag: "etag-1" }],
			size: 10,
			chunkSize: 5,
		};
		loadUploadTasks.mockReturnValue([task]);
		restartUploadTask.mockReturnValue({ ...task, parts: [], uploadId: null });
		const wrapper = await mountWithContext(UploadTasksPage, {
			initialRoute: "/my-bucket/uploads",
		});
		const chooseFile = vi.spyOn(wrapper.vm.$refs.fileInput, "click");

		wrapper.vm.restartTask(task);

		expect(restartUploadTask).toHaveBeenCalledWith("my-bucket", "task-1");
		expect(wrapper.vm.pendingTask).toMatchObject({ parts: [], uploadId: null });
		expect(chooseFile).toHaveBeenCalled();
	});

	it("explains whether an action resumes or discards saved parts", async () => {
		const task = {
			id: "task-1",
			name: "archive.zip",
			status: "paused",
			createdAt: 1,
			parts: [{ partNumber: 1, etag: "etag-1" }],
			size: 10,
			chunkSize: 5,
		};
		loadUploadTasks.mockReturnValue([task]);
		const wrapper = await mountWithContext(UploadTasksPage, {
			initialRoute: "/my-bucket/uploads",
		});

		expect(wrapper.text()).toContain("继续上传（选择原文件）");
		expect(wrapper.text()).toContain("从头上传（放弃断点）");
		expect(wrapper.text()).toContain("已完成分片会保留");
	});
});
