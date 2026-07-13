import enUS from "quasar/lang/en-US";
import zhCN from "quasar/lang/zh-CN";
import { boot } from "quasar/wrappers";
import {
	formatDate,
	formatDateTime,
	localeState,
	setLocale,
	t,
} from "src/i18n";

const quasarLanguages = {
	"en-US": enUS,
	"zh-CN": zhCN,
};

export default boot(({ app, $q }) => {
	const changeLocale = (locale) => {
		setLocale(locale);
		$q.lang.set(quasarLanguages[localeState.locale]);
	};

	changeLocale(localeState.locale);
	app.config.globalProperties.$t = t;
	app.config.globalProperties.$locale = localeState;
	app.config.globalProperties.$setLocale = changeLocale;
	app.config.globalProperties.$formatDate = formatDate;
	app.config.globalProperties.$formatDateTime = formatDateTime;
});
