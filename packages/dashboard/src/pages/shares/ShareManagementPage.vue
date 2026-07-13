<template>
  <q-page class="share-management q-pa-md">
    <div class="share-header">
      <div>
        <div class="text-h5 text-weight-medium">分享管理</div>
        <div class="text-grey-7 q-mt-xs">分类仅用于管理，不会改变分享链接或原文件。</div>
      </div>
      <q-btn color="primary" icon="create_new_folder" label="新建管理文件夹" @click="openCreateFolder" />
    </div>

    <q-breadcrumbs class="q-my-md">
      <q-breadcrumbs-el label="未分类" icon="home" class="cursor-pointer" @click="currentFolderId = null" />
      <q-breadcrumbs-el
        v-for="folder in breadcrumbs"
        :key="folder.id"
        :label="folder.name"
        class="cursor-pointer"
        @click="currentFolderId = folder.id"
      />
    </q-breadcrumbs>

    <q-inner-loading :showing="loading" label="正在加载分享..." />

    <template v-if="!loading">
      <div v-if="childFolders.length" class="share-folder-grid q-mb-lg">
        <q-card v-for="folder in childFolders" :key="folder.id" flat bordered class="share-folder-card">
          <q-card-section class="row items-center no-wrap cursor-pointer" @dblclick="currentFolderId = folder.id">
            <q-icon name="folder" color="amber-8" size="42px" class="q-mr-sm" />
            <div class="ellipsis col" @click="currentFolderId = folder.id">{{ folder.name }}</div>
            <q-btn flat round dense icon="more_vert" @click.stop>
              <q-menu>
                <q-list style="min-width: 130px">
                  <q-item clickable v-close-popup @click="currentFolderId = folder.id">
                    <q-item-section>打开</q-item-section>
                  </q-item>
                  <q-item clickable v-close-popup @click="deleteFolder(folder)">
                    <q-item-section class="text-negative">删除空文件夹</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </q-card-section>
        </q-card>
      </div>

      <div class="text-subtitle1 text-weight-medium q-mb-sm">{{ currentFolderId ? '此文件夹中的分享' : '未分类分享' }}</div>
      <div v-if="currentShares.length" class="share-list">
        <q-card v-for="share in currentShares" :key="share.shareId" flat bordered class="q-mb-sm">
          <q-card-section class="share-row">
            <div class="share-main">
              <div class="text-weight-medium ellipsis" :title="share.key">{{ share.key }}</div>
              <div class="text-caption text-grey-7">
                {{ share.isExpired ? '已过期' : '有效' }} · 下载 {{ share.currentDownloads }}{{ share.maxDownloads ? `/${share.maxDownloads}` : '' }}
                <span v-if="share.hasPassword"> · 有密码</span>
              </div>
            </div>
            <q-btn flat dense icon="content_copy" label="复制链接" @click="copyLink(share.shareUrl)" />
            <q-btn flat dense icon="drive_file_move" label="移动" @click="openMoveShare(share)" />
          </q-card-section>
        </q-card>
      </div>
      <div v-else class="share-empty text-grey-7">
        <q-icon name="link_off" size="42px" />
        <div>此处没有分享</div>
      </div>
    </template>

    <q-dialog v-model="createFolderDialog">
      <q-card style="min-width: 320px">
        <q-card-section class="text-h6">新建管理文件夹</q-card-section>
        <q-card-section>
          <q-input v-model.trim="newFolderName" autofocus label="文件夹名称" @keyup.enter="createFolder" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="取消" v-close-popup />
          <q-btn flat color="primary" label="创建" :disable="!newFolderName" @click="createFolder" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="moveDialog">
      <q-card style="min-width: 360px">
        <q-card-section class="text-h6">移动分享</q-card-section>
        <q-card-section>
          <div class="q-mb-md ellipsis" :title="movingShare?.key">{{ movingShare?.key }}</div>
          <q-select v-model="moveTarget" :options="folderOptions" emit-value map-options label="目标管理文件夹" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="取消" v-close-popup />
          <q-btn flat color="primary" label="移动" @click="moveShare" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script>
import { useQuasar } from "quasar";
import { apiHandler } from "src/appUtils";
import { defineComponent } from "vue";

export default defineComponent({
	name: "ShareManagementPage",
	data: () => ({
		loading: false,
		shares: [],
		organization: { version: 1, folders: [], assignments: {} },
		currentFolderId: null,
		createFolderDialog: false,
		newFolderName: "",
		moveDialog: false,
		movingShare: null,
		moveTarget: null,
	}),
	computed: {
		selectedBucket: function () {
			return this.$route.params.bucket;
		},
		childFolders: function () {
			return this.organization.folders
				.filter((folder) => folder.parentId === this.currentFolderId)
				.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
		},
		currentShares: function () {
			return this.shares.filter((share) => {
				const folderId = this.organization.assignments[share.shareId] || null;
				return folderId === this.currentFolderId;
			});
		},
		breadcrumbs: function () {
			const result = [];
			let folder = this.organization.folders.find(
				(item) => item.id === this.currentFolderId,
			);
			while (folder) {
				result.unshift(folder);
				folder = this.organization.folders.find(
					(item) => item.id === folder.parentId,
				);
			}
			return result;
		},
		folderOptions: function () {
			const folders = new Map(
				this.organization.folders.map((folder) => [folder.id, folder]),
			);
			const pathFor = (folder) => {
				const parts = [folder.name];
				let parent = folders.get(folder.parentId);
				while (parent) {
					parts.unshift(parent.name);
					parent = folders.get(parent.parentId);
				}
				return parts.join(" / ");
			};
			return [
				{ label: "未分类", value: null },
				...this.organization.folders
					.map((folder) => ({ label: pathFor(folder), value: folder.id }))
					.sort((a, b) => a.label.localeCompare(b.label, "zh-CN")),
			];
		},
	},
	watch: {
		selectedBucket() {
			this.currentFolderId = null;
			this.load();
		},
	},
	methods: {
		load: async function () {
			this.loading = true;
			try {
				const [shares, organization] = await Promise.all([
					apiHandler.listShares(this.selectedBucket),
					apiHandler.getShareOrganization(this.selectedBucket),
				]);
				this.shares = shares.data.shares;
				this.organization = organization.data;
			} finally {
				this.loading = false;
			}
		},
		saveOrganization: async function () {
			try {
				await apiHandler.updateShareOrganization(
					this.selectedBucket,
					this.organization,
				);
			} catch (error) {
				const response = await apiHandler.getShareOrganization(this.selectedBucket);
				this.organization = response.data;
				this.q.notify({ type: "negative", message: "保存分享分类失败" });
				throw error;
			}
		},
		openCreateFolder: function () {
			this.newFolderName = "";
			this.createFolderDialog = true;
		},
		createFolder: async function () {
			if (!this.newFolderName) return;
			this.organization.folders.push({
				id: crypto.randomUUID(),
				name: this.newFolderName,
				parentId: this.currentFolderId,
			});
			await this.saveOrganization();
			this.createFolderDialog = false;
		},
		deleteFolder: async function (folder) {
			const hasChildren = this.organization.folders.some(
				(item) => item.parentId === folder.id,
			);
			const hasShares = Object.values(this.organization.assignments).includes(
				folder.id,
			);
			if (hasChildren || hasShares) {
				this.q.notify({ type: "negative", message: "只能删除空的管理文件夹" });
				return;
			}
			this.organization.folders = this.organization.folders.filter(
				(item) => item.id !== folder.id,
			);
			await this.saveOrganization();
		},
		openMoveShare: function (share) {
			this.movingShare = share;
			this.moveTarget = this.organization.assignments[share.shareId] || null;
			this.moveDialog = true;
		},
		moveShare: async function () {
			if (this.moveTarget) {
				this.organization.assignments[this.movingShare.shareId] = this.moveTarget;
			} else {
				delete this.organization.assignments[this.movingShare.shareId];
			}
			await this.saveOrganization();
			this.moveDialog = false;
		},
		copyLink: async function (url) {
			await navigator.clipboard.writeText(url);
			this.q.notify({ type: "positive", message: "分享链接已复制" });
		},
	},
	created() {
		this.load();
	},
	setup() {
		return { q: useQuasar() };
	},
});
</script>

<style scoped>
.share-header,
.share-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.share-folder-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.share-folder-card:hover {
  border-color: #90caf9;
  background: #f5faff;
}

.share-main {
  min-width: 0;
  flex: 1;
}

.share-empty {
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

@media (max-width: 600px) {
  .share-header,
  .share-row {
    align-items: stretch;
    flex-direction: column;
  }

  .share-row .q-btn {
    align-self: flex-start;
  }
}
</style>
