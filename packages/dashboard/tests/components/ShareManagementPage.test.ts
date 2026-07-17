import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ShareManagementPage from "pages/shares/ShareManagementPage.vue";
import { mountWithContext } from "../helpers";

const {
	listShares,
	getShareOrganization,
	updateShareOrganization,
	deleteShareLink,
} = vi.hoisted(() => ({
		listShares: vi.fn(),
		getShareOrganization: vi.fn(),
		updateShareOrganization: vi.fn(),
		deleteShareLink: vi.fn(),
}));

vi.mock("src/appUtils", () => ({
	apiHandler: {
		listShares,
		getShareOrganization,
		updateShareOrganization,
		deleteShareLink,
	},
}));

const organization = {
	version: 1,
	folders: [
		{ id: "root-folder", name: "客户", parentId: null },
		{ id: "child-folder", name: "项目甲", parentId: "root-folder" },
	],
	assignments: { share2: "child-folder" },
};

describe("ShareManagementPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		listShares.mockResolvedValue({
			data: {
				shares: [
					{ shareId: "share1", key: "one.txt", shareUrl: "/share/share1", currentDownloads: 0 },
					{ shareId: "share2", key: "two.txt", shareUrl: "/share/share2", currentDownloads: 0 },
				],
			},
		});
		getShareOrganization.mockResolvedValue({
			data: structuredClone(organization),
		});
		updateShareOrganization.mockResolvedValue({ data: organization });
		deleteShareLink.mockResolvedValue({ data: { success: true } });
	});

	it("shows root folders and unclassified shares", async () => {
		const wrapper = await mountWithContext(ShareManagementPage, {
			initialRoute: "/my-bucket/shares",
		});
		await flushPromises();

		expect(wrapper.vm.childFolders.map((folder: any) => folder.name)).toEqual([
			"客户",
		]);
		expect(wrapper.vm.currentShares.map((share: any) => share.shareId)).toEqual([
			"share1",
		]);
	});

	it("shows an authenticated thumbnail for image shares only", async () => {
		listShares.mockResolvedValue({
			data: {
				shares: [
					{
						shareId: "image-share",
						key: "photos/summer.webp",
						shareUrl: "/share/image-share",
						currentDownloads: 0,
					},
					{
						shareId: "text-share",
						key: "notes.txt",
						shareUrl: "/share/text-share",
						currentDownloads: 0,
					},
				],
			},
		});
		const wrapper = await mountWithContext(ShareManagementPage, {
			initialRoute: "/my-bucket/shares",
			global: { stubs: { FileThumbnail: true } },
		});
		await flushPromises();

		const thumbnails = wrapper.findAllComponents({ name: "FileThumbnail" });
		expect(thumbnails).toHaveLength(1);
		expect(thumbnails[0].props()).toMatchObject({
			bucket: "my-bucket",
			fileKey: "photos/summer.webp",
			name: "summer.webp",
		});
	});

	it("navigates through nested management folders", async () => {
		const wrapper = await mountWithContext(ShareManagementPage, {
			initialRoute: "/my-bucket/shares",
		});
		await flushPromises();
		wrapper.vm.currentFolderId = "root-folder";
		await wrapper.vm.$nextTick();

		expect(wrapper.vm.childFolders.map((folder: any) => folder.name)).toEqual([
			"项目甲",
		]);
		expect(wrapper.vm.breadcrumbs.map((folder: any) => folder.name)).toEqual([
			"客户",
		]);
	});

	it("moves a share without modifying the share itself", async () => {
		const wrapper = await mountWithContext(ShareManagementPage, {
			initialRoute: "/my-bucket/shares",
		});
		await flushPromises();
		wrapper.vm.movingShare = wrapper.vm.shares[0];
		wrapper.vm.moveTarget = "child-folder";

		await wrapper.vm.moveShare();

		expect(updateShareOrganization).toHaveBeenCalledWith(
			"my-bucket",
			expect.objectContaining({
				assignments: expect.objectContaining({ share1: "child-folder" }),
			}),
		);
		expect(wrapper.vm.shares[0].shareUrl).toBe("/share/share1");
	});

	it("moves multiple selected shares in one organization update", async () => {
		const wrapper = await mountWithContext(ShareManagementPage, {
			initialRoute: "/my-bucket/shares",
		});
		await flushPromises();
		wrapper.vm.selectedShareIds = ["share1", "share2"];
		wrapper.vm.openMoveSelectedShares();
		wrapper.vm.moveTarget = "root-folder";

		await wrapper.vm.moveShare();

		expect(updateShareOrganization).toHaveBeenCalledTimes(1);
		expect(updateShareOrganization).toHaveBeenCalledWith(
			"my-bucket",
			expect.objectContaining({
				assignments: expect.objectContaining({
					share1: "root-folder",
					share2: "root-folder",
				}),
			}),
		);
		expect(wrapper.vm.selectedShareIds).toEqual([]);
	});

	it("creates a child folder in the current folder", async () => {
		vi.stubGlobal("crypto", { randomUUID: () => "new-folder" });
		const wrapper = await mountWithContext(ShareManagementPage, {
			initialRoute: "/my-bucket/shares",
		});
		await flushPromises();
		wrapper.vm.currentFolderId = "root-folder";
		wrapper.vm.newFolderName = "项目乙";

		await wrapper.vm.createFolder();

		expect(wrapper.vm.organization.folders).toContainEqual({
			id: "new-folder",
			name: "项目乙",
			parentId: "root-folder",
		});
	});

	it("opens details for a share", async () => {
		const wrapper = await mountWithContext(ShareManagementPage, {
			initialRoute: "/my-bucket/shares",
		});
		await flushPromises();

		wrapper.vm.openShareDetails(wrapper.vm.shares[0]);

		expect(wrapper.vm.detailsDialog).toBe(true);
		expect(wrapper.vm.detailsShare.shareId).toBe("share1");
	});

	it("deletes a share and reloads folders", async () => {
		const wrapper = await mountWithContext(ShareManagementPage, {
			initialRoute: "/my-bucket/shares",
		});
		await flushPromises();
		const share = wrapper.vm.shares[0];
		wrapper.vm.q.dialog = vi.fn(() => ({
			onOk: (callback: () => Promise<void>) => callback(),
		}));
		listShares.mockClear();
		getShareOrganization.mockClear();

		wrapper.vm.deleteShare(share);
		await flushPromises();

		expect(deleteShareLink).toHaveBeenCalledWith("my-bucket", "share1");
		expect(listShares).toHaveBeenCalledWith("my-bucket");
		expect(getShareOrganization).toHaveBeenCalledWith("my-bucket");
	});
});
