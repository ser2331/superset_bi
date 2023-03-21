import { t } from '../javascripts/locales';

export function showError(error) {
    if (typeof notify !== 'undefined') {
        notify.info(t('error loading data,\nerror: %s', error));
    }
}
