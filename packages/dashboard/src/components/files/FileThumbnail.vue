<template>
  <div ref="container" class="file-thumbnail">
    <img
      v-if="source && !failed"
      :src="source"
      :alt="name"
      class="file-thumbnail-image"
      @error="handleError"
    />
    <q-spinner v-else-if="loading" color="primary" size="28px" />
    <q-icon v-else :name="icon" :color="color" class="file-thumbnail-fallback" />
  </div>
</template>

<script>
import { apiHandler } from "src/appUtils";
import {
	cacheThumbnail,
	enqueueThumbnail,
	getCachedThumbnail,
} from "./thumbnailQueue";

export default {
	name: "FileThumbnail",
	props: {
		bucket: {
			type: String,
			required: true,
		},
		fileKey: {
			type: String,
			required: true,
		},
		name: {
			type: String,
			required: true,
		},
		icon: {
			type: String,
			default: "article",
		},
		color: {
			type: String,
			default: "grey",
		},
		fingerprint: {
			type: String,
			default: "",
		},
	},
	data: () => ({
		source: null,
		loading: false,
		failed: false,
		disposed: false,
		job: null,
	}),
	computed: {
		cacheKey: function () {
			return `${this.bucket}:${this.fileKey}:${this.fingerprint}`;
		},
	},
	methods: {
		load: async function () {
			if (this.job || this.source || this.failed) return;

			this.job = enqueueThumbnail(async () => {
				if (this.disposed) return null;
				this.loading = true;

				const cached = await getCachedThumbnail(this.cacheKey);
				if (cached) return cached;

				const response = await apiHandler.downloadFile(
					this.bucket,
					this.fileKey,
					{
						downloadType: "objectUrl",
					},
				);
				const thumbnail = await this.createThumbnail(new Blob([response.data]));
				await cacheThumbnail(this.cacheKey, thumbnail);
				return thumbnail;
			});

			try {
				const thumbnail = await this.job.promise;
				if (!thumbnail) return;

				const source = URL.createObjectURL(thumbnail);
				if (this.disposed) {
					URL.revokeObjectURL(source);
				} else {
					this.source = source;
				}
			} catch (error) {
				this.failed = true;
			} finally {
				this.loading = false;
			}
		},
		createThumbnail: async (original) => {
			if (typeof createImageBitmap === "undefined") return original;

			const bitmap = await createImageBitmap(original);
			const scale = Math.min(1, 240 / bitmap.width, 160 / bitmap.height);
			const canvas = document.createElement("canvas");
			canvas.width = Math.max(1, Math.round(bitmap.width * scale));
			canvas.height = Math.max(1, Math.round(bitmap.height * scale));
			canvas
				.getContext("2d")
				.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
			bitmap.close();

			return await new Promise((resolve) => {
				canvas.toBlob((blob) => resolve(blob || original), "image/webp", 0.78);
			});
		},
		handleError: function () {
			this.failed = true;
			this.releaseSource();
		},
		releaseSource: function () {
			if (this.source) {
				URL.revokeObjectURL(this.source);
				this.source = null;
			}
		},
	},
	mounted() {
		this.load();
	},
	beforeUnmount() {
		this.disposed = true;
		this.job?.cancel();
		this.releaseSource();
	},
};
</script>

<style scoped>
.file-thumbnail {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 62px;
  margin-bottom: 5px;
}

.file-thumbnail-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.file-thumbnail-fallback {
  font-size: 52px;
}
</style>
