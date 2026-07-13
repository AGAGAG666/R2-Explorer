import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FileThumbnail from "components/files/FileThumbnail.vue";

const { downloadFile } = vi.hoisted(() => ({
	downloadFile: vi.fn(),
}));

vi.mock("src/appUtils", () => ({
	apiHandler: {
		downloadFile,
	},
}));

const props = {
	bucket: "AG网盘",
	fileKey: "photos/image.jpg",
	name: "image.jpg",
	icon: "article",
	color: "grey",
};

describe("FileThumbnail", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("IntersectionObserver", undefined);
		vi.stubGlobal("URL", {
			createObjectURL: vi.fn(() => "blob:thumbnail"),
			revokeObjectURL: vi.fn(),
		});
	});

	it("downloads the image through the authenticated API", async () => {
		downloadFile.mockResolvedValue({ data: new Uint8Array([1, 2, 3]) });

		const wrapper = mount(FileThumbnail, { props });
		await flushPromises();

		expect(downloadFile).toHaveBeenCalledWith("AG网盘", "photos/image.jpg", {
			downloadType: "objectUrl",
		});
		expect(wrapper.find("img").attributes("src")).toBe("blob:thumbnail");
	});

	it("falls back to the file icon when loading fails", async () => {
		downloadFile.mockRejectedValue(new Error("download failed"));

		const wrapper = mount(FileThumbnail, { props });
		await flushPromises();

		expect(wrapper.find("img").exists()).toBe(false);
		expect(wrapper.vm.failed).toBe(true);
	});

	it("releases its object URL when unmounted", async () => {
		downloadFile.mockResolvedValue({ data: new Uint8Array([1, 2, 3]) });
		const wrapper = mount(FileThumbnail, { props });
		await flushPromises();

		wrapper.unmount();

		expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:thumbnail");
	});

	it("releases an object URL when loading finishes after unmount", async () => {
		let resolveDownload: (value: unknown) => void;
		downloadFile.mockReturnValue(
			new Promise((resolve) => {
				resolveDownload = resolve;
			}),
		);
		const wrapper = mount(FileThumbnail, { props });
		wrapper.unmount();

		resolveDownload!({ data: new Uint8Array([1, 2, 3]) });
		await flushPromises();

		expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:thumbnail");
	});
});
