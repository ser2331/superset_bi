import Jed from 'jed';
import moment from 'moment';

const DEFAULT_LANGUAGE_PACK = {
    domain: 'superset',
    locale_data: {
        superset: {
            '': {
                domain: 'superset',
                lang: 'en',
                plural_forms: 'nplurals=1; plural=0',
            },
        },
    },
};

const i18n = (function () {
    let languagePack = DEFAULT_LANGUAGE_PACK;

    if (typeof window !== 'undefined') {
        const root = document.getElementById('app') || document.getElementById('js-add-slice-container') || document.querySelector('[data-bootstrap]');
        const bootstrapData = root ? JSON.parse(root.getAttribute('data-bootstrap')) : {};
        if (bootstrapData.common && bootstrapData.common.language_pack) {
            languagePack = bootstrapData.common.language_pack;
            if (bootstrapData.common.locale === 'ru') {
                moment.locale('ru');
            }
            delete bootstrapData.common.locale;
            delete bootstrapData.common.language_pack;
        }
    }

    return new Jed(languagePack);
}());

export { moment };

export default i18n;
