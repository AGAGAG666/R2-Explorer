<template>
  <q-list style="min-width: 100px">
    <q-item clickable v-close-popup @click="openObject">
      <q-item-section>{{ $t('open') }}</q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="downloadObject" v-if="prop.row.type === 'file'">
      <q-item-section>{{ $t('download') }}</q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="renameObject" v-if="prop.row.type === 'file'">
      <q-item-section>{{ $t('rename') }}</q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="duplicateObject">
      <q-item-section>{{ $t('duplicate') }}</q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="updateMetadataObject" v-if="prop.row.type === 'file'">
      <q-item-section>{{ $t('updateMetadata') }}</q-item-section>
    </q-item>
    <q-separator />
    <q-item clickable v-close-popup @click="createShareLink" v-if="prop.row.type === 'file'">
      <q-item-section>
        <q-item-label>{{ $t('createShareLink') }}</q-item-label>
        <q-item-label caption>{{ $t('shareLinkHint') }}</q-item-label>
      </q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="copyInternalLink">
      <q-item-section>
        <q-item-label>{{ $t('copyInternalLink') }}</q-item-label>
        <q-item-label caption>{{ $t('internalLinkHint') }}</q-item-label>
      </q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="copyPublicUrl" v-if="prop.row.type === 'file' && bucketPublicUrl">
      <q-item-section>
        <q-item-label>{{ $t('copyPublicUrl') }}</q-item-label>
        <q-item-label caption>{{ $t('publicUrlHint') }}</q-item-label>
      </q-item-section>
    </q-item>
    <q-separator />
    <q-item clickable v-close-popup @click="deleteObject">
      <q-item-section>{{ $t('delete') }}</q-item-section>
    </q-item>
  </q-list>
</template>
<script>
import { useQuasar } from "quasar";
import { ROOT_FOLDER, apiHandler, decode, encode } from "src/appUtils";
import { useMainStore } from "stores/main-store";

export default {
	name: "FileContextMenu",
	props: {
		prop: {},
	},
	computed: {
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
		bucketPublicUrl: function () {
			const bucket = this.mainStore.buckets.find(
				(b) => b.name === this.selectedBucket,
			);
			return bucket?.publicUrl || null;
		},
	},
	methods: {
		renameObject: function () {
			this.$emit("renameObject", this.prop.row);
		},
		duplicateObject: function () {
			this.$emit("duplicateObject", this.prop.row);
		},
		updateMetadataObject: function () {
			this.$emit("updateMetadataObject", this.prop.row);
		},
		openObject: function () {
			this.$emit("openObject", this.prop.row);
		},
		deleteObject: function () {
			this.$emit("deleteObject", this.prop.row);
		},
		createShareLink: function () {
			this.$emit("createShareLink", this.prop.row);
		},
		copyInternalLink: async function () {
			let url;
			if (this.prop.row.type === "folder") {
				url =
					window.location.origin +
					this.$router.resolve({
						name: "files-folder",
						params: {
							bucket: this.selectedBucket,
							folder: encode(this.prop.row.key),
						},
					}).href;
			} else {
				url =
					window.location.origin +
					this.$router.resolve({
						name: "files-file",
						params: {
							bucket: this.selectedBucket,
							folder: this.selectedFolder
								? encode(this.selectedFolder)
								: ROOT_FOLDER,
							file: this.prop.row.nameHash,
						},
					}).href;
			}

			try {
				await navigator.clipboard.writeText(url);
				this.q.notify({
					message: this.$t("internalLinkCopied"),
					timeout: 5000,
					type: "positive",
				});
			} catch (err) {
				this.q.notify({
					message: this.$t("copyFailed", { error: err }),
					timeout: 5000,
					type: "negative",
				});
			}
		},
		copyPublicUrl: async function () {
			const baseUrl = this.bucketPublicUrl.replace(/\/+$/, "");
			const url = `${baseUrl}/${this.prop.row.key}`;

			try {
				await navigator.clipboard.writeText(url);
				this.q.notify({
					message: this.$t("publicUrlCopied"),
					timeout: 5000,
					type: "positive",
				});
			} catch (err) {
				this.q.notify({
					message: this.$t("copyFailed", { error: err }),
					timeout: 5000,
					type: "negative",
				});
			}
		},
		downloadObject: async function () {
			try {
				const response = await apiHandler.downloadFile(
					this.selectedBucket,
					this.prop.row.key,
					{ downloadType: "objectUrl" },
				);

				const blob = new Blob([response.data]);
				const url = URL.createObjectURL(blob);
				const link = document.createElement("a");
				link.download = this.prop.row.name;
				link.href = url;
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
				URL.revokeObjectURL(url);
			} catch (err) {
				this.q.notify({
					message: this.$t("downloadFailed", { error: err.message || err }),
					timeout: 5000,
					type: "negative",
				});
			}
		},
	},
	setup() {
		return {
			mainStore: useMainStore(),
			q: useQuasar(),
		};
	},
};
</script>
