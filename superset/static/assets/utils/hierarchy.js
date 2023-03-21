import shortid from 'shortid';
import queryString from 'query-string';
import { isEqual } from 'underscore';
import $ from 'jquery';
import { t } from '../javascripts/locales';
import { getWheres } from '../javascripts/utils/common';
import { getParam } from '../javascripts/modules/utils';
import { COMMON, TARGET } from '../constants/common';
import { contextMenuEnabled } from './context_menu';
import { convertDataForSql } from '../javascripts/utils/data';
import { showError } from './common';
import moment from 'moment';

const agoOrFromNowRegExp = /(?<count>\d+)\s(?<condition>\w+[^\s])\s(?<typeTime>ago|from\snow)/i;
const regExpDateRegExp = /(?<date>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/i;

const handlerDispatchers = {
    'days': `currentDate.setDate(currentDate.getDate() + dttm)`,
    'seconds': `currentDate.setSeconds(currentDate.getSeconds() + dttm)`,
    'minutes': `currentDate.setMinutes(currentDate.getMinutes() + dttm)`,
    'weeks': `currentDate.setDate(currentDate.getDate() + (dttm * 7))`,
    'months': `currentDate.setMonth(currentDate.getMonth() + dttm)`,
    'years': `currentDate.setFullYear(currentDate.getFullYear() + dttm)`,
};

function getDate(date) {
    let currentDate = new Date();
     if(agoOrFromNowRegExp.test(date)) {
        const { count, typeTime, condition } = date.match(agoOrFromNowRegExp).groups;
        const dttm = typeTime === 'ago' ? -count : +count;
        const handlerBody = handlerDispatchers[condition];
        const handler = new Function('currentDate', 'dttm', handlerBody);
        handler(currentDate, dttm);
    } else if(regExpDateRegExp.test(date)) {
        const { date: parsedDate } = date.match(regExpDateRegExp).groups;
        currentDate = new Date(parsedDate);
    }

    console.log('currentDatae ==>', currentDate)
    return currentDate;
}

const newDateFormatter = (date) => moment(getDate(date)).format('YYYY-MM-DD HH:mm:ss');

/**
 *
 * @param {*} sliceId
 * @param {*} formData
 * @param {*} filters
 */
function fetchSliceFormData(sliceId, formData, filters) {
    function getNewFormData(data, prevSlice = {}) {
        const timeRestrictionKey = formData.granularity_sqla;
        let { from_dttm, to_dttm } =
      prevSlice && prevSlice.form_data ? prevSlice.form_data : data.form_data;
        const findFromDttmAndToDttm = (filter, colName) => filter.col === colName;
        const fromExtraFilter =
      formData.extra_filters &&
      formData.extra_filters.find((filter) =>
          findFromDttmAndToDttm(filter, '__from')
      );

        const toExtraFilter =
      formData.extra_filters &&
      formData.extra_filters.find((filter) =>
          findFromDttmAndToDttm(filter, '__to')
      );
        from_dttm = fromExtraFilter
            ? newDateFormatter(fromExtraFilter.val)
            : from_dttm;
        to_dttm = toExtraFilter
            ? toExtraFilter.val === 'now'
                ? moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')
                : newDateFormatter(toExtraFilter.val)
            : to_dttm;
        const timeRestrictionFilters = [];

        [from_dttm, to_dttm].forEach((d, i) => {
            if (d) {
                timeRestrictionFilters.push({
                    op: i === 0 ? '>=' : '<=',
                    conjuction: 'and',
                    col: timeRestrictionKey,
                    val: d,
                });
            }
        });

        const key = getParam('data_key');
        let dashboardData = {};

    if (key) {
      const storageObj = sessionStorage.getItem(key);
      dashboardData = JSON.parse(storageObj);
    }

    const wheres = getWheres([formData.where, data.form_data.where]);

    const dashboardFilters = dashboardData && Object.keys(dashboardData).length ?
      Object.values(dashboardData.filters).flat() :
      [];

    const allFilters = [
      ...filters,
      ...data.form_data.filters,
      ...timeRestrictionFilters,
      ...dashboardFilters
    ]
      .filter((f) => f.col || f.children)
      .reduce((accum, current) => {
        // remove double filters by ID
        if (current.id && _.find(accum, (o) => o.id === current.id)) {
          return accum;
        }
        return accum.concat([current]);
        }, []);

      return {
            ...data.form_data,
            filters: allFilters,
            where: wheres,
            metrics: !data.form_data.metrics ? data.form_data.metric : data.form_data.metrics,
            from_dttm,
            to_dttm,
            since: from_dttm,
            until:to_dttm
        };
    }

    return new Promise((resolve, reject) => {
        $.getJSON(`/superset/slice_formdata/${sliceId}/`, (data) => {
            if (sliceId === formData.slice_id) {
                resolve(getNewFormData(data));
            } else {
                $.getJSON(`/superset/slice_formdata/${formData.slice_id}/`, (prevSlice) => {
                    resolve(getNewFormData(data, prevSlice));
                }).fail((jqXHR, textStatus, errorThrown) => {
                    reject(errorThrown);
                });
            }
        }).fail((jqXHR, textStatus, errorThrown) => {
            reject(errorThrown);
        });
    });
}

function fetchSliceDatasource(type, id) {
    return new Promise((resolve, reject) => {
        $.getJSON(`/superset/datasource/${type}/${id}/`, (datasource) => {
            resolve(datasource);
        }).fail((jqXHR, textStatus, errorThrown) => {
            reject(errorThrown);
        });
    });
}

export class Hierarchy {
    constructor(slice, json, options) {
        this.slice = slice;
        this.json = json;
        this.options = options || {};
    }

    getAllFilters(sliceFilters, contextFilters) {
    // TODO: Это надо сейчас вообще?
        const unwrappedExistingFilters = sliceFilters
            .filter((item) => ['__to', '__from'].indexOf(item.col) <= -1)
            .map((item) => {
                if (!item.op || item.op === 'in') {
                    return {
                        ...item,
                        op: 'in',
                        val: Array.isArray(item.val) ? item.val : [item.val],
                    };
                }
                return { ...item, op: item.op, val: item.val };
            });
        const filteredNewFilters = contextFilters
            .filter((item) => item.val !== t('All'))
            .map((item) => {
                const getItem = (itm) => {
                    const { columns } = this.slice;
                    const columnOption = columns.find((col) => col.column_name === itm.col);
                    const value = Array.isArray(itm.val) ? itm.val[0] : itm.val;
                    const val = columnOption ? convertDataForSql(value, columnOption) : value;

                    return itm.isComulativeTotal
                        ? {
                            ...itm,
                            col: itm.col,
                            op: '<=',
                            val: val,
                        }
                        : {
                            ...itm,
                            col: itm.col,
                            op: 'in',
                            val: Array.isArray(val) ? val : [val],
                        };
                };
                if ('children' in item) {
                    const path = shortid.generate();
                    return {
                        ...item,
                        id: path,
                        children: item.children.map((it) =>
                            Object.assign({}, getItem(it), {
                                id: shortid.generate(),
                                path: [path],
                                conjuction: 'or',
                            })
                        ),
                    };
                }
                return getItem(item);
            });
        const isComulativeTotal = contextFilters.find(
            (filter) => filter.isComulativeTotal
        );
        const result = isComulativeTotal
            ? filteredNewFilters
            : [...unwrappedExistingFilters, ...filteredNewFilters];
        return result.reduce((acc, filter) => {
            if (
                !acc.find((f) =>
                    isEqual(
                        {
                            op: filter.op,
                            col: filter.col,
                            val: filter.val,
                            children: filter.children,
                        },
                        { op: f.op, col: f.col, val: f.val, children: f.children }
                    )
                )
            ) {
                acc.push(filter);
            }

            return acc;
        }, []);
    }

  getUrlDrilldowns(column, contextFilters, periodFilters = []) {
    const columnField = typeof column === 'object' && 'label' in column ? column.label : column;
    const formData = this.slice.formData;
    const sliceFilters = [
      ...formData.filters,
      ...(formData.extra_filters ? formData.extra_filters : []),
    ];
    const result = (formData.url_drilldowns || [])
      .filter((drilldown) => drilldown.field === columnField)
      .map((drilldown) => ({
        title: drilldown && drilldown.title,
        action: !contextMenuEnabled()
          ? () => {}
          : () => {
              const allFilters = this.getAllFilters(sliceFilters, contextFilters);
              if (drilldown.type === 'dashboards') {
                this.drilldownToDashboard(drilldown.url, [...allFilters, ...periodFilters]);
              }
              if (drilldown.type === 'slices') {
                this.drilldownToSlice(drilldown.url, [...allFilters, ...periodFilters]);
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
    async drilldownToDashboard(dashboardId, filters) {
        const { actions, formData } = this.slice.props;
        const sliceId = formData.slice_id;
        const url = queryString.parse(location.search);
        const hid = url.hid || shortid.generate();
        const hidIndex = Number.parseInt(url.hid_index) || 0;

    try {
      const newFormData = await fetchSliceFormData(sliceId, formData, filters);
      actions.saveDashboardState(hid, hidIndex);
      const newFilters = newFormData.filters;
      const preselect_filters_key = shortid.generate();
      const preselect_filters = { [sliceId]: [...newFilters] };
      sessionStorage.setItem(preselect_filters_key, JSON.stringify(preselect_filters));
      const dataKey = shortid.generate();
      const data = { extra_where: newFormData.where, filters: newFilters };
      sessionStorage.setItem(dataKey, JSON.stringify(data));
      window.location.href = `/superset/dashboard/${dashboardId}/?preselect_filters_key=${preselect_filters_key}&hid=${hid}&hid_index=${hidIndex +
        1}&data_key=${dataKey}`;
        } catch (e) {
            showError(e);
        }
    }

    /**
   * Сохраняет предыдущее состояние слайса в redux-сторе (экшном) и бросает экшн
   * на обновление запроса слайса с применением новых фильтров.
   * @param {{ col1: 'val1', col2: 'val2', ...}} filters Фильтры, которые будут
   * применены при переходе с оператором 'in' (TODO: почему только с 'in'?)
   */
    async drilldownToSlice(sliceId, filters) {

    const formData = this.slice.formData;
    const { actions, prevFormData, chartKey } = this.slice.props;
    const isChartFromDrilldown =!!(chartKey.split('_').find((key => key === 'drilldown')))
    let rootSliceId = formData.slice_id;
    if (prevFormData && prevFormData.length) {
      rootSliceId = prevFormData[prevFormData.length - 1].formData.slice_id;
    }
      try {
        const newFormData = await fetchSliceFormData(sliceId, formData, filters);
      const [datasourceId, datasourceType] = newFormData.datasource.split('__');
      const datasources = await fetchSliceDatasource(datasourceType, datasourceId);
      actions.saveSliceState(rootSliceId, null ,isChartFromDrilldown);
      actions.drilldownToSlice(chartKey, sliceId, newFormData, datasources, isChartFromDrilldown);
      $('.nvtooltip.xy-tooltip') && $('.nvtooltip.xy-tooltip').remove()
    } catch (e) {
      showError(e);
    }
  }

  /**
   * @param {object} hierarchyColumn Column for hierarchy drilldown
   * @param {array} filters Context filters
   * @param {boolean} uncheckHierarchy Should revert drilldown
   * @param {groupby|columns|all_columns} attr Which field receives column;
   * groupby - left axis, columns - top axis, all_columns - ??? probably table visualization
   * @param {array} hierarchyColumns All columns in hierarchy to determine array index where to place ours
   */
  async drilldownToHierarchy(
    hierarchyColumn,
    filters,
    uncheckHierarchy,
    attr,
    hierarchyColumns,
    periodFilters = []
  ) {
    const formData = this.slice.formData;
    const { actions, chartKey } = this.slice.props;
    const isChartFromDrilldown =!!(chartKey.split('_').find((key => key === 'drilldown')))
    const [prefix, id] = chartKey.split('_');
    const newFilters = uncheckHierarchy
      ? filters.filter((filter) => filter.hierarchyColumn.id !== hierarchyColumn.id)
      : filters.map((filter) => ({ ...filter, hierarchyColumn }));
    let result;
    if (!attr) {
      attr = 'groupby';
    }
    if (uncheckHierarchy) {
      result = formData[attr].filter((column) => column !== hierarchyColumn.name);
    }

    if (!uncheckHierarchy && hierarchyColumns) {
      let targetIndex = formData[attr].length - 1;
      formData[attr].forEach((column, index) => {
        const alreadyApplied = hierarchyColumns.find((item) => item.name === column);
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
      result = [...formData[attr], hierarchyColumn.name];
    }
    result = _.uniq(result);
    const newFormData = {
      ...formData,
      groupby: attr === 'groupby' ? result : formData.groupby,
      columns: attr === 'columns' ? result : formData.columns,
      all_columns: attr === 'all_columns' ? result : formData.all_columns,
      filters: this.getAllFilters(
        [
          ...this.slice.formData.filters,
          ...(Array.isArray(periodFilters) ? periodFilters : [periodFilters]),
        ],
        newFilters
      ),
    };

        if (uncheckHierarchy) {
            newFormData.filters = newFormData.filters.filter(
                (f) => f.drillDownCol !== hierarchyColumn.name
            );
        }


        if (newFormData.viz_type === 'directed_force' && newFormData.groupby.length > 2) {
            const [originSource, originTarget] = formData.groupby;
            const newCol = newFormData.groupby.find((col) => formData.groupby.indexOf(col) === -1);

            if (this.options.type === COMMON) {
                const hierarchies = hierarchyColumns.map((col) => col.name);
                newFormData.groupby = [originSource, originTarget].map((c) =>
                    hierarchies.indexOf(c) !== -1 ? newCol : c
                );
            } else {
                newFormData.groupby =
          this.options.type === TARGET ? [originSource, newCol] : [newCol, originTarget];
            }

            // newFormData.filters = [...newFormData.filters.filter(f => f.col), ...filters]
        }

        const [datasourceId, datasourceType] = newFormData.datasource.split('__');

    try {
      const datasources = await fetchSliceDatasource(
        datasourceType,
        datasourceId
      );
      actions.saveSliceState(Number.parseInt(id, 10), hierarchyColumn.value, isChartFromDrilldown);
      actions.drilldownToSlice(
        chartKey,
        formData.slice_id,
        newFormData,
        datasources,
        isChartFromDrilldown
      );
    } catch (e) {
      showError(e);
    }
  }

  /**
   * Получить следующий столбец по иерархии относительно текущего
   *
   * @param {object} hierarchy Иерархия
   * @param {object} currentColumn Текущий столбец
   */
    getNextColumnByHierarchy(hierarchy, currentColumn) {
        const nextColumns = hierarchy.columns.filter(
            (item) => item.groupby && item.order > currentColumn.order
        );
        return nextColumns.length
            ? nextColumns.reduce((min, next) => (min.order < next.order ? min : next))
            : null;
    }
}
