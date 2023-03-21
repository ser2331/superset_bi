import {
    CUSTOM_FOLDERS,
    DEFAULT_FOLDERS,
    NAME_MODE_VIEW,
    BUTTON_ADD_FOLDER,
    LINK_SHOW_ALL_SLICE,
    MODAL_ID,
    FOLDER_ADD_FORM, OBJECT_TYPE_SLICE,
} from './constants';
import { t } from '../locales';
import { getStateData } from './utils';

const objectType = window.objectType = $('[data-object_type]').attr('data-object_type');

export default (root) => {
    const { has_change_perm: hasChangePerm } = bootStarpData;
    const modeView = getStateData(`${objectType}_${NAME_MODE_VIEW}`) || 'byCustom';
    let html = '';
    if (hasChangePerm) {
        html += `<div class="list-add-action">${t('Add folder')} <span id="${BUTTON_ADD_FOLDER}" class="btn btn-sm btn-primary" data-toggle="tooltip" rel="tooltip" title="${t('Add folder')}"><i class="fa fa-plus"></i></span></div>`;
    }
    if (objectType === OBJECT_TYPE_SLICE) {
        html += `
                <input type="radio" hidden class="custom-control-input" id="byDefault" name="${NAME_MODE_VIEW}" ${modeView === 'byDefault' ? 'checked' : ''}>
                <label class="custom-control-label" for="byDefault">${t('Folders by sources')}</label>
        `;
    }
    html += `
            <input type="radio" hidden class="custom-control-input" id="byCustom" name="${NAME_MODE_VIEW}" ${modeView === 'byCustom' ? 'checked' : ''}>
    `;

    if (objectType === OBJECT_TYPE_SLICE) {
        html += `
            <label class="custom-control-label" for="byCustom">${t('Custom folders')}</label>
        `;
    }

    html += `
        <button id="${LINK_SHOW_ALL_SLICE}" class="show-all btn btn-sm btn-default">${objectType === OBJECT_TYPE_SLICE ? t('Show all slices') : t('Show all dashboards')}</button>
    `;

    html += `<div id="${CUSTOM_FOLDERS}"></div>`;

    if (objectType === OBJECT_TYPE_SLICE) {
        html += `
            <div id="${DEFAULT_FOLDERS}"></div>
        `;
    }
    root.html(html);
};

export const modalMarkup = () => `<div id="${MODAL_ID}" class="misc-modal modal fade" tabindex="-1" role="dialog" aria-labelledby="myModalLabel">
      <div class="modal-dialog modal-lg" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
              <span aria-hidden="true">×</span>
            </button>
            <h4 class="modal-title"></h4>
          </div>
          <div id="${FOLDER_ADD_FORM}"></div>
        </div>
      </div>
    </div>`;
