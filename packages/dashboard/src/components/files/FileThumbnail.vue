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
	},
	data: () => ({
		source: null,
		loading: false,
		failed: false,
		observer: null,
		disposed: false,
	}),
	methods: {
		load: async function () {
			if (this.loading || this.source || this.failed) return;

			this.loading = true;
			try {
				const response = await apiHandler.downloadFile(this.bucket, this.fileKey, {
					downloadType: "objectUrl",
				});
				const source = URL.createObjectURL(new Blob([response.data]));
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
		if (typeof IntersectionObserver === "undefined") {
			this.load();
			return;
		}

		this.observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					this.observer.disconnect();
					this.load();
				}
			},
			{ rootMargin: "160px" },
		);
		this.observer.observe(this.$refs.container);
	},
	beforeUnmount() {
		this.disposed = true;
		this.observer?.disconnect();
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
