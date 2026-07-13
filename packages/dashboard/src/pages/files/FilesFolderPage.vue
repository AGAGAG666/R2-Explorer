<template>
  <q-page class="">
    <div class="q-pa-md" ref="pageContainer" @scroll="handleScroll" style="height: 100vh; overflow-y: auto;">
      <div class="file-toolbar flex items-center q-mb-sm">
        <q-breadcrumbs class="col">
          <q-breadcrumbs-el style="cursor: pointer" v-for="obj in breadcrumbs" :key="obj.name" :label="obj.name" @click="breadcrumbsClick(obj)" />
        </q-breadcrumbs>
        <q-input
          dense
          outlined
          v-model="searchQuery"
          placeholder="按前缀搜索..."
          clearable
          class="q-mr-sm"
          style="width: 200px"
          @keyup.enter="handleSearch"
          @clear="clearSearch"
        >
          <template v-slot:prepend>
            <q-icon name="search" class="cursor-pointer" @click="handleSearch" />
          </template>
        </q-input>
        <q-btn
          flat
          dense
          icon="link"
          color="primary"
          label="管理分享"
          @click="openShareManagement"
        >
          <q-tooltip>查看和管理所有分享链接</q-tooltip>
        </q-btn>
        <q-separator vertical inset class="q-mx-sm" />
        <q-btn-toggle
          v-model="viewMode"
          flat
          dense
          toggle-color="primary"
          :options="[
            { value: 'list', slot: 'list' },
            { value: 'grid', slot: 'grid' }
          ]"
          @update:model-value="saveViewMode"
        >
          <template v-slot:list>
            <q-icon name="view_list" />
            <q-tooltip>列表视图</q-tooltip>
          </template>
          <template v-slot:grid>
            <q-icon name="grid_view" />
            <q-tooltip>图标视图</q-tooltip>
          </template>
        </q-btn-toggle>
      </div>

      <drag-and-drop ref="uploader">

        <q-table
          v-show="viewMode === 'list'"
          ref="table"
          :rows="rows"
          :columns="columns"
          row-key="name"
          :loading="loading"
          :hide-pagination="true"
          :rows-per-page-options="[0]"
          column-sort-order="da"
          :flat="true"
          table-class="file-list"
          @row-dblclick="openRowClick"
          @row-click="openRowDlbClick"
        >

          <template v-slot:loading>
              <div class="full-width q-my-lg">
                  <h6 class="flex items-center justify-center">
                      <q-spinner
                              color="primary"
                              size="xl"
                      />
                  </h6>
              </div>
          </template>

          <template v-slot:no-data>
            <div class="full-width q-my-lg" v-if="!loading">
              <h6 class="flex items-center justify-center"><q-icon name="folder" color="orange" size="lg" />此文件夹为空</h6>
            </div>
          </template>

          <template v-slot:body-cell-name="prop">
            <td class="flex" style="align-items: center">
              <q-icon :name="prop.row.icon" size="sm" :color="prop.row.color" class="q-mr-xs" />
              {{prop.row.name}}
            </td>
          </template>

          <template v-slot:body-cell="prop">
            <q-td :props="prop">
              {{prop.value}}
            </q-td>
            <q-menu
              touch-position
              context-menu
            >
              <FileContextMenu :prop="prop" @openObject="openObject" @deleteObject="$refs.options.deleteObject" @renameObject="$refs.options.renameObject" @duplicateObject="$refs.options.duplicateObject" @updateMetadataObject="$refs.options.updateMetadataObject" @createShareLink="$refs.shareFile.openCreateShare" />
            </q-menu>
          </template>

          <template v-slot:body-cell-options="prop">
            <td class="text-right">
              <q-btn round flat icon="more_vert" size="sm">
                <q-menu>
                  <FileContextMenu :prop="prop" @openObject="openObject" @deleteObject="$refs.options.deleteObject" @renameObject="$refs.options.renameObject" @duplicateObject="$refs.options.duplicateObject" @updateMetadataObject="$refs.options.updateMetadataObject" @createShareLink="$refs.shareFile.openCreateShare" />
                </q-menu>
              </q-btn>
            </td>
          </template>
        </q-table>

        <div v-if="viewMode === 'grid' && rows.length > 0" class="file-grid">
          <div
            v-for="row in gridRows"
            :key="row.key"
            class="file-grid-item"
            tabindex="0"
            @click="openRowDlbClick($event, row)"
            @dblclick="openRowClick($event, row)"
            @keyup.enter="openObject(row)"
          >
            <FileThumbnail
              v-if="isImage(row)"
              :bucket="selectedBucket"
              :file-key="row.key"
              :name="row.name"
              :icon="row.icon"
              :color="row.color"
              :fingerprint="row.etag || row.uploaded || String(row.sizeRaw)"
            />
            <q-icon v-else :name="row.type === 'folder' ? 'folder' : row.icon" :color="row.type === 'folder' ? 'amber-8' : row.color" class="file-grid-icon" />
            <div class="file-grid-name" :title="row.name">{{ row.name }}</div>
            <div class="file-grid-meta">{{ row.type === 'folder' ? '文件夹' : row.size }}</div>
            <q-btn flat round dense icon="more_vert" size="sm" class="file-grid-options" @click.stop>
              <q-menu>
                <FileContextMenu :prop="{ row }" @openObject="openObject" @deleteObject="$refs.options.deleteObject" @renameObject="$refs.options.renameObject" @duplicateObject="$refs.options.duplicateObject" @updateMetadataObject="$refs.options.updateMetadataObject" @createShareLink="$refs.shareFile.openCreateShare" />
              </q-menu>
            </q-btn>
            <q-menu touch-position context-menu>
              <FileContextMenu :prop="{ row }" @openObject="openObject" @deleteObject="$refs.options.deleteObject" @renameObject="$refs.options.renameObject" @duplicateObject="$refs.options.duplicateObject" @updateMetadataObject="$refs.options.updateMetadataObject" @createShareLink="$refs.shareFile.openCreateShare" />
            </q-menu>
          </div>
        </div>

        <div v-if="viewMode === 'grid' && rows.length === 0 && !loading" class="file-grid-empty">
          <q-icon name="folder" color="amber-8" size="lg" />
          此文件夹为空
        </div>

        <div v-if="loadingMore" class="q-pa-md text-center">
          <q-spinner color="primary" size="md" />
          <div class="q-mt-sm text-grey">正在加载更多文件...</div>
        </div>

        <div v-if="!hasMore && rows.length > 0 && !loading" class="q-pa-md text-center text-grey">
          没有更多文件
        </div>

      </drag-and-drop>

    </div>
  </q-page>

  <file-preview ref="preview"/>
  <file-options ref="options" />
  <share-file ref="shareFile" />
</template>

<script>
import FileOptions from "components/files/FileOptions.vue";
import ShareFile from "components/files/ShareFile.vue";
import FileThumbnail from "components/files/FileThumbnail.vue";
import FilePreview from "components/preview/FilePreview.vue";
import DragAndDrop from "components/utils/DragAndDrop.vue";
import FileContextMenu from "pages/files/FileContextMenu.vue";
import { useQuasar } from "quasar";
import { useMainStore } from "stores/main-store";
import { defineComponent } from "vue";
import { ROOT_FOLDER, apiHandler, decode, encode } from "../../appUtils";

export default defineComponent({
	name: "FilesIndexPage",
	components: {
		FileContextMenu,
		FileOptions,
		FileThumbnail,
		DragAndDrop,
		FilePreview,
		ShareFile,
	},
	data: () => ({
		loading: false,
		loadingMore: false,
		rows: [],
		viewMode: localStorage.getItem("r2_explorer_view_mode") || "list",
		cursor: null,
		hasMore: true,
		searchQuery: "",
		columns: [
			{
				name: "name",
				required: true,
				label: "名称",
				align: "left",
				field: "name",
				sortable: true,
				sort: (a, b, rowA, rowB) => {
					if (rowA.type === "folder") {
						if (rowB.type === "folder") {
							// both are folders
							return a.localeCompare(b);
						}
						// only first is folder
						return 1;
					}
					if (rowB.type === "folder") {
						// only second is folder
						return -1;
					}
					// none is folder
					return a.localeCompare(b);
				},
			},
			{
				name: "lastModified",
				required: true,
				label: "最后修改时间",
				align: "left",
				field: "lastModified",
				sortable: true,
				sort: (a, b, rowA, rowB) => {
					return rowA.timestamp - rowB.timestamp;
				},
			},
			{
				name: "size",
				required: true,
				label: "大小",
				align: "left",
				field: "size",
				sortable: true,
				sort: (a, b, rowA, rowB) => {
					return rowA.sizeRaw - rowB.sizeRaw;
				},
			},
			{
				name: "options",
				label: "",
				sortable: false,
			},
		],
	}),
	computed: {
		gridRows: function () {
			return [...this.rows].sort((a, b) => {
				if (a.type !== b.type) {
					return a.type === "folder" ? -1 : 1;
				}
				return a.name.localeCompare(b.name, "zh-CN", {
					numeric: true,
					sensitivity: "base",
				});
			});
		},
		selectedBucket: function () {
			return this.$route.params.bucket;
		},
		selectedFolder: function () {
			if (
				this.$route.params.folder &&
				this.$route.params.folder !== ROOT_FOLDER
			) {
				return decode(this.$route.params.folder);
			}
			return "";
		},
		searchPrefix: function () {
			return this.selectedFolder + this.searchQuery;
		},
		breadcrumbs: function () {
			if (this.selectedFolder) {
				return [
					{
						name: this.selectedBucket,
						path: "/",
					},
					...this.selectedFolder
						.split("/")
						.filter((obj) => obj !== "")
						.map((item, index, arr) => {
							return {
								name: item,
								path: `${arr
									.slice(0, index + 1)
									.join("/")
									.replace("Home/", "")}/`,
							};
						}),
				];
			}
			return [
				{
					name: this.selectedBucket,
					path: "/",
				},
			];
		},
	},
	watch: {
		selectedBucket(newVal) {
			this.searchQuery = "";
			this.resetAndFetchFiles();
		},
		selectedFolder(newVal) {
			this.searchQuery = "";
			this.resetAndFetchFiles();
		},
	},
	methods: {
		openShareManagement: function () {
			this.$router.push({
				name: "shares-home",
				params: { bucket: this.selectedBucket },
			});
		},
		isImage: function (row) {
			return (
				row.type === "file" &&
				/\.(png|jpe?g|webp|avif)$/i.test(row.name)
			);
		},
		saveViewMode: function (mode) {
			localStorage.setItem("r2_explorer_view_mode", mode);
		},
		openRowClick: function (evt, row, index) {
			evt.preventDefault();
			this.openObject(row);
		},
		openRowDlbClick: function (evt, row, index) {
			evt.preventDefault();
			this.$bus.emit("openFileDetails", row);
		},
		breadcrumbsClick: function (obj) {
			this.$router.push({
				name: "files-folder",
				params: { bucket: this.selectedBucket, folder: encode(obj.path) },
			});
		},
		rowClick: function (evt, row) {
			if (row.type === "folder") {
				this.$router.push({
					name: "files-folder",
					params: { bucket: this.selectedBucket, folder: encode(row.key) },
				});
			} else {
				// console.log(row)
				this.$refs.preview.openFile(row);
			}
		},
		openObject: function (row) {
			if (row.type === "folder") {
				this.$router.push({
					name: "files-folder",
					params: { bucket: this.selectedBucket, folder: encode(row.key) },
				});
			} else {
				// console.log(row)
				this.$refs.preview.openFile(row);
			}
		},
		renameObject: function (row) {
			if (row.type === "folder") {
				this.$router.push({
					name: "files-folder",
					params: { bucket: this.selectedBucket, folder: encode(row.key) },
				});
			} else {
				// console.log(row)
				this.$refs.preview.openFile(row);
			}
		},
		resetAndFetchFiles: async function () {
			this.rows = [];
			this.cursor = null;
			this.hasMore = true;
			await this.fetchFiles();
		},
		handleSearch: function () {
			this.resetAndFetchFiles();
		},
		clearSearch: function () {
			this.searchQuery = "";
			this.resetAndFetchFiles();
		},
		fetchFiles: async function () {
			if (this.loading || this.loadingMore || !this.hasMore) {
				return;
			}

			this.loading = true;

			const result = await apiHandler.fetchFilePage(
				this.selectedBucket,
				this.searchPrefix,
				"/",
				this.cursor,
				this.selectedFolder,
			);

			this.rows = result.files;
			this.cursor = result.cursor;
			this.hasMore = result.truncated;
			this.loading = false;
		},
		loadMoreFiles: async function () {
			if (this.loadingMore || !this.hasMore || this.loading) {
				return;
			}

			this.loadingMore = true;

			const result = await apiHandler.fetchFilePage(
				this.selectedBucket,
				this.searchPrefix,
				"/",
				this.cursor,
				this.selectedFolder,
			);

			this.rows = [...this.rows, ...result.files];
			this.cursor = result.cursor;
			this.hasMore = result.truncated;
			this.loadingMore = false;
		},
		handleScroll: function (event) {
			const container = this.$refs.pageContainer;
			if (!container || this.loadingMore || !this.hasMore) {
				return;
			}

			const scrollTop = container.scrollTop;
			const scrollHeight = container.scrollHeight;
			const clientHeight = container.clientHeight;

			// Load more when user is within 200px of the bottom
			if (scrollTop + clientHeight >= scrollHeight - 200) {
				this.loadMoreFiles();
			}
		},
		openPreviewFromKey: async function () {
			let key = `${decode(this.$route.params.file)}`;
			if (this.selectedFolder && this.selectedFolder !== ROOT_FOLDER) {
				key = `${this.selectedFolder}${decode(this.$route.params.file)}`;
			}

			const file = await apiHandler.headFile(this.selectedBucket, key);
			this.$refs.preview.openFile(file);
		},
	},
	created() {
		this.resetAndFetchFiles();
	},
	mounted() {
		this.$refs.table?.sort("name");

		this.$bus.on("fetchFiles", this.resetAndFetchFiles);

		if (this.$route.params.file) {
			this.openPreviewFromKey();
		}
	},
	beforeUnmount() {
		this.$bus.off("fetchFiles");
	},
	setup() {
		return {
			mainStore: useMainStore(),
			q: useQuasar(),
		};
	},
});
</script>

<style>
.file-list table , .file-list tbody , .file-list thead {
  width: 100%;
  display: block;
}

.file-toolbar {
  min-height: 40px;
}


.file-list td:first-of-type, .file-list th:first-of-type {
  overflow-x: hidden;
  white-space: nowrap;
  flex-grow: 1;
  text-overflow: ellipsis;
}

.file-list tr {
  display: flex;
  width: 100%;
  justify-content: center;

}

.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: 8px;
  padding: 8px 0 24px;
}

.file-grid-item {
  position: relative;
  min-width: 0;
  height: 132px;
  padding: 14px 10px 10px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: #fff;
  cursor: default;
  text-align: center;
  user-select: none;
}

.file-grid-item:hover,
.file-grid-item:focus-visible {
  border-color: #90caf9;
  background: #eaf4fc;
  outline: none;
}

.file-grid-item:active {
  background: #dceefa;
}

.file-grid-icon {
  display: block;
  margin: 0 auto 8px;
  font-size: 52px;
}

.file-grid-name {
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-height: 18px;
  overflow-wrap: anywhere;
}

.file-grid-meta {
  margin-top: 3px;
  color: #757575;
  font-size: 11px;
  line-height: 16px;
}

.file-grid-options {
  position: absolute;
  top: 2px;
  right: 2px;
  visibility: hidden;
}

.file-grid-item:hover .file-grid-options,
.file-grid-item:focus-within .file-grid-options {
  visibility: visible;
}

.file-grid-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  color: #616161;
  font-size: 16px;
}

@media (max-width: 600px) {
  .file-toolbar {
    flex-wrap: wrap;
    gap: 4px 0;
  }

  .file-toolbar .q-breadcrumbs {
    flex-basis: 100%;
  }

  .file-toolbar .q-input {
    flex: 1 1 140px;
    width: auto !important;
    min-width: 140px;
  }

  .file-grid {
    grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  }

  .file-grid-item {
    height: 122px;
    padding-right: 6px;
    padding-left: 6px;
  }

  .file-grid-options {
    visibility: visible;
  }
}
</style>
