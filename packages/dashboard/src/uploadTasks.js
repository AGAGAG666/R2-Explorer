import { apiHandler } from "src/appUtils";

export const UPLOAD_CHUNK_SIZE = 95 * 1024 * 1024;
const STORAGE_KEY = "r2_explorer_upload_tasks_v1";
const fileBindings = new Map();

function loadAllTasks() {
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
	} catch {
		return [];
	}
}

function saveTasks(tasks) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

export function loadUploadTasks(bucket) {
	const tasks = loadAllTasks();
	let changed = false;
	for (const task of tasks) {
		if (task.bucket === bucket && task.status === "uploading") {
			task.status = "paused";
			changed = true;
		}
	}
	if (changed) saveTasks(tasks);
	return tasks.filter((task) => task.bucket === bucket);
}

export function createUploadTasks(bucket, folder, files) {
	const existing = loadAllTasks();
	const normalizedFolder = folder && !folder.endsWith("/") ? `${folder}/` : folder;
	const selectedFiles = Array.from(files);
	const created = selectedFiles.map((file) => ({
		id: crypto.randomUUID(),
		bucket,
		folder: normalizedFolder,
		key: `${normalizedFolder}${file.webkitRelativePath || file.name}`,
		name: file.name,
		relativePath: file.webkitRelativePath || "",
		size: file.size,
		type: file.type,
		lastModified: file.lastModified,
		chunkSize: UPLOAD_CHUNK_SIZE,
		uploadId: null,
		parts: [],
		status: "waiting",
		createdAt: Date.now(),
	}));
	saveTasks([...existing, ...created]);
	for (const [index, task] of created.entries()) {
		fileBindings.set(task.id, selectedFiles[index]);
	}
	return created;
}

export function updateUploadTask(bucket, taskId, changes) {
	const tasks = loadAllTasks();
	const task = tasks.find((item) => item.id === taskId);
	if (!task || task.bucket !== bucket) return null;
	Object.assign(task, changes);
	saveTasks(tasks);
	return task;
}

export function removeUploadTask(bucket, taskId) {
	saveTasks(
		loadAllTasks().filter(
			(task) => task.id !== taskId || task.bucket !== bucket,
		),
	);
	fileBindings.delete(taskId);
}

export function restartUploadTask(bucket, taskId) {
	return updateUploadTask(bucket, taskId, {
		uploadId: null,
		parts: [],
		status: "waiting",
		error: null,
	});
}

export function getUploadTaskFile(taskId) {
	return fileBindings.get(taskId);
}

export function bindUploadTaskFile(taskId, file) {
	fileBindings.set(taskId, file);
}

export function matchesUploadTask(task, file) {
	return (
		task.name === file.name &&
		task.size === file.size &&
		task.lastModified === file.lastModified &&
		(task.relativePath || "") === (file.webkitRelativePath || "")
	);
}

export async function uploadTask(task, file, onProgress = () => {}) {
	if (!matchesUploadTask(task, file)) {
		throw new Error("请选择名称、大小和修改时间均相同的原文件");
	}

	task = updateUploadTask(task.bucket, task.id, {
		status: "uploading",
		error: null,
	});

	try {
		if (file.size === 0) {
			await apiHandler.uploadObjects(file, task.key, task.bucket, (event) => {
				onProgress(event.loaded, file.size);
			});
			onProgress(0, 0);
			return updateUploadTask(task.bucket, task.id, {
				status: "completed",
				completedAt: Date.now(),
			});
		}

		if (!task.uploadId) {
			const response = await apiHandler.multipartCreate(
				file,
				task.key,
				task.bucket,
			);
			task = updateUploadTask(task.bucket, task.id, {
				uploadId: response.data.uploadId,
			});
		}

		const completedParts = new Map(
			task.parts.map((part) => [part.partNumber, part]),
		);
		for (
			let start = 0, partNumber = 1;
			start < file.size;
			start += task.chunkSize, partNumber += 1
		) {
			if (completedParts.has(partNumber)) {
				onProgress(Math.min(start + task.chunkSize, file.size), file.size);
				continue;
			}

			const end = Math.min(start + task.chunkSize, file.size);
			const response = await apiHandler.multipartUpload(
				task.uploadId,
				partNumber,
				task.bucket,
				task.key,
				file.slice(start, end),
				(event) => onProgress(start + event.loaded, file.size),
			);
			completedParts.set(partNumber, response.data);
			task = updateUploadTask(task.bucket, task.id, {
				parts: [...completedParts.values()].sort(
					(a, b) => a.partNumber - b.partNumber,
				),
			});
		}

		await apiHandler.multipartComplete(
			file,
			task.key,
			task.bucket,
			task.parts,
			task.uploadId,
		);

		onProgress(file.size, file.size);
		return updateUploadTask(task.bucket, task.id, {
			status: "completed",
			completedAt: Date.now(),
		});
	} catch (error) {
		updateUploadTask(task.bucket, task.id, {
			status: "paused",
			error: error.response?.data?.message || error.message,
		});
		throw error;
	}
}
