import React from 'react';
import PropTypes from 'prop-types';
import { BootstrapTable, TableHeaderColumn } from 'react-bootstrap-table';
import 'react-bootstrap-table/css/react-bootstrap-table.css';
import $ from 'jquery';
import Select from 'react-select';

import { t } from '../../locales';
import { createSlicesFolders, editSlicefolder, getSlicesFolders, getSlices, getDashboards } from '../api';
import { MODAL_ID, OBJECT_TYPE_SLICE } from '../constants';
import RenderLevelsSelectOption from '../../components/RenderLevelsSelectOption';

const objectType = window.objectType = $('[data-object_type]').attr('data-object_type');

const propTypes = {
    editedFolder: PropTypes.shape({
        id: PropTypes.number,
        name: PropTypes.string,
        object_ids: PropTypes.arrayOf(PropTypes.number),
    }),
    parentFolder: PropTypes.shape({
        id: PropTypes.number,
        label: PropTypes.string,
    }),
};

class Form extends React.Component {
    constructor(props) {
        super(props);
        const { parentFolder = '', editedFolder = undefined } = props;
        this.state = {
            slices: [],
            folders: [],
            selectedSlices: editedFolder ? editedFolder.object_ids : [],
            folderName: editedFolder ? editedFolder.name : '',
            parentFolder,
            loading: true,
        };
        this.options = {
            defaultSortOrder: 'desc',
            defaultSortName: 'modified',
            sizePerPage: 10,
            noDataText: t('There is no data to display'),
        };

        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.toggleSlice = this.toggleSlice.bind(this);
        this.toggleSliceAll = this.toggleSliceAll.bind(this);

        this.selectRowProp = {
            mode: 'checkbox',
            clickToSelect: true,
            onSelect: this.toggleSlice,
            onSelectAll: this.toggleSliceAll,
        };
    }

    componentDidMount() {
        const { editedFolder } = this.props;
        if (editedFolder) {
            window.jQuery(`#${MODAL_ID}`)
                .find('.modal-title')
                .text(t('Edit folder'));
        } else {
            window.jQuery(`#${MODAL_ID}`)
                .find('.modal-title')
                .text(t('Add folder'));
        }
        Promise.all([this.loadSlices(), this.loadFolders()])
            .finally(() => {
                $(`#${MODAL_ID} .modal-content`)
                    .removeClass('loading');
                this.setState({ loading: false });
            });
    }

    getAjaxErrorMsg(error) {
        const respJSON = error.responseJSON;
        return (respJSON && respJSON.message) ? respJSON.message :
            error.responseText;
    }

    loadFolders() {
        const { editedFolder } = this.props;
        const { id: editedFolderId } = editedFolder || {};
        return getSlicesFolders()
            .then((data) => {
                const foldersData = data.filter(item => item.id !== '#-#').sort((a, b) => {
                    if (a.name < b.name) return -1;
                    if (a.name > b.name) return 1;
                    return 0;
                });
                const folderTree = (folders, parent = null, level = 0) =>
                    folders.reduce((tree, currentItem) => {
                            if (currentItem.parent_id === parent && currentItem.id !== editedFolderId) {
                                const options = folderTree(folders, currentItem.id, level + 1);
                                if (options.length) {
                                    tree.push({ value: currentItem.id, label: currentItem.name, level });
                                    options.forEach((option) => {
                                        tree.push(option);
                                    });
                                } else {
                                    tree.push({ value: currentItem.id, label: currentItem.name, level });
                                }
                            }
                            return tree;
                        },
                        [],
                    );
                this.setState({ folders: [{ value: null, label: t(' -- No parent folder -- ') }].concat(folderTree(foldersData)) });
            })
            .catch((error) => {
                this.setState({
                    errorMsg: t('error loading data,\nerror: %s', this.getAjaxErrorMsg(error)),
                });
            });
    }

    loadSlices() {
        return (objectType === OBJECT_TYPE_SLICE ? getSlices() : getDashboards()).then(({ result = [] }) => {
            const slices = result.map(slice => ({
                id: slice.id,
                sliceName: slice.slice_name || slice.dashboard_title,
                vizType: slice.viz_type,
                datasourceLink: slice.datasource_link,
                modified: slice.modified,
                changedBy: slice.changed_by_name,
            }));
            this.setState({
                slices,
            });
        });
    }

    toggleSlice(slice) {
        const { id } = slice;
        const { selectedSlices } = this.state;
        const index = selectedSlices.indexOf(id);
        if (index > -1) {
            selectedSlices.splice(index, 1);
        } else {
            selectedSlices.push(id);
        }
        this.setState({ selectedSlices });
    }

    toggleSliceAll(isSelect, rows) {
        const { selectedSlices } = this.state;
        rows.forEach(({ id }) => {
            const index = selectedSlices.indexOf(id);
            if (index > -1) {
                if (!isSelect) {
                    selectedSlices.splice(index, 1);
                }
            } else if (isSelect) {
                selectedSlices.push(id);
            }
        });
        this.setState({ selectedSlices });
    }

    modifiedDateComparator(a, b, order) {
        if (order === 'desc') {
            if (a.modified > b.modified) {
                return -1;
            } else if (a.modified < b.modified) {
                return 1;
            }
            return 0;
        }

        if (a.modified < b.modified) {
            return -1;
        } else if (a.modified > b.modified) {
            return 1;
        }
        return 0;
    }

    handleClose() {
        window.jQuery(`#${MODAL_ID}`)
            .modal('hide');
    }

    handleSubmit() {
        const { folderName: name, selectedSlices, parentFolder } = this.state;
        const { editedFolder } = this.props;
        const { value: parentId } = parentFolder || {};
        let method = createSlicesFolders;
        const data = {
            name,
            parent_id: parentId === '#-#' ? null : parentId,
            object_ids: selectedSlices,
        };

        if (editedFolder) {
            method = editSlicefolder;
            data.id = editedFolder.id;
        }
        this.setState({ loading: true });
        method(data)
            .then(() => {
                location.reload();
            })
            .catch(() => {
                this.errored = true;
                this.setState({
                    errorMsg: this.getAjaxErrorMsg(error),
                    loading: false,
                });
            });
    }

    render() {
        const { folderName, folders, parentFolder, selectedSlices, loading } = this.state;
        return (
          <div className={`${loading ? 'disabled' : ''}`}>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="name">{t('Folder name')}</label>
                <input
                  className="form-control"
                  id="name"
                  name="name"
                  placeholder={t('Folder name')}
                  type="text"
                  value={folderName}
                  onChange={e => this.setState({ folderName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>{t('Parent folder')}</label>
                <Select
                  clearable={false}
                  name="folder"
                  onChange={(value) => {
                                this.setState({
                                    parentFolder: value,
                                });
                            }}
                  optionRenderer={RenderLevelsSelectOption}
                  value={parentFolder}
                  options={folders}
                  placeholder={t('Parent folder')}
                />
              </div>
              <BootstrapTable
                ref="table"
                data={this.state.slices}
                selectRow={{ ...this.selectRowProp, selected: selectedSlices }}
                options={this.options}
                hover
                search
                searchPlaceholder={t('Search')}
                pagination
                condensed
                height="auto"
              >
                <TableHeaderColumn
                  dataField="id"
                  isKey
                  dataSort
                  hidden
                />
                <TableHeaderColumn
                  dataField="sliceName"
                  dataSort
                >
                  <span>{t('Name')}</span>
                </TableHeaderColumn>
                {objectType === OBJECT_TYPE_SLICE ?
                  <TableHeaderColumn
                    dataField="vizType"
                    dataSort
                  >
                    <span>{t('Viz')}</span>
                  </TableHeaderColumn> : null
                  }
                {objectType === OBJECT_TYPE_SLICE ?
                  <TableHeaderColumn
                    dataField="datasourceLink"
                    dataSort
                    dataFormat={datasourceLink => datasourceLink}
                  >
                    {t('Datasource')}
                  </TableHeaderColumn> :
                  <TableHeaderColumn
                    dataField="changedBy"
                    dataSort
                    dataFormat={changedBy => changedBy}
                  >
                    {t('Creator')}
                  </TableHeaderColumn>
                  }
                <TableHeaderColumn
                  dataField="modified"
                  dataSort
                  sortFunc={this.modifiedDateComparator}
                  dataFormat={modified => modified}
                >
                  {t('Modified')}
                </TableHeaderColumn>
              </BootstrapTable>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-primary pull-left"
                onClick={this.handleSubmit}
              >{t('Save')}</button>
              <button
                type="button"
                className="btn btn-default pull-left"
                onClick={this.handleClose}
              >{t('Close')}</button>
            </div>
          </div>
        );
    }
}

Form.propTypes = propTypes;

export default Form;
