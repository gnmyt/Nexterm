import i18n from "i18next";
import {initReactI18next} from "react-i18next";
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpApi from 'i18next-http-backend';

if (localStorage.getItem('language') === null)
    localStorage.setItem('language', navigator.language.split('-')[0]);

export const languages = [
    {name: 'English', code: 'en'},
    {name: 'Deutsch', code: 'de'},
    {name: 'Español', code: 'es'},
    {name: 'Français', code: 'fr'},
    {name: 'Italiano', code: 'it'},
    {name: 'Português-Brasil', code: 'pt-BR'},
    {name: '中文', code: 'zh'},
]

i18n.use(initReactI18next).use(LanguageDetector).use(HttpApi).init({
    supportedLngs: languages.map(lang => lang.code),
    fallbackLng: 'en',
    backend: {
        loadPath: '/assets/locales/{{lng}}.json'
    },
    detection: {
        order: ['localStorage'],
        lookupLocalStorage: 'language'
    }
});

export default i18n;