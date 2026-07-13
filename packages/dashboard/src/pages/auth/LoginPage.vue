<template>
  <q-page class='flex flex-center'>
    <q-card class='q-pa-md shadow-2' bordered>
      <q-card-section class='text-center'>
        <div class='text-grey-9 text-h5 text-weight-bold'>{{ $t('signIn') }}</div>
        <div class='text-grey-8'>{{ $t('signInDescription') }}</div>
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
            :label="$t('username')"
            lazy-rules
            type='text'
          />

          <q-input
            filled
            v-model="form.password"
            :label="$t('password')"
            lazy-rules
            type='password'
          />

          <q-toggle v-model="form.remind" :label="$t('rememberMe')" />

          <div>
            <q-btn :loading="loading" :label="$t('signIn')" type="submit" color="primary"/>
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
				this.showError =
					error.message === "Invalid username or password"
						? this.$t("invalidCredentials")
						: error.message;
				throw error;
			} finally {
				this.loading = false;
			}
		},
	},
});
</script>
