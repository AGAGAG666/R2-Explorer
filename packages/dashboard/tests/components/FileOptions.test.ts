import { beforeEach, describe, expect, it, vi } from "vitest";
import FileOptions from "components/files/FileOptions.vue";
import { apiHandler } from "src/appUtils";
import { mountWithContext } from "../helpers";

vi.mock("src/appUtils", async (importOriginal) => {
	const actual = (await importOriginal()) as any;
	return {
		...actual,
		apiHandler: {
			...actual.apiHandler,
			renameObject: vi.fn(),
		},
	};
});

describe("FileOptions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renames an uploaded file within its current folder", async () => {
		const wrapper = await mountWithContext(FileOptions, {
			initialRoute: "/my-bucket/files",
		});
		await wrapper.vm.renameObject({
			type: "file",
			key: "documents/old.txt",
			name: "old.txt",
		});
		wrapper.vm.renameInput = "new.txt";

		await wrapper.vm.renameConfirm();

		expect(apiHandler.renameObject).toHaveBeenCalledWith(
			"my-bucket",
			"documents/old.txt",
			"documents/new.txt",
		);
		expect(wrapper.vm.$bus.emit).toHaveBeenCalledWith("fetchFiles");
	});

	it("rejects names containing path separators", async () => {
		const wrapper = await mountWithContext(FileOptions, {
			initialRoute: "/my-bucket/files",
		});
		await wrapper.vm.renameObject({
			type: "file",
			key: "old.txt",
			name: "old.txt",
		});
		wrapper.vm.renameInput = "nested/new.txt";

		await wrapper.vm.renameConfirm();

		expect(apiHandler.renameObject).not.toHaveBeenCalled();
	});
});
