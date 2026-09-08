import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import roJSON from "./locales/ro.json";
import enJSON from "./locales/en.json";

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ro: { translation: roJSON },
      en: { translation: enJSON }
    },
    lng: "ro", // limba implicita
    fallbackLng: "en",
    interpolation: {
      escapeValue: false // react escapes by default
    }
  });

export default i18n;
