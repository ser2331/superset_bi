import 'jstree';
import 'jstree/dist/themes/default/style.min.css';
import '../../stylesheets/sliceview.css';
import { getSlicesFolders, getDataSourcesSliceFolder } from './api';
import { createNode } from './utils';
import createMarkUp from './markup';
import setHandlers from './handlers';
import { ROOT_ID, TYPE_FOLDER, TYPE_SLICE, OBJECT_TYPE_SLICE } from './constants';
import initTrees from './tree';
import Modal from './modal';
import RestoreFilters from './restorefilters';

const objectType = window.objectType = $('[data-object_type]').attr('data-object_type');

window.bootStarpData = JSON.parse($('[data-bootstrap]').attr('data-bootstrap'));

$(document)
    .ready(() => {
        const root = $(`#${ROOT_ID}`);
        createMarkUp(root);
        Modal();
        setHandlers();
        /** клонируем csrf токен */
        const input = $('[name=csrf_token]').clone().attr('id', '');
        $('body').append(input);
        RestoreFilters();
        // загружаем структуру папок с бека
        Promise.all([getSlicesFolders(), objectType === OBJECT_TYPE_SLICE ? getDataSourcesSliceFolder() : null])
            .then(([slicesFolders, dataSourcesSliceFolder]) => {
                const dataSlicesFolders = [];
                const dataDataSourcesSliceFolder = [];

                const convertFolderToNode = (result, node, type = TYPE_FOLDER, parent = null) => {
                    const { id, name, parent_id: parentId, slices, dashboards } = node;
                    if (id === '#-#') {
                        result.push(createNode(id, name, type, '#'));
                    } else
                    if (id) {
                        result.push(createNode(id, name, type, (parent || parentId) ? `${parent || parentId}_${TYPE_FOLDER}` : `#-#_${TYPE_FOLDER}`));
                    }
                    if (Array.isArray(slices || dashboards) && (slices || dashboards).length) {
                        (slices || dashboards).forEach((slice) => {
                            const [sliceId, sliceName] = slice;
                            convertFolderToNode(result, { id: sliceId, name: sliceName }, TYPE_SLICE, id || `#-#_${TYPE_FOLDER}`);
                        });
                    }
                };
                slicesFolders.forEach(folder => convertFolderToNode(dataSlicesFolders, folder));
                if (dataSourcesSliceFolder) {
                    dataSourcesSliceFolder.forEach(folder => convertFolderToNode(dataDataSourcesSliceFolder, folder));
                }
                initTrees(dataSlicesFolders, dataSourcesSliceFolder ? dataDataSourcesSliceFolder : null);

            })
            .catch(e => console.log(e));
    });

