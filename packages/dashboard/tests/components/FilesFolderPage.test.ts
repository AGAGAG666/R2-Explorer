import { describe, it, expect, vi, beforeEach } from "vitest";
import { flushPromises } from "@vue/test-utils";
import FilesFolderPage from "pages/files/FilesFolderPage.vue";
import { mountWithContext } from "../helpers";

// Mock the apiHandler
vi.mock("src/appUtils", async (importOriginal) => {
	const actual = (await importOriginal()) as any;
	return {
		...actual,
		apiHandler: {
			...actual.apiHandler,
			fetchFilePage: vi.fn().mockResolvedValue({
				files: [],
				truncated: false,
				cursor: null,
			}),
			headFile: vi.fn(),
			listObjects: vi.fn(),
			listShares: vi.fn().mockResolvedValue({ data: { shares: [] } }),
			renameObject: vi.fn(),
		},
	};
});

import { apiHandler } from "src/appUtils";

// QTable stub with sort method that FilesFolderPage.mounted() calls
const QTableStub = {
	name: "QTable",
	props: ["rows", "columns", "loading"],
	template: '<div class="q-table"><slot name="body" /><slot name="no-data" /><slot name="loading" /><slot /></div>',
	methods: {
		sort: vi.fn(),
	},
};

async function mountPage(route = "/my-bucket/files") {
	return mountWithContext(FilesFolderPage, {
		initialRoute: route,
		global: {
			stubs: {
				QTable: QTableStub,
				QBtnToggle: true,
				// Stub child components that have complex templates
				FilePreview: { name: "FilePreview", template: "<div />", methods: { openFile: vi.fn() } },
				FileThumbnail: true,
				FileContextMenu: true,
				FileOptions: true,
				DragAndDrop: { name: "DragAndDrop", template: "<div><slot /></div>" },
				ShareFile: { name: "ShareFile", template: "<div />", methods: { openManageShares: vi.fn(), openCreateShare: vi.fn() } },
			},
		},
	});
}

describe("FilesFolderPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		vi.mocked(apiHandler.fetchFilePage).mockResolvedValue({
			files: [],
			truncated: false,
			cursor: null,
		});
		vi.mocked(apiHandler.listShares).mockResolvedValue({ data: { shares: [] } });
	});

	it("renders breadcrumbs showing bucket name at root", async () => {
		const wrapper = await mountPage();
		await flushPromises();

		expect(wrapper.vm.breadcrumbs).toEqual([
			{ name: "my-bucket", path: "/" },
		]);
	});

	it("renders empty state text when no files", async () => {
		const wrapper = await mountPage();
		await flushPromises();

		expect(wrapper.vm.rows).toEqual([]);
	});

	it("populates rows when files exist", async () => {
		const files = [
			{
				name: "document.pdf",
				key: "document.pdf",
				hash: "hash1",
				nameHash: "nameHash1",
				lastModified: "2 hours",
				timestamp: Date.now(),
				size: "1 KB",
				sizeRaw: 1024,
				type: "file",
				icon: "article",
				color: "grey",
			},
			{
				name: "photos/",
				key: "photos/",
				hash: "hash2",
				lastModified: "--",
				timestamp: 0,
				size: "--",
				sizeRaw: 0,
				type: "folder",
				icon: "folder",
				color: "orange",
			},
		];

		vi.mocked(apiHandler.fetchFilePage).mockResolvedValue({
			files,
			truncated: false,
			cursor: null,
		});

		const wrapper = await mountPage();
		await flushPromises();

		expect(wrapper.vm.rows).toHaveLength(2);
	});

	it("computes selectedBucket from route", async () => {
		const wrapper = await mountPage();

		expect(wrapper.vm.selectedBucket).toBe("my-bucket");
	});

	it("defines correct table columns", async () => {
		const wrapper = await mountPage();

		const colNames = wrapper.vm.columns.map((c: any) => c.name);
		expect(colNames).toEqual(["name", "lastModified", "size", "options"]);
	});

	it("recognizes supported image files for thumbnails", async () => {
		const wrapper = await mountPage();

		expect(wrapper.vm.isImage({ type: "file", name: "photo.JPG" })).toBe(true);
		expect(wrapper.vm.isImage({ type: "file", name: "photo.svg" })).toBe(false);
		expect(wrapper.vm.isImage({ type: "folder", name: "photo.jpg" })).toBe(false);
	});

	it("switches to icon view and remembers the preference", async () => {
		const wrapper = await mountPage();

		wrapper.vm.viewMode = "grid";
		wrapper.vm.saveViewMode("grid");
		await wrapper.vm.$nextTick();

		expect(localStorage.getItem("r2_explorer_view_mode")).toBe("grid");
		expect(wrapper.find(".file-grid-empty").exists()).toBe(true);
	});

	it("restores the saved icon view preference", async () => {
		localStorage.setItem("r2_explorer_view_mode", "grid");

		const wrapper = await mountPage();

		expect(wrapper.vm.viewMode).toBe("grid");
	});

	it("sorts folders before files in icon view", async () => {
		const wrapper = await mountPage();
		wrapper.vm.rows = [
			{ name: "z-file.txt", key: "z-file.txt", type: "file" },
			{ name: "B-folder/", key: "B-folder/", type: "folder" },
			{ name: "a-folder/", key: "a-folder/", type: "folder" },
			{ name: "a-file.txt", key: "a-file.txt", type: "file" },
		];

		expect(wrapper.vm.gridRows.map((row: any) => row.name)).toEqual([
			"a-folder/",
			"B-folder/",
			"a-file.txt",
			"z-file.txt",
		]);
	});

	it("renders one icon tile per row", async () => {
		vi.mocked(apiHandler.fetchFilePage).mockResolvedValue({
			files: [
				{ name: "photos/", key: "photos/", type: "folder", icon: "folder" },
				{ name: "note.txt", key: "note.txt", type: "file", icon: "article", size: "1 KB" },
			],
			truncated: false,
			cursor: null,
		});
		localStorage.setItem("r2_explorer_view_mode", "grid");

		const wrapper = await mountPage();
		await flushPromises();

		expect(wrapper.findAll(".file-grid-item")).toHaveLength(2);
	});

	it("navigates to folder on openObject with folder", async () => {
		const wrapper = await mountPage();
		const routerPush = vi.spyOn(wrapper.vm.$router, "push");

		wrapper.vm.openObject({
			type: "folder",
			key: "photos/",
		});

		expect(routerPush).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "files-folder",
				params: expect.objectContaining({ bucket: "my-bucket" }),
			}),
		);
	});

	it("opens the standalone share management page", async () => {
		const wrapper = await mountPage();
		const routerPush = vi.spyOn(wrapper.vm.$router, "push");

		wrapper.vm.openShareManagement();

		expect(routerPush).toHaveBeenCalledWith({
			name: "shares-home",
			params: { bucket: "my-bucket" },
		});
	});

	it("marks files that have share links", async () => {
		vi.mocked(apiHandler.listShares).mockResolvedValue({
			data: {
				shares: [{ shareId: "share-1", key: "document.pdf" }],
			},
		});
		const wrapper = await mountPage();
		await flushPromises();

		expect(wrapper.vm.hasShares({ type: "file", key: "document.pdf" })).toBe(true);
		expect(wrapper.vm.hasShares({ type: "file", key: "other.pdf" })).toBe(false);
		expect(wrapper.vm.hasShares({ type: "folder", key: "document.pdf" })).toBe(
			false,
		);
	});

	it("opens the current file share links", async () => {
		const wrapper = await mountPage();
		await flushPromises();
		const row = { type: "file", key: "document.pdf" };
		wrapper.vm.shares = [{ shareId: "share-1", key: "document.pdf" }];
		const shareFile = wrapper.vm.$refs.shareFile as any;
		const openManageShares = vi.spyOn(shareFile, "openManageShares");

		wrapper.vm.openFileShares(row);

		expect(openManageShares).toHaveBeenCalledWith(row);
	});

	it("moves multiple selected files while preserving their names", async () => {
		const wrapper = await mountPage();
		await flushPromises();
		wrapper.vm.rows = [
			{ type: "file", key: "one.txt", name: "one.txt" },
			{ type: "file", key: "nested/two.txt", name: "two.txt" },
		];
		wrapper.vm.selectedFileKeys = ["one.txt", "nested/two.txt"];
		wrapper.vm.moveFilesTarget = "archive/";

		await wrapper.vm.moveSelectedFiles();

		expect(apiHandler.renameObject).toHaveBeenNthCalledWith(
			1,
			"my-bucket",
			"one.txt",
			"archive/one.txt",
		);
		expect(apiHandler.renameObject).toHaveBeenNthCalledWith(
			2,
			"my-bucket",
			"nested/two.txt",
			"archive/two.txt",
		);
		expect(wrapper.vm.selectedFileKeys).toEqual([]);
	});

	it("calls fetchFilePage on created", async () => {
		await mountPage();
		await flushPromises();

		expect(apiHandler.fetchFilePage).toHaveBeenCalledWith(
			"my-bucket",
			"",
			"/",
			null,
			"",
		);
	});

	it("registers fetchFiles bus event on mount", async () => {
		const wrapper = await mountPage();

		expect(wrapper.vm.$bus.on).toHaveBeenCalledWith(
			"fetchFiles",
			expect.any(Function),
		);
	});

	it("handles search by resetting and refetching", async () => {
		const wrapper = await mountPage();
		await flushPromises();
		vi.clearAllMocks();

		wrapper.vm.searchQuery = "test";
		wrapper.vm.handleSearch();
		await flushPromises();

		expect(apiHandler.fetchFilePage).toHaveBeenCalledWith(
			"my-bucket",
			"test",
			"/",
			null,
			"",
		);
	});

	it("clears search resets query and refetches", async () => {
		const wrapper = await mountPage();
		await flushPromises();
		vi.clearAllMocks();

		wrapper.vm.searchQuery = "test";
		wrapper.vm.clearSearch();
		await flushPromises();

		expect(wrapper.vm.searchQuery).toBe("");
		expect(apiHandler.fetchFilePage).toHaveBeenCalled();
	});
});
