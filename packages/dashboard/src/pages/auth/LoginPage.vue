<template>
  <q-page class='flex flex-center'>
    <q-card class='q-pa-md shadow-2' bordered>
      <q-card-section class='text-center'>
        <div class='text-grey-9 text-h5 text-weight-bold'>登录</div>
        <div class='text-grey-8'>请输入用户名和密码以访问管理面板。</div>
      </q-card-section>

      <q-card-section v-if='showError'>
        <q-banner inline-actions class="text-white bg-red">
          {{ showError }}
        </q-banner>
      </q-card-section>

      <q-card-section>
        <q-form
          @submit="onSubmit"
          class="q-gutter-sm"
        >
          <q-input
            filled
            v-model="form.username"
            label="用户名"
            lazy-rules
            type='text'
          />

          <q-input
            filled
            v-model="form.password"
            label="密码"
            lazy-rules
            type='password'
          />

          <q-toggle v-model="form.remind" label="记住我" />

          <div>
            <q-btn :loading="loading" label="登录" type="submit" color="primary"/>
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script>
import { useAuthStore } from "stores/auth-store";
import { defineComponent } from "vue";
const authStore = useAuthStore();

export default defineComponent({
	name: "login-page",
	components: {},
	data() {
		return {
			loading: false,
			showError: "",
			form: {
				username: "",
				password: "",
				remind: true,
			},
		};
	},
	methods: {
		async onSubmit() {
			this.loading = true;
			try {
				await authStore.LogIn(this.$router, this.form);
				this.showError = "";
			} catch (error) {
				this.showError = error.message;
				throw error;
			} finally {
				this.loading = false;
			}
		},
	},
});
</script>
