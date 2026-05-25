import i18n from "i18next";
import {initReactI18next} from "react-i18next";
import HttpApi from 'i18next-http-backend';

export const languages = [
    {name: 'English', code: 'en'},
    {name: 'Čeština', code: 'cs_CZ'},
    {name: 'Deutsch', code: 'de_DE'},
    {name: 'Español', code: 'es_ES'},
    {name: 'Français', code: 'fr_FR'},
    {name: 'Italiano', code: 'it_IT'},
    {name: 'Русский', code: 'ru_RU'},
    {name: 'Português-Brasil', code: 'pt_BR'},
    {name: '简体中文', code: 'zh_CN'},
    {name: '繁體中文', code: 'zh_TW'},
]

i18n.use(initReactI18next).use(HttpApi).init({
    lng: navigator.language.replace('-', '_'),
    supportedLngs: languages.map(lang => lang.code),
    fallbackLng: 'en',
    backend: {
        loadPath: '/assets/locales/{{lng}}.json'
    },
});

export default i18n;