const objectType = window.objectType = $('[data-object_type]').attr('data-object_type');

export default {
    getSlices: '/sliceaddview/api/read',
    getSliceFolder: `/superset/folders/${objectType}/`,
    postSliceFolder: `/superset/folders/${objectType}/`,
    editSlicefolder: id => `/superset/folders/${objectType}/${id}/`,
    deleteSlicefolder: id => `/superset/folders/${objectType}/${id}/`,
    moveSlice: id => `/superset/folders/move/${objectType}/${id}/`,
    getDataSourcesSliceFolder: `/superset/get_datasources_folders/${objectType}/`,
    getDashboards: '/dashboardmodelviewasync/api/read',
};
