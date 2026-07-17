<template>
  <q-page class="share-management q-pa-md">
    <div class="share-header">
      <div>
        <div class="text-h5 text-weight-medium">分享文件夹</div>
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

      <div class="share-list-toolbar q-mb-sm">
        <div class="text-subtitle1 text-weight-medium">{{ currentFolderId ? '此文件夹中的分享' : '未分类分享' }}</div>
        <div class="row items-center q-gutter-sm">
          <q-checkbox
            v-if="currentShares.length"
            :model-value="allCurrentSharesSelected"
            label="全选"
            @update:model-value="toggleCurrentShares"
          />
          <q-btn
            v-if="selectedShareIds.length"
            color="primary"
            icon="drive_file_move"
            :label="`移动已选 (${selectedShareIds.length})`"
            @click="openMoveSelectedShares"
          />
        </div>
      </div>
      <div v-if="currentShares.length" class="share-list">
        <q-card v-for="share in currentShares" :key="share.shareId" flat bordered class="q-mb-sm">
          <q-card-section class="share-row">
            <q-checkbox v-model="selectedShareIds" :val="share.shareId" />
            <div class="share-main">
              <div class="text-weight-medium ellipsis" :title="share.key">{{ share.key }}</div>
              <div class="text-caption text-grey-7">
                {{ share.isExpired ? '已过期' : '有效' }} · 下载 {{ share.currentDownloads }}{{ share.maxDownloads ? `/${share.maxDownloads}` : '' }}
                <span v-if="share.hasPassword"> · 有密码</span>
              </div>
            </div>
            <q-btn flat dense icon="info" label="详情" @click="openShareDetails(share)" />
            <q-btn flat dense icon="content_copy" label="复制链接" @click="copyLink(share.shareUrl)" />
            <q-btn flat dense icon="drive_file_move" label="移动" @click="openMoveShare(share)" />
            <q-btn flat dense icon="delete" color="negative" label="删除" @click="deleteShare(share)" />
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
        <q-card-section class="text-h6">{{ movingShares.length > 1 ? '批量移动分享' : '移动分享' }}</q-card-section>
        <q-card-section>
          <div class="q-mb-md ellipsis" :title="movingShare?.key">
            {{ movingShares.length > 1 ? `已选择 ${movingShares.length} 个分享链接` : movingShare?.key }}
          </div>
          <q-select v-model="moveTarget" :options="folderOptions" emit-value map-options label="目标管理文件夹" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="取消" v-close-popup />
          <q-btn flat color="primary" label="移动" @click="moveShare" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="detailsDialog">
      <q-card style="min-width: 420px; max-width: 680px">
        <q-card-section class="row items-center">
          <div class="text-h6">分享详情</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-card-section v-if="detailsShare" class="q-gutter-y-sm">
          <div><span class="text-grey-7">文件：</span>{{ detailsShare.key }}</div>
          <div class="row items-center no-wrap">
            <span class="text-grey-7">链接：</span>
            <a :href="detailsShare.shareUrl" target="_blank" class="ellipsis col text-primary">
              {{ detailsShare.shareUrl }}
            </a>
            <q-btn flat round dense icon="content_copy" @click="copyLink(detailsShare.shareUrl)" />
          </div>
          <div><span class="text-grey-7">状态：</span>{{ detailsShare.isExpired ? '已过期' : '有效' }}</div>
          <div><span class="text-grey-7">密码：</span>{{ detailsShare.hasPassword ? '已设置' : '未设置' }}</div>
          <div>
            <span class="text-grey-7">下载次数：</span>
            {{ detailsShare.currentDownloads }}{{ detailsShare.maxDownloads ? `/${detailsShare.maxDownloads}` : '/不限' }}
          </div>
          <div><span class="text-grey-7">创建时间：</span>{{ formatDate(detailsShare.createdAt) }}</div>
          <div><span class="text-grey-7">到期时间：</span>{{ detailsShare.expiresAt ? formatDate(detailsShare.expiresAt) : '永久' }}</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="关闭" v-close-popup />
          <q-btn flat color="negative" icon="delete" label="删除分享" @click="deleteShare(detailsShare)" />
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
		movingShares: [],
		moveTarget: null,
		selectedShareIds: [],
		detailsDialog: false,
		detailsShare: null,
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
		allCurrentSharesSelected: function () {
			return (
				this.currentShares.length > 0 &&
				this.currentShares.every((share) =>
					this.selectedShareIds.includes(share.shareId),
				)
			);
		},
	},
	watch: {
		selectedBucket() {
			this.currentFolderId = null;
			this.selectedShareIds = [];
			this.load();
		},
		currentFolderId() {
			this.selectedShareIds = [];
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
				const response = await apiHandler.getShareOrganization(
					this.selectedBucket,
				);
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
			this.movingShares = [share];
			this.moveTarget = this.organization.assignments[share.shareId] || null;
			this.moveDialog = true;
		},
		toggleCurrentShares: function (selected) {
			const currentIds = this.currentShares.map((share) => share.shareId);
			if (selected) {
				this.selectedShareIds = [
					...new Set([...this.selectedShareIds, ...currentIds]),
				];
			} else {
				this.selectedShareIds = this.selectedShareIds.filter(
					(shareId) => !currentIds.includes(shareId),
				);
			}
		},
		openMoveSelectedShares: function () {
			this.movingShares = this.shares.filter((share) =>
				this.selectedShareIds.includes(share.shareId),
			);
			this.movingShare = this.movingShares[0] || null;
			this.moveTarget = this.currentFolderId;
			this.moveDialog = this.movingShares.length > 0;
		},
		moveShare: async function () {
			const sharesToMove = this.movingShares.length
				? this.movingShares
				: this.movingShare
					? [this.movingShare]
					: [];
			for (const share of sharesToMove) {
				if (this.moveTarget) {
					this.organization.assignments[share.shareId] = this.moveTarget;
				} else {
					delete this.organization.assignments[share.shareId];
				}
			}
			await this.saveOrganization();
			this.selectedShareIds = [];
			this.movingShares = [];
			this.movingShare = null;
			this.moveDialog = false;
		},
		copyLink: async function (url) {
			await navigator.clipboard.writeText(url);
			this.q.notify({ type: "positive", message: "分享链接已复制" });
		},
		openShareDetails: function (share) {
			this.detailsShare = share;
			this.detailsDialog = true;
		},
		deleteShare: function (share) {
			if (!share) return;
			this.q
				.dialog({
					title: "删除分享链接",
					message: `确定要删除“${share.key}”的这个分享链接吗？`,
					cancel: true,
					persistent: true,
				})
				.onOk(async () => {
					try {
						await apiHandler.deleteShareLink(
							this.selectedBucket,
							share.shareId,
						);
						this.detailsDialog = false;
						this.detailsShare = null;
						this.selectedShareIds = this.selectedShareIds.filter(
							(shareId) => shareId !== share.shareId,
						);
						await this.load();
						this.q.notify({ type: "positive", message: "分享链接已删除" });
					} catch (error) {
						this.q.notify({
							type: "negative",
							message: "删除分享链接失败",
							caption: error.response?.data?.message || error.message,
						});
					}
				});
		},
		formatDate: (timestamp) => new Date(timestamp).toLocaleString(),
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

.share-list-toolbar {
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
  .share-row,
  .share-list-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .share-row .q-btn {
    align-self: flex-start;
  }
}
</style>
