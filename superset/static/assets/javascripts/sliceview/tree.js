import { CUSTOM_FOLDERS, DEFAULT_FOLDERS, TYPE_FOLDER, TYPE_SLICE } from './constants';
import { compareNode } from './utils';
import initDragdrop from './dragdrop';

const objectType = window.objectType = $('[data-object_type]').attr('data-object_type');

// функция инит деревьев
export default (dataSlicesFolders, dataDataSourcesSliceFolder) => {
    const { has_change_perm: hasChangePerm } = bootStarpData;
    const customFoldersPlusins = ['state', 'sort', 'types'];
    const defaultoldersPlusins = ['state', 'sort', 'types'];
    if (hasChangePerm) {
        customFoldersPlusins.push('dnd');
    }

    const promiseInitCustomFolders = new Promise((resolve) => {
        $(`#${CUSTOM_FOLDERS}`)
            .on('loaded.jstree', () => {
                resolve();
            })
            .jstree({
                state: {
                    key: `${objectType}_${CUSTOM_FOLDERS}`,
                },
                plugins: customFoldersPlusins,
                types: {
                    [TYPE_SLICE]: { valid_children: [], icon: TYPE_SLICE },
                    [TYPE_FOLDER]: { valid_children: [TYPE_SLICE, TYPE_FOLDER], icon: TYPE_FOLDER },
                },
                core: {
                    check_callback: true,
                    data: dataSlicesFolders,
                    themes: {
                        variant: 'small',
                    },
                },
                sort(a, b) {
                    return compareNode(this.get_node(a), this.get_node(b));
                },
            });
    });

    const promiseInitDefaultFolders = new Promise((resolve) => {
        if (dataDataSourcesSliceFolder) {
            $(`#${DEFAULT_FOLDERS}`)
                .on('loaded.jstree', () => {
                    resolve();
                })
                .jstree({
                    state: {
                        key: DEFAULT_FOLDERS,
                    },
                    plugins: defaultoldersPlusins,
                    types: {
                        default: { icon: TYPE_FOLDER },
                        [TYPE_SLICE]: { valid_children: [], icon: TYPE_SLICE },
                    },
                    core: {
                        data: dataDataSourcesSliceFolder,
                        themes: {
                            variant: 'small',
                        },
                    },
                    sort: (a, b) => compareNode(a, b, dataDataSourcesSliceFolder),
                });
        } else {
            resolve();
        }

    });

    Promise.all([promiseInitCustomFolders, promiseInitDefaultFolders])
        .then(() => {
            $('#folder_tree').removeClass('loading');
            initDragdrop();
            window.jQuery('#folder_tree [id$=slice]').tooltip({
                placement: 'right',
            });
        });
};
