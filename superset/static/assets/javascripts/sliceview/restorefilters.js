import { getStateData, loadAjaxPage } from './utils';
import { FILTER_KEY } from './constants';

const objectType = window.objectType = $('[data-object_type]').attr('data-object_type');

export default () => {
    const filter = getStateData(`${objectType}_${FILTER_KEY}`);
    const { key, value } = filter || {};
    if (key && value) {
        const loc = new URL(window.location);
        loc.searchParams.set(key, value);
        if (loc.href !== window.location.href) {
            loadAjaxPage(loc.href);
        }
    }
};
