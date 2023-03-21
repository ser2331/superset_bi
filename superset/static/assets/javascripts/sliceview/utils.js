import { CONTENT_ID, TYPE_FOLDER, TYPE_SLICE } from './constants';
import initDragdrop from './dragdrop';

export const getStateData = (key) => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : data;
};

export const setStateData = (key, value) => localStorage.setItem(key, JSON.stringify(value));

export const loadAjaxPage = (href) => {
    $(`#${CONTENT_ID}`)
        .addClass('ajax-loading');
    $.ajax({
       url: href,
       success: (html) => {
           history.pushState(null, null, href);
           $(`#${CONTENT_ID}`).html($(html).find(`#${CONTENT_ID}`).html());
           initDragdrop();
       },
        complete: () => {
           $(`#${CONTENT_ID}`).removeClass('ajax-loading');
        },
    });
};

export const createNode = (id, name, type, parentId) => {
    const { has_change_perm: hasChangePerm } = bootStarpData;
    let text = '';
    if (type === TYPE_FOLDER) {
        text = `<span class="name">${name}</span>`;
        text += hasChangePerm && id !== '#-#' ? `<span class="control-button-node"><span class="folder-edit" data-folder-id="${id}"><i class="fa fa-edit"></i></span><span class="folder-del" data-folder-id="${id}"><i class="fa fa-eraser"></i></span></span>` : '';
    }
    if (type === TYPE_SLICE) {
        text = `<span class="name">${name}</span>`;
        text += hasChangePerm && id !== '#-#' ? `<span class="control-button-node"><span class="slice-del" data-slice-id="${id}"><i class="fa fa-eraser"></i></span></span>` : '';
    }
    const result = {
        id: `${id}_${type}`,
        parent: parentId,
        text,
        type,
        a_attr: { 'data-id': id !== '#-#' ? id : null, 'data-type': type },
        originalId: id,
        name,
        li_attr: {
            title: name,
        },
    };
    if (parentId === '#') {
        result.state = {
            opened: true,
        };
    }
    return result;
};

export const getTypeNode = ({ original }) => original ? original.type : undefined;

export const getTextNode = ({ original }) => original ? original.name : undefined;

export const compareNode = (a, b) => {
    const typeNodeA = getTypeNode(a);
    const typeNodeB = getTypeNode(b);
    const textNodeA = getTextNode(a);
    const textNodeB = getTextNode(b);
    if (typeNodeA === typeNodeB) {
        return textNodeA > textNodeB ? 1 : -1;
    }
    return typeNodeA >= typeNodeB ? 1 : -1;
};

export const genSliceExploreLink = sliceId => `/superset/explore/?form_data=${encodeURI(JSON.stringify({
    slice_id: sliceId,
    fields_by_slice: true,
}))}`;

export const genDashboardExploreLink = dashboardId => `/superset/dashboard/${dashboardId}`;
