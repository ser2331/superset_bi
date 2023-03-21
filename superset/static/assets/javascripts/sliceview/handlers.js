import {
    NAME_MODE_VIEW,
    BUTTON_ADD_FOLDER,
    LINK_SHOW_ALL_SLICE,
    CUSTOM_FOLDERS,
    TYPE_SLICE,
    MODAL_ID,
    TYPE_FOLDER,
    FILTER_KEY_DATASOURCE,
    FILTER_KEY_FOLDER,
    DEFAULT_FOLDERS,
    FILTER_KEY, OBJECT_TYPE_SLICE,
} from './constants';
import { setStateData, loadAjaxPage, createNode, genSliceExploreLink, genDashboardExploreLink } from './utils';
import { moveSlice, editSlicefolder, deleteSlicefolder } from './api';

const objectType = window.objectType = $('[data-object_type]')
    .attr('data-object_type');

export default () => {
    // синхронизация радиобаттонов с localstorage
    $(`[name=${NAME_MODE_VIEW}]`)
        .on('change', (e) => {
            setStateData(`${objectType}_${NAME_MODE_VIEW}`, $(e.target)
                .attr('id'));
        });

    // кнопка добавить отчет
    $(`#${BUTTON_ADD_FOLDER}`)
        .on('click', () => {
            window.jQuery(`#${MODAL_ID}`)
                .modal('show');
        });

    // кнопка отобразить все отчеты
    $(`#${LINK_SHOW_ALL_SLICE}`)
        .on('click', () => {
            const loc = new URL(window.location);
            loc.searchParams.delete(FILTER_KEY_FOLDER);
            loc.searchParams.delete(FILTER_KEY_DATASOURCE);
            setStateData(`${objectType}_${FILTER_KEY}`, null);
            loadAjaxPage(loc.href);
            setTimeout(() => $(`#${CUSTOM_FOLDERS}`)
                .jstree().deselect_all(), 100);
            $(`#${DEFAULT_FOLDERS}`).length  && setTimeout(() => $(`#${DEFAULT_FOLDERS}`)
                .jstree().deselect_all(), 300);
        });

    // перемещение отчета внутри дерева
    $(document)
        .on('dnd_stop.vakata', (e, { element, event }) => {
            const { id: movedId, type: movedType } = element.dataset;
            const target = $(`#${CUSTOM_FOLDERS}`).jstree().get_node(element).parent || ($(event.target).is('.jstree-anchor') ? $(event.target) : $(event.target).closest('.jstree-anchor'));
            const { original: targetOriginal } = $(`#${CUSTOM_FOLDERS}`).jstree().get_node(target);
            const { originalId: targetId } = targetOriginal || { originalId: target.dataset ? target.dataset.id : null };
            if (movedType === TYPE_SLICE) {
                moveSlice({
                    id: movedId,
                    folder_id: parseInt(targetId, 10) || null,
                })
                    .then(() => {
                        loadAjaxPage(window.location.href);
                    });
            }
            if (movedType === TYPE_FOLDER) {
                editSlicefolder({
                    id: movedId,
                    parent_id: targetId !== '#-#' ? targetId : null,
                })
                    .then(() => {
                        loadAjaxPage(window.location.href);
                    });
            }
        });

    // удаление / редактирование папок / слайсов
    $(document)
        .on('click', (event) => {
            if ($(event.target)
                .hasClass('folder-edit') || $(event.target)
                .closest('.folder-edit').length) {
                const folderId = event.target.dataset['folder-id'] || $(event.target)
                    .closest('.folder-edit')
                    .attr('data-folder-id');
                window.jQuery(`#${MODAL_ID}`)
                    .modal('show', {
                        id: folderId,
                    });
            } else if ($(event.target)
                .hasClass('folder-del') || $(event.target)
                .closest('.folder-del').length) {
                const folderId = event.target.dataset['folder-id'] || $(event.target)
                    .closest('.folder-del')
                    .attr('data-folder-id');
                deleteSlicefolder(folderId)
                    .then(() => {
                        $(`#${CUSTOM_FOLDERS}`)
                            .jstree()
                            .delete_node(`${folderId}_${TYPE_FOLDER}`);
                        loadAjaxPage(window.location.href);
                    });
            } else if ($(event.target)
                .hasClass('slice-del') || $(event.target)
                .closest('.slice-del').length) {
                const sliceId = event.target.dataset['slice-id'] || $(event.target)
                    .closest('.slice-del')
                    .attr('data-slice-id');
                moveSlice({
                    id: sliceId,
                    parent_id: null,
                })
                    .then(() => {
                        $(`#${CUSTOM_FOLDERS}`)
                            .jstree()
                            .delete_node(`${sliceId}_${TYPE_SLICE}`);
                        loadAjaxPage(window.location.href);
                    });
            }
        });

    // ajax подгрузка на пагинацию
    $(document)
        .on('click', (event) => {
            if (
                event.target.tagName === 'A' && // ссылка
                (
                    $(event.target)
                        .closest('thead').length || // ссылки сортировки
                    $(event.target)
                        .closest('.pagination-container').length // пагинация
                )
            ) {
                event.preventDefault();
                loadAjaxPage(event.target.href);
            }
        });

    // d'n'd
    $(document)
        .on('dragleave', (event) => {
            const allowed = $(event.target)
                .is('[data-type=folder]') || (($(event.target)
                .is('.jstree-icon') || $(event.target)
                .is('.name') || $(event.target)
                .is('.control-button-node')) && $(event.target)
                .parent()
                .is('[data-type=folder]').length);
            if (allowed && $(event.target)
                .closest(`#${CUSTOM_FOLDERS}`).length) {
                $('.draggable')
                    .removeClass('allowed');
                $('.jstree-hovered')
                    .removeClass('jstree-hovered');
            }
        });

    $(document)
        .on('dragover', (event) => {
            const allowed = $(event.target)
                .is('[data-type=folder]') || (($(event.target)
                .is('.jstree-icon') || $(event.target)
                .is('.name') || $(event.target)
                .is('.control-button-node')) && $(event.target)
                .parent()
                .is('[data-type=folder]'));
            if (allowed && $(event.target)
                .closest(`#${CUSTOM_FOLDERS}`).length) {
                $('.draggable')
                    .addClass('allowed');
                $('.jstree-hovered')
                    .removeClass('jstree-hovered');
                if ($(event.target)
                    .is('[data-type=folder]')) {
                    $(event.target)
                        .addClass('jstree-hovered');
                } else {
                    $(event.target)
                        .parent()
                        .addClass('jstree-hovered');
                }
                event.preventDefault();
                return false;
            }
                $('.draggable')
                    .removeClass('allowed');

            return true;
        });

    $(document)
        .on('drop', (event) => {
            const allowed = $(event.target)
                .is('[data-type=folder]') || (($(event.target)
                .is('.jstree-icon') || $(event.target)
                .is('.name') || $(event.target)
                .is('.control-button-node')) && $(event.target)
                .parent()
                .is('[data-type=folder]'));
            if (allowed && $(event.target)
                .closest(`#${CUSTOM_FOLDERS}`).length) {
                const targetFolderId = $(event.target)
                    .attr('data-id') || $(event.target)
                    .parent()
                    .attr('data-id');
                const { id: sliceId, name: sliceName } = JSON.parse(event.originalEvent.dataTransfer.getData('text'));
                // вызов апи по перемещению слайса в папку
                // обновление центарльной части и привязка узла к дереву
                moveSlice({
                    id: sliceId,
                    folder_id: parseInt(targetFolderId, 10) || null,
                })
                    .then(() => {

                        $(`#${CUSTOM_FOLDERS}`)
                            .jstree()
                            .delete_node(`${sliceId}_${TYPE_SLICE}`);

                        $(`#${CUSTOM_FOLDERS}`)
                            .jstree()
                            .create_node(`${targetFolderId}_${TYPE_FOLDER}`, createNode(sliceId, sliceName, TYPE_SLICE, `${targetFolderId}_${TYPE_FOLDER}`));

                        loadAjaxPage(window.location.href);
                    });
                event.stopPropagation();
                return false;
            }
            return true;
        });

    // переход в папку и одинарный клик на отчет
    document.addEventListener('click', (event) => {
        if (
            $(event.target).is('[data-type=folder]') ||
            $(event.target).closest('[data-type=folder]').length ||
            $(event.target).is('[data-type=slice]') ||
            $(event.target).closest('[data-type=slice]').length
        ) {
            const targetFolderId = ($(event.target).is('[data-type=folder]') || $(event.target).closest('[data-type=folder]').length) ?
                ($(event.target).attr('data-id') || $(event.target).closest('[data-type=folder]').attr('data-id')) :
                $(event.target).closest('ul').siblings('[data-type=folder]').attr('data-id');

            const loc = new URL(window.location);
            let filterKey = '';
            if ($(event.target)
                .closest(`#${CUSTOM_FOLDERS}`).length) {
                filterKey = FILTER_KEY_FOLDER;
            }
            if ($(event.target)
                .closest(`#${DEFAULT_FOLDERS}`).length) {
                filterKey = FILTER_KEY_DATASOURCE;
            }
            if (filterKey) {
                const currentFilter = loc.searchParams.get(filterKey);
                if (currentFilter === targetFolderId) {
                    return true;
                }
                loc.searchParams.delete(FILTER_KEY_FOLDER);
                loc.searchParams.delete(FILTER_KEY_DATASOURCE);
                loc.searchParams.set(filterKey, targetFolderId);

                setStateData(`${objectType}_${FILTER_KEY}`, {
                    key: filterKey,
                    value: targetFolderId,
                });
                loadAjaxPage(loc.href);
            }
            return false;
        }
        return true;
    }, true);

    // переход в отчет
    document.addEventListener('dblclick', (event) => {
        if ($(event.target)
            .is('[data-type=slice]') || $(event.target)
            .closest('[data-type=slice]').length) {
            const targetSliceId = $(event.target)
                .attr('data-id') || $(event.target)
                .closest('[data-type=slice]')
                .attr('data-id');
            window.location.href = objectType === OBJECT_TYPE_SLICE ? genSliceExploreLink(targetSliceId) : genDashboardExploreLink(targetSliceId);
            return false;
        }
        return true;
    }, true);

    // добавление нового отчета
    $(document).on('click', (event) => {
            if (
                ($(event.target).is('a') || $(event.target).closest('a').length) && $(event.target).closest('.list-add-action').length
            ) {
                const a = $(event.target).is('a') ? $(event.target) : $(event.target).closest('a');
                let folderId = null;
                const [selectedNode] = $(`#${CUSTOM_FOLDERS}`).jstree().get_top_selected(true);
                if (selectedNode && selectedNode.type === TYPE_FOLDER) {
                    const { original } = selectedNode;
                    folderId = original.originalId;
                } else if (selectedNode && selectedNode.type === TYPE_SLICE) {
                    const { parent } = selectedNode;
                    const { original } = $(`#${CUSTOM_FOLDERS}`).jstree().get_node(parent);
                    folderId = original.originalId;
                }
                if (folderId) {
                    const searchParams = new URLSearchParams(a.attr('href'));
                    searchParams.set('folder_id', folderId);
                    a.attr('href', searchParams.toString().replaceAll('%2F', '/').replace('=&', '?'));
                }
                return true;
            }
        });

    // подстановка ссылок для открытия отчета
    $(document).on('contextmenu', '[data-type=slice]', (event)  => {
        const target = $(event.target).is('a') ? $(event.target) : $(event.target).closest('a');
        const targetSliceId = target.attr('data-id');
        const href = objectType === OBJECT_TYPE_SLICE ? genSliceExploreLink(targetSliceId) : genDashboardExploreLink(targetSliceId);
        target.attr('href', href);
    });
};
