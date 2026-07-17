<template>
  <!-- Share Link Create Dialog -->
  <q-dialog v-model="createShareModal" @hide="resetCreate">
    <q-card class="share-dialog-card create-share-card">
      <q-card-section class="row items-center">
        <q-avatar icon="share" color="blue" text-color="white" />
        <span class="q-ml-sm text-h6">分享文件</span>
      </q-card-section>

      <q-card-section v-if="row">
        <div class="text-subtitle2 q-mb-sm">文件：<code>{{ row.name }}</code></div>
        
        <q-input
          v-model.number="expiresInHours"
          type="number"
          label="有效期（小时，0 表示永久）"
          hint="设为 0 可创建永久链接"
          min="0"
          class="q-mb-md"
        />

        <q-input
          v-model="password"
          type="password"
          label="密码（可选）"
          hint="留空表示不设置密码"
          class="q-mb-md"
        />

        <q-input
          v-model.number="maxDownloads"
          type="number"
          label="最大下载次数（可选）"
          hint="设为 0 表示不限次数"
          min="0"
          class="q-mb-md"
        />

        <div v-if="shareUrl" class="q-mt-md q-pa-md bg-grey-2 rounded-borders">
          <div class="text-subtitle2 q-mb-sm">分享链接已创建！</div>
          <div class="share-url-row">
            <q-input
              v-model="shareUrl"
              readonly
              dense
              outlined
              class="share-url-input"
            />
            <q-btn
              flat
              round
              dense
              icon="content_copy"
              color="primary"
              class="q-ml-sm"
              @click="copyToClipboard(shareUrl)"
            >
              <q-tooltip>复制到剪贴板</q-tooltip>
            </q-btn>
          </div>
          <div v-if="expiresAt" class="text-caption q-mt-sm">
            到期时间：{{ formatExpiry(expiresAt) }}
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="关闭" color="primary" v-close-popup />
        <q-btn
          v-if="!shareUrl"
          flat
          label="创建链接"
          color="blue"
          :loading="loading"
          @click="createShare"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <!-- Manage Shares Dialog -->
  <q-dialog v-model="manageSharesModal" @hide="resetManage">
    <q-card class="share-dialog-card manage-shares-card">
      <q-card-section class="row items-center no-wrap">
        <q-avatar icon="link" color="blue" text-color="white" />
        <span class="q-ml-sm text-h6">{{ managedFileKey ? '文件分享链接' : '管理分享链接' }}</span>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <div v-if="managedFileKey" class="managed-file text-subtitle2 q-mb-sm">
          文件：<code>{{ managedFileKey }}</code>
        </div>
        <q-table
          v-if="!q.screen.lt.sm"
          :rows="shares"
          :columns="shareColumns"
          row-key="shareId"
          :loading="loadingShares"
          flat
          :pagination="{ rowsPerPage: 10 }"
        >
          <template v-slot:no-data>
            <div class="full-width q-pa-md text-center text-grey">
              此文件暂无分享链接
            </div>
          </template>
          <template v-slot:body-cell-shareUrl="props">
            <q-td :props="props">
              <div class="flex items-center">
                <a :href="props.row.shareUrl" target="_blank" class="text-primary ellipsis" style="max-width: 200px;">
                  {{ props.row.shareUrl }}
                </a>
                <q-btn
                  flat
                  round
                  dense
                  size="sm"
                  icon="content_copy"
                  color="primary"
                  class="q-ml-xs"
                  @click="copyToClipboard(props.row.shareUrl)"
                >
                  <q-tooltip>复制</q-tooltip>
                </q-btn>
              </div>
            </q-td>
          </template>

          <template v-slot:body-cell-status="props">
            <q-td :props="props">
              <q-chip
                :color="props.row.isExpired ? 'red' : 'green'"
                text-color="white"
                size="sm"
              >
                {{ props.row.isExpired ? '已过期' : '有效' }}
              </q-chip>
              <q-chip v-if="props.row.hasPassword" color="orange" text-color="white" size="sm">
                <q-icon name="lock" size="xs" />
              </q-chip>
            </q-td>
          </template>

          <template v-slot:body-cell-downloads="props">
            <q-td :props="props">
              {{ props.row.currentDownloads }}
              <span v-if="props.row.maxDownloads"> / {{ props.row.maxDownloads }}</span>
              <span v-else> / ∞</span>
            </q-td>
          </template>

          <template v-slot:body-cell-actions="props">
            <q-td :props="props">
              <q-btn
                flat
                round
                dense
                icon="delete"
                color="red"
                @click="deleteShare(props.row)"
              >
                <q-tooltip>撤销</q-tooltip>
              </q-btn>
            </q-td>
          </template>
        </q-table>

        <div v-else class="mobile-share-list">
          <div v-if="loadingShares" class="q-pa-lg text-center">
            <q-spinner color="primary" size="32px" />
          </div>
          <div v-else-if="!shares.length" class="q-pa-md text-center text-grey">
            此文件暂无分享链接
          </div>
          <template v-else>
            <q-card v-for="share in shares" :key="share.shareId" flat bordered class="mobile-share-card">
              <q-card-section>
                <div class="mobile-share-heading">
                  <div class="mobile-share-key text-weight-medium">{{ share.key }}</div>
                  <q-btn flat round dense icon="delete" color="red" @click="deleteShare(share)">
                    <q-tooltip>撤销</q-tooltip>
                  </q-btn>
                </div>
                <div class="mobile-share-link-row q-mt-sm">
                  <a :href="share.shareUrl" target="_blank" class="mobile-share-link text-primary">
                    {{ share.shareUrl }}
                  </a>
                  <q-btn flat round dense size="sm" icon="content_copy" color="primary" @click="copyToClipboard(share.shareUrl)">
                    <q-tooltip>复制</q-tooltip>
                  </q-btn>
                </div>
                <div class="mobile-share-meta q-mt-md">
                  <div>
                    <span class="text-grey-7">状态</span>
                    <q-chip :color="share.isExpired ? 'red' : 'green'" text-color="white" size="sm">
                      {{ share.isExpired ? '已过期' : '有效' }}
                    </q-chip>
                    <q-icon v-if="share.hasPassword" name="lock" color="orange" size="18px">
                      <q-tooltip>有密码</q-tooltip>
                    </q-icon>
                  </div>
                  <div><span class="text-grey-7">下载</span> {{ formatDownloads(share) }}</div>
                  <div><span class="text-grey-7">创建</span> {{ formatCreatedAt(share.createdAt) }}</div>
                </div>
              </q-card-section>
            </q-card>
          </template>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script>
import { useQuasar } from "quasar";
import { apiHandler } from "src/appUtils";
import { defineComponent } from "vue";

export default defineComponent({
	name: "ShareFile",
	data: () => ({
		row: null,
		createShareModal: false,
		manageSharesModal: false,
		loading: false,
		loadingShares: false,
		expiresInHours: 0,
		password: "",
		maxDownloads: 0,
		shareUrl: "",
		shareId: "",
		expiresAt: null,
		shares: [],
		managedFileKey: null,
		shareColumns: [
			{
				name: "key",
				label: "文件",
				field: "key",
				align: "left",
				sortable: true,
			},
			{
				name: "shareUrl",
				label: "链接",
				field: "shareUrl",
				align: "left",
			},
			{
				name: "status",
				label: "状态",
				field: "isExpired",
				align: "center",
				sortable: true,
			},
			{
				name: "downloads",
				label: "下载次数",
				align: "center",
				sortable: true,
			},
			{
				name: "created",
				label: "创建时间",
				field: "createdAt",
				align: "left",
				sortable: true,
				format: (val) => new Date(val).toLocaleString(),
			},
			{
				name: "actions",
				label: "操作",
				align: "center",
			},
		],
	}),
	methods: {
		formatCreatedAt: (timestamp) => new Date(timestamp).toLocaleString(),
		formatDownloads: (share) =>
			`${share.currentDownloads} / ${share.maxDownloads || "∞"}`,
		openCreateShare: function (row) {
			this.createShareModal = true;
			this.row = row;
		},
		openManageShares: async function (row = null, shares = null) {
			this.managedFileKey = row?.key || null;
			this.manageSharesModal = true;
			if (shares) {
				this.shares = this.filterShares(shares);
			} else {
				await this.loadShares();
			}
		},
		filterShares: function (shares) {
			if (!this.managedFileKey) return shares;
			return shares.filter((share) => share.key === this.managedFileKey);
		},
		loadShares: async function () {
			this.loadingShares = true;
			try {
				const response = await apiHandler.listShares(this.selectedBucket);
				this.shares = this.filterShares(response.data.shares);
			} catch (error) {
				this.q.notify({
					type: "negative",
					message: "加载分享链接失败",
					caption: error.message,
				});
			} finally {
				this.loadingShares = false;
			}
		},
		createShare: async function () {
			this.loading = true;
			try {
				const options = {};

				if (this.expiresInHours > 0) {
					options.expiresIn = this.expiresInHours * 3600; // Convert hours to seconds
				}

				if (this.password) {
					options.password = this.password;
				}

				if (this.maxDownloads > 0) {
					options.maxDownloads = this.maxDownloads;
				}

				const response = await apiHandler.createShareLink(
					this.selectedBucket,
					this.row.key,
					options,
				);

				this.shareUrl = response.data.shareUrl;
				this.shareId = response.data.shareId;
				this.expiresAt = response.data.expiresAt;

				this.q.notify({
					type: "positive",
					message: "分享链接已创建！",
					icon: "share",
				});
				this.$emit("sharesChanged");
			} catch (error) {
				this.q.notify({
					type: "negative",
					message: "创建分享链接失败",
					caption: error.response?.data?.message || error.message,
				});
			} finally {
				this.loading = false;
			}
		},
		deleteShare: async function (share) {
			this.q
				.dialog({
					title: "撤销分享链接",
					message: `确定要撤销“${share.key}”的分享链接吗？`,
					cancel: true,
					persistent: true,
				})
				.onOk(async () => {
					try {
						await apiHandler.deleteShareLink(
							this.selectedBucket,
							share.shareId,
						);
						this.q.notify({
							type: "positive",
							message: "分享链接已撤销",
						});
						await this.loadShares();
						this.$emit("sharesChanged");
					} catch (error) {
						this.q.notify({
							type: "negative",
							message: "撤销分享链接失败",
							caption: error.message,
						});
					}
				});
		},
		copyToClipboard: function (text) {
			navigator.clipboard.writeText(text);
			this.q.notify({
				type: "positive",
				message: "已复制到剪贴板！",
				icon: "content_copy",
				timeout: 1000,
			});
		},
		formatExpiry: (timestamp) => new Date(timestamp).toLocaleString(),
		resetCreate: function () {
			this.createShareModal = false;
			this.loading = false;
			this.expiresInHours = 0;
			this.password = "";
			this.maxDownloads = 0;
			this.shareUrl = "";
			this.shareId = "";
			this.expiresAt = null;
			this.row = null;
		},
		resetManage: function () {
			this.manageSharesModal = false;
			this.loadingShares = false;
			this.shares = [];
			this.managedFileKey = null;
		},
	},
	computed: {
		selectedBucket: function () {
			return this.$route.params.bucket;
		},
	},
	setup() {
		return {
			q: useQuasar(),
		};
	},
});
</script>

<style scoped>
.share-dialog-card {
  width: min(100%, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
}

.create-share-card {
  width: min(500px, calc(100vw - 32px));
}

.manage-shares-card {
  width: min(960px, calc(100vw - 32px));
  max-width: 960px;
}

code {
  background-color: #e9e9e9;
  padding: 0.25em;
}

.managed-file,
.managed-file code {
  overflow-wrap: anywhere;
}

.share-url-row,
.mobile-share-heading,
.mobile-share-link-row {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 8px;
}

.share-url-input {
  min-width: 0;
  flex: 1;
}

.mobile-share-list {
  display: grid;
  gap: 10px;
}

.mobile-share-card {
  min-width: 0;
}

.mobile-share-heading {
  align-items: flex-start;
  justify-content: space-between;
}

.mobile-share-key,
.mobile-share-link {
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.mobile-share-link {
  flex: 1;
}

.mobile-share-meta {
  display: grid;
  gap: 8px;
}

.mobile-share-meta > div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mobile-share-meta .text-grey-7 {
  flex: 0 0 36px;
}

.ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 599px) {
  .share-dialog-card {
    width: calc(100vw - 16px);
    max-height: calc(100vh - 16px);
  }

  .share-dialog-card :deep(.q-card__section) {
    padding: 14px;
  }

  .share-url-row {
    align-items: stretch;
  }
}
</style>
