<template>
  <q-page class="flex flex-center">
    <q-inner-loading
      :showing="true"
      label="正在加载..."
    />
  </q-page>
</template>

<script>
import { useMainStore } from "stores/main-store";
import { defineComponent } from "vue";

export default defineComponent({
	name: "HomePage",
	setup() {
		return {
			mainStore: useMainStore(),
		};
	},
});
</script>
