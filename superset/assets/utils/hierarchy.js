import shortid from 'shortid';
import queryString from 'query-string';
import { isEqual } from 'underscore';
import $ from 'jquery';
import { t } from '../javascripts/locales';

/**
 * 
 * @param {*} sliceId 
 * @param {*} formData 
 * @param {*} filters 
 */
function fetchSliceFormData(sliceId, formData, filters) {
    return new Promise((resolve, reject) => {
        $.getJSON(`/superset/slice_formdata/${sliceId}/`, (data) => {
            const where = formData.where;
            const having = formData.having;
            const newFormData = {
              ...data.form_data,
              filters: [ ...(formData.extra_filters || []), ...filters ],
              where,
              having,
            };
            resolve(newFormData);
        });
    });
}

function fetchSliceDatasource(type, id) {
    return new Promise((resolve, reject) => {
        $.getJSON(`/superset/datasource/${type}/${id}/`, (datasource) => {
            resolve(datasource);
        });
    });
}

export class Hierarchy {
    constructor(slice) {
        this.slice = slice;
    }

    getAllFilters(sliceFilters, contextFilters) {
        // TODO: Это надо сейчас вообще?
        const unwrappedExistingFilters = sliceFilters.map((item) => {
            if (!item.op || item.op === 'in') {
                return { ...item, op: 'in', val: Array.isArray(item.val) ? item.val : [item.val] };
            }
            return { ...item, op: item.op, val: item.val };
        });
        const filteredNewFilters = contextFilters
            .filter(item => item.val !== t('All'))
            .map(item => ({
                ...item,
                col: item.col,
                op: 'in',
                val: Array.isArray(item.val) ? item.val : [item.val],
            }));
        const result = [ ...unwrappedExistingFilters, ...filteredNewFilters ];
        return result.reduce((acc, filter) => {
            if (!acc.find(f =>
                isEqual(
                    { op: filter.op, col: filter.col, val: filter.val },
                    { op: f.op, col: f.col, val: f.val },
                )
            )) {
                acc.push(filter);
            }
            return acc;
        }, []);
    }

    getUrlDrilldowns(column, contextFilters) {
        const formData = this.slice.formData;
        const sliceFilters = formData.filters; // TODO: Почему basic?
        const result = (formData.url_drilldowns || [])
            .filter(drilldown => drilldown.field === column)
            .map(drilldown => ({
                title: drilldown.title,
                action: () => {
                  const allFilters = this.getAllFilters(sliceFilters, contextFilters);
                  if (drilldown.type === 'dashboards') {
                      this.drilldownToDashboard(drilldown.url, allFilters);
                  }
                  if (drilldown.type === 'slices') {
                      this.drilldownToSlice(drilldown.url, allFilters);
                  }
              },
            }));
        return result.length ? [{ title: t('URL Drilldowns') }, ...result] : [];
    }

    /**
     * Сохраняет предыдущее состояние дашборда в sessionStorage (экшном) и
     * делает редирект на страницу с целевым дашбордом с применением фильтров
     * @param {number} dashboardId id целевого дашборда.
     * @param {{ col1: 'val1', col2: 'val2', ...}} filters Фильтры, которые будут
     * применены при переходе с оператором 'in' (TODO: почему только с 'in'?)
     */
    drilldownToDashboard(dashboardId, filters) {
        const { actions, formData } = this.slice.props;
        const sliceId = formData.slice_id;
        const prevDashboardState = this.slice.prevDashboardState;
        const url = queryString.parse(location.search);
        const hid = url.hid || shortid.generate();
        const hidIndex = Number.parseInt(url.hid_index) || 0;
        actions.saveDashboardState(hid, hidIndex);
        const preselectFilters = { [sliceId]: filters };
        const filterURL = JSON.stringify(preselectFilters);
        const preselectFiltersKey = shortid.generate();
        sessionStorage.setItem(preselectFiltersKey, filterURL);
        window.location.href = `/superset/dashboard/${dashboardId}/?preselect_filters_key=${preselectFiltersKey}&hid=${hid}&hid_index=${hidIndex + 1}`;
    }

    /**
     * Сохраняет предыдущее состояние слайса в redux-сторе (экшном) и бросает экшн
     * на обновление запроса слайса с применением новых фильтров.
     * @param {{ col1: 'val1', col2: 'val2', ...}} filters Фильтры, которые будут
     * применены при переходе с оператором 'in' (TODO: почему только с 'in'?)
     */
    drilldownToSlice(sliceId, filters) {
        const formData = this.slice.formData;
        const { actions, prevFormData, chartKey } = this.slice.props;
        let rootSliceId = formData.slice_id;
        if (prevFormData && prevFormData.length) {
            rootSliceId = prevFormData[0].formData.slice_id;
        }
        actions.saveSliceState(rootSliceId);
        fetchSliceFormData(sliceId, formData, filters).then((newFormData) => {
            const [ datasourceId, datasourceType ] = newFormData.datasource.split('__');
            fetchSliceDatasource(datasourceType, datasourceId).then((datasources) => {
                actions.drilldownToSlice(chartKey, sliceId, newFormData, datasources);
            });
        });
    }

    /**
     * @param {object} hierarchyColumn Column for hierarchy drilldown
     * @param {array} filters Context filters
     * @param {boolean} uncheckHierarchy Should revert drilldown
     * @param {groupby|columns|all_columns} attr Which field receives column;
     * groupby - left axis, columns - top axis, all_columns - ??? probably table visualization
     * @param {array} hierarchyColumns All columns in hierarchy to determine array index where to place ours
     */
    drilldownToHierarchy(hierarchyColumn, filters, uncheckHierarchy, attr, hierarchyColumns) {
        const formData = this.slice.formData;
        const { actions, chartKey } = this.slice.props;
        const [ prefix, id ] = chartKey.split('_');
        actions.saveSliceState(Number.parseInt(id, 10));
        const newFilters = uncheckHierarchy
            ? filters.filter(filter => filter.hierarchyColumn.id !== hierarchyColumn.id)
            : filters.map(filter => ({ ...filter, hierarchyColumn }));
        let result;
        if (!attr) {
            attr = 'groupby';
        }
        if (uncheckHierarchy) {
            result = formData[attr].filter(column => column !== hierarchyColumn.name);
        }
        if (!uncheckHierarchy && hierarchyColumns) {
            let targetIndex = formData[attr].length - 1;
            formData[attr].forEach((column, index) => {
                const alreadyApplied = hierarchyColumns.find(item => item.name === column);
                if (alreadyApplied && alreadyApplied.order <= hierarchyColumn.order) {
                    targetIndex = index;
                }
            });
            result = [
                ...formData[attr].slice(0, targetIndex + 1),
                hierarchyColumn.name,
                ...formData[attr].slice(targetIndex + 1, formData[attr].length),
            ];
        }
        if (!uncheckHierarchy && !hierarchyColumns) {
            result = [ ...formData[attr], hierarchyColumn.name ];
        }
        const newFormData = {
            ...formData,
            groupby: attr === 'groupby' ? result : formData.groupby,
            columns: attr === 'columns' ? result : formData.columns,
            all_columns: attr === 'all_columns' ? result : formData.all_columns,
            filters: this.getAllFilters(this.slice.formData.filters, newFilters),
        };
        const [ datasourceId, datasourceType ] = newFormData.datasource.split('__');
        fetchSliceDatasource(datasourceType, datasourceId).then((datasources) => {
              actions.drilldownToSlice(chartKey, formData.slice_id, newFormData, datasources);
        });
    }

    /**
     * Получить следующий столбец по иерархии относительно текущего
     *
     * @param {object} hierarchy Иерархия
     * @param {object} currentColumn Текущий столбец
     */
    getNextColumnByHierarchy(hierarchy, currentColumn) {
        const nextColumns = hierarchy.columns.filter(item => item.groupby && item.order > currentColumn.order);
        return nextColumns.length
            ? nextColumns.reduce((min, next) => min.order < next.order ? min : next)
            : null;
    }
}
