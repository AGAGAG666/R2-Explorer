<template>
  <q-page class="flex flex-center">
    <q-inner-loading
      v-if="mainStore.serverLoading"
      :showing="true"
      :label="$t('loading')"
    />
    <div v-else-if="mainStore.serverError" class="text-center q-pa-lg">
      <q-icon name="cloud_off" color="negative" size="64px" />
      <h5 class="q-my-md">{{ $t('backendUnavailable') }}</h5>
      <p class="text-grey-7">
        {{ $t('backendUnavailableHint', { url: mainStore.serverUrl }) }}
      </p>
      <q-btn color="primary" icon="refresh" :label="$t('retry')" @click="retry" />
    </div>
    <q-inner-loading v-else :showing="true" :label="$t('loading')" />
  </q-page>
</template>

<script>
import { useMainStore } from "stores/main-store";
import { defineComponent } from "vue";

export default defineComponent({
	name: "HomePage",
	methods: {
		retry() {
			return this.mainStore.loadServerConfigs(this.$router, this.$q, true);
		},
	},
	setup() {
		return {
			mainStore: useMainStore(),
		};
	},
});
</script>
