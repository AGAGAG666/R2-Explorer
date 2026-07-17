<template>
  <q-page class="upload-page q-pa-md">
    <div class="upload-header">
      <div>
        <div class="text-h5 text-weight-medium">上传任务</div>
        <div class="text-grey-7 q-mt-xs">大文件按分片上传。刷新或断线后，重新选择原文件即可继续。</div>
      </div>
      <div class="upload-select-actions">
        <q-btn flat color="primary" icon="drive_folder_upload" label="选择文件夹" :disable="mainStore.apiReadonly" @click="$refs.folderInput.click()" />
        <q-btn color="primary" icon="upload_file" label="选择文件" :disable="mainStore.apiReadonly" @click="$refs.fileInput.click()" />
      </div>
    </div>

    <input ref="fileInput" class="hidden-input" type="file" multiple @change="selectFiles" />
    <input ref="folderInput" class="hidden-input" type="file" webkitdirectory multiple @change="selectFiles" />

    <q-banner rounded class="resume-note q-my-md">
      浏览器不会在刷新后保留文件读取权限。任务进度会保留，但继续上传时必须重新选择同一个原文件。
    </q-banner>

    <div v-if="tasks.length" class="task-list">
      <q-card v-for="task in tasks" :key="task.id" flat bordered class="task-card">
        <q-card-section>
          <div class="task-heading">
            <div class="task-main">
              <div class="text-weight-medium task-name">{{ task.name }}</div>
              <div class="text-caption text-grey-7 task-key">{{ task.key }}</div>
            </div>
            <q-chip :color="statusColor(task.status)" text-color="white" size="sm">{{ statusLabel(task.status) }}</q-chip>
          </div>

          <q-linear-progress rounded size="10px" :value="progressFor(task)" color="primary" track-color="grey-3" class="q-mt-md" />
          <div class="task-meta q-mt-sm">
            <span>{{ formatSize(task.size) }}</span>
            <span>{{ Math.round(progressFor(task) * 100) }}%</span>
            <span v-if="task.parts.length">已完成 {{ task.parts.length }} 个分片</span>
          </div>
          <div v-if="task.error" class="text-negative text-caption q-mt-sm">{{ task.error }}</div>

          <div class="task-actions q-mt-md">
            <q-btn
              v-if="task.status !== 'completed'"
              flat
              color="primary"
              icon="restart_alt"
              :label="filesByTask[task.id] ? '继续上传' : '重新选择原文件'"
              :loading="activeTaskId === task.id"
              @click="continueTask(task)"
            />
            <q-btn
              v-if="task.status !== 'completed'"
              flat
              color="orange-9"
              icon="refresh"
              label="重新开始"
              :disable="activeTaskId === task.id"
              @click="restartTask(task)"
            />
            <q-btn v-if="task.status === 'completed'" flat color="primary" icon="folder" label="查看文件" @click="openFileFolder(task)" />
            <q-btn flat color="negative" icon="delete" label="移除记录" :disable="activeTaskId === task.id" @click="removeTask(task)" />
          </div>
        </q-card-section>
      </q-card>
    </div>

    <div v-else class="upload-empty text-grey-7">
      <q-icon name="cloud_upload" size="64px" color="blue-grey-4" />
      <div class="text-subtitle1">还没有上传任务</div>
      <div class="text-caption">选择文件后会在此处上传并保存断点。</div>
    </div>
  </q-page>
</template>

<script>
import { useQuasar } from "quasar";
import { ROOT_FOLDER, encode } from "src/appUtils";
import {
	bindUploadTaskFile,
	createUploadTasks,
	getUploadTaskFile,
	loadUploadTasks,
	matchesUploadTask,
	removeUploadTask,
	restartUploadTask,
	uploadTask,
} from "src/uploadTasks";
import { useMainStore } from "stores/main-store";

export default {
	name: "UploadTasksPage",
	data: () => ({
		tasks: [],
		filesByTask: {},
		progress: {},
		activeTaskId: null,
		pendingTask: null,
	}),
	computed: {
		selectedBucket() {
			return this.$route.params.bucket;
		},
		targetFolder() {
			const folder = this.$route.query.folder;
			if (!folder || folder === ROOT_FOLDER) return "";
			return folder.endsWith("/") ? folder : `${folder}/`;
		},
	},
	watch: {
		selectedBucket() {
			this.reloadTasks();
		},
	},
	methods: {
		reloadTasks() {
			this.tasks = loadUploadTasks(this.selectedBucket).sort(
				(a, b) => b.createdAt - a.createdAt,
			);
		},
		selectFiles(event) {
			const files = Array.from(event.target.files || []);
			if (!files.length) return;

			if (this.pendingTask) {
				const file = files.find((item) => matchesUploadTask(this.pendingTask, item));
				if (!file) {
					this.q.notify({ type: "negative", message: "所选文件与原上传任务不匹配" });
				} else {
					bindUploadTaskFile(this.pendingTask.id, file);
					this.filesByTask[this.pendingTask.id] = file;
					this.startTask(this.pendingTask);
				}
				this.pendingTask = null;
			} else {
				const created = createUploadTasks(
					this.selectedBucket,
					this.targetFolder,
					files,
				);
				for (const [index, task] of created.entries()) {
					this.filesByTask[task.id] = files[index];
				}
				this.reloadTasks();
				this.startNextWaitingTask();
			}

			event.target.value = "";
		},
		continueTask(task) {
			if (this.filesByTask[task.id]) {
				this.startTask(task);
				return;
			}
			this.pendingTask = task;
			this.$refs.fileInput.click();
		},
		restartTask(task) {
			this.pendingTask = restartUploadTask(this.selectedBucket, task.id);
			this.reloadTasks();
			this.$refs.fileInput.click();
		},
		async startTask(task) {
			if (this.activeTaskId) return;
			const file = this.filesByTask[task.id];
			if (!file) return;
			this.activeTaskId = task.id;
			try {
				await uploadTask(task, file, (loaded, total) => {
					this.progress[task.id] = loaded / total;
				});
				delete this.filesByTask[task.id];
				this.q.notify({ type: "positive", message: `${task.name} 上传完成` });
			} catch (error) {
				this.q.notify({ type: "negative", message: `${task.name} 上传已暂停` });
			} finally {
				this.activeTaskId = null;
				this.reloadTasks();
				this.startNextWaitingTask();
			}
		},
		startNextWaitingTask() {
			if (this.activeTaskId) return;
			const next = this.tasks.find(
				(task) => task.status === "waiting" && this.filesByTask[task.id],
			);
			if (next) this.startTask(next);
		},
		removeTask(task) {
			if (this.activeTaskId === task.id) return;
			removeUploadTask(this.selectedBucket, task.id);
			delete this.filesByTask[task.id];
			delete this.progress[task.id];
			this.reloadTasks();
		},
		progressFor(task) {
			if (task.status === "completed") return 1;
			if (task.size === 0) return 0;
			if (this.progress[task.id] !== undefined) return this.progress[task.id];
			return Math.min(1, (task.parts.length * task.chunkSize) / task.size);
		},
		openFileFolder(task) {
			const slash = task.key.lastIndexOf("/");
			const folder = slash >= 0 ? task.key.slice(0, slash + 1) : "";
			this.$router.push({
				name: folder ? "files-folder" : "files-home",
				params: folder ? { bucket: task.bucket, folder: encode(folder) } : { bucket: task.bucket },
			});
		},
		statusLabel: (status) => ({ waiting: "等待中", uploading: "上传中", paused: "可继续", completed: "已完成" })[status] || status,
		statusColor: (status) => ({ waiting: "blue-grey", uploading: "blue", paused: "orange", completed: "green" })[status] || "grey",
		formatSize(size) {
			if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
			if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
			return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`;
		},
	},
	created() {
		this.reloadTasks();
		for (const task of this.tasks) {
			const file = getUploadTaskFile(task.id);
			if (file) this.filesByTask[task.id] = file;
		}
		this.startNextWaitingTask();
	},
	setup() {
		return { mainStore: useMainStore(), q: useQuasar() };
	},
};
</script>

<style scoped>
.upload-header,
.task-heading,
.task-meta,
.task-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.upload-select-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.hidden-input {
  display: none;
}

.resume-note {
  background: #eef6ff;
  color: #234d73;
}

.task-list {
  display: grid;
  gap: 12px;
}

.task-card,
.task-main {
  min-width: 0;
}

.task-main {
  flex: 1;
}

.task-name,
.task-key {
  overflow-wrap: anywhere;
}

.task-meta {
  justify-content: flex-start;
  flex-wrap: wrap;
  color: #607d8b;
  font-size: 12px;
}

.task-actions {
  justify-content: flex-end;
  flex-wrap: wrap;
}

.upload-empty {
  min-height: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
}

@media (max-width: 600px) {
  .upload-header {
    align-items: stretch;
    flex-direction: column;
  }

  .upload-select-actions {
    justify-content: stretch;
  }

  .upload-select-actions .q-btn {
    flex: 1;
  }

  .task-heading {
    align-items: flex-start;
  }

  .task-actions {
    justify-content: flex-start;
  }
}
</style>
