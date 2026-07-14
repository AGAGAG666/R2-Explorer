import { beforeEach, describe, expect, it, vi } from "vitest";
import ShareFile from "components/files/ShareFile.vue";
import { apiHandler } from "src/appUtils";
import { mountWithContext } from "../helpers";

vi.mock("src/appUtils", async (importOriginal) => {
	const actual = (await importOriginal()) as any;
	return {
		...actual,
		apiHandler: {
			...actual.apiHandler,
			listShares: vi.fn(),
			deleteShareLink: vi.fn(),
		},
	};
});

async function mountShareFile() {
	return mountWithContext(ShareFile, {
		initialRoute: "/my-bucket/files",
	});
}

describe("ShareFile", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(apiHandler.listShares).mockResolvedValue({ data: { shares: [] } });
	});

	it("filters the management dialog to the selected file", async () => {
		const wrapper = await mountShareFile();
		const shares = [
			{ shareId: "share-1", key: "document.pdf" },
			{ shareId: "share-2", key: "other.pdf" },
		];

		await wrapper.vm.openManageShares(
			{ key: "document.pdf", name: "document.pdf" },
			shares,
		);

		expect(wrapper.vm.managedFileKey).toBe("document.pdf");
		expect(wrapper.vm.shares).toEqual([shares[0]]);
	});

	it("loads only links belonging to the selected file", async () => {
		vi.mocked(apiHandler.listShares).mockResolvedValue({
			data: {
				shares: [
					{ shareId: "share-1", key: "document.pdf" },
					{ shareId: "share-2", key: "other.pdf" },
				],
			},
		});
		const wrapper = await mountShareFile();

		await wrapper.vm.openManageShares({ key: "document.pdf" });

		expect(wrapper.vm.shares).toEqual([
			{ shareId: "share-1", key: "document.pdf" },
		]);
	});
});
