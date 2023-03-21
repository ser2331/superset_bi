import ReactDOM from 'react-dom';
import React from 'react';
import { modalMarkup } from './../markup';
import { MODAL_ID, FOLDER_ADD_FORM, CUSTOM_FOLDERS, TYPE_FOLDER, TYPE_SLICE } from './../constants';
import { t } from '../../locales';
import Form from './form';

export default () => {
    $('body').append(modalMarkup());
    window.jQuery(`#${MODAL_ID}`)
    .modal({ show: false })
        .on('show.bs.modal', (event) => {
            $(`#${FOLDER_ADD_FORM}`).html('');
            $(`#${MODAL_ID} .modal-content`).addClass('loading');
            const { relatedTarget } = event;
            const { id } = relatedTarget || {};
            let editedFolder = null;
            let parentFolder = { value: null, label: t(' -- No parent folder -- ') };
            if (!id) {
                const [selectedNode] = $(`#${CUSTOM_FOLDERS}`).jstree().get_top_selected(true);
                if (selectedNode && selectedNode.type === TYPE_FOLDER) {
                    const { original } = selectedNode;
                    parentFolder = {
                        value: original.originalId,
                        label: original.name,
                    };
                } else if (selectedNode && selectedNode.type === TYPE_SLICE) {
                    const { parent } = selectedNode;
                    const { original } = $(`#${CUSTOM_FOLDERS}`).jstree().get_node(parent);
                    parentFolder = {
                        value: original.originalId,
                        label: original.name,
                    };
                }
            } else {
                const { original, parent, children = [] } = $(`#${CUSTOM_FOLDERS}`).jstree().get_node(`${id}_${TYPE_FOLDER}`);
                if (parent !== '#') {
                    const { original: originalParent } = $(`#${CUSTOM_FOLDERS}`).jstree().get_node(parent);
                    parentFolder = {
                        value: originalParent.originalId,
                        label: originalParent.name,
                    };
                }
                const regexpTypeSlice = new RegExp(`_${TYPE_SLICE}$`);
                editedFolder = {
                    id: original.originalId,
                    name: original.name,
                    object_ids: children.filter(child => regexpTypeSlice.test(child)).map(idSlice => parseInt(idSlice.split(regexpTypeSlice)[0], 10)),
                };
            }

            ReactDOM.render(<Form parentFolder={parentFolder} editedFolder={editedFolder} />, document.getElementById(FOLDER_ADD_FORM));
        });
};
