# -*- coding: utf-8 -*-
"""Views used by the SqlAlchemy connector"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from datetime import datetime
from urllib.parse import quote

from babel.support import LazyProxy
from flask import flash, Markup, redirect, request, Response
from flask_appbuilder import CompactCRUDMixin, expose
from flask_appbuilder.actions import action
from flask_appbuilder.baseviews import log
from flask_appbuilder.models.filters import BaseFilter, FilterRelation
from flask_appbuilder.models.sqla.filters import get_field_setup_query
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import gettext as __
from flask_babel import lazy_gettext as _
from flask_login import current_user
from past.builtins import basestring

from superset import appbuilder, constants as const, db, security_manager, utils
from superset.connectors.base.views import DatasourceModelView
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import ChangeLog, Database
from superset.utils import has_access
from superset.views.base import (
    DatasourceFilter, DeleteMixin, get_datasource_exist_error_mgs,
    SupersetModelView, YamlExportMixin,
    UsedInSliceObjectMixin, UsedInTableObjectMixin,
    ListWidgetWithCheckboxesAndPerms, ListWidgetWithPerms)
from superset.views.permissions import PermissionMixin
from superset.views.utils import create_perm
from . import models


class TableColumnInlineView(CompactCRUDMixin, UsedInSliceObjectMixin, SupersetModelView):  # noqa
    datamodel = SQLAInterface(models.TableColumn)

    list_title = _('List Columns')
    show_title = _('Show Column')
    add_title = _('Add Column')
    edit_title = _('Edit Column')

    can_delete = False
    list_widget = ListWidgetWithCheckboxesAndPerms
    edit_columns = [
        'column_name', 'verbose_name', 'description',
        'type', 'is_filter_key', 'groupby', 'filterable', 'auto_upd_verbose_name',
        'table', 'count_distinct', 'sum', 'min', 'max', 'expression',
        'is_dttm', 'python_date_format', 'database_expression', 'group']
    add_columns = edit_columns
    list_columns = [
        'column_name', 'verbose_name', 'type', 'is_filter_key', 'groupby', 'filterable', 'fake_auto_upd_verbose_name', 'count_distinct',
        'sum', 'min', 'max', 'is_dttm', 'group']
    page_size = 500
    description_columns = {
        'is_dttm': _(
            'Whether to make this column available as a '
            '[Time Granularity] option, column has to be DATETIME or '
            'DATETIME-like'),
        'filterable': _(
            'Whether this column is exposed in the `Filters` section '
            'of the explore view.'),
        'avg': _(
            'Whether this column can be used in the Avg operation'
        ),
        'sum': _(
            'Whether this column can be used in the Sum operation'
        ),
        'min': _(
            'Whether this column can be used in the Min operation'
        ),
        'max': _(
            'Whether this column can be used in the Max operation'
        ),
        'count_distinct': _(
            'Whether this column can be used in the Count Distinct operation'
        ),
        'auto_upd_verbose_name': _('Update column verbose_name values automatically'),
        'type': _(
            'The data type that was inferred by the database. '
            'It may be necessary to input a type manually for '
            'expression-defined columns in some cases. In most case '
            'users should not need to alter this.'),
        'expression': LazyProxy(lambda: utils.markdown(_(
            'a valid, *non-aggregating* SQL expression as supported by the '
            'underlying backend. Example: `substr(name, 1, 1)`'), True)),
        'python_date_format': LazyProxy(lambda: utils.markdown(Markup(_(
            'The pattern of timestamp format, use '
            '<a href="https://docs.python.org/2/library/'
            'datetime.html#strftime-strptime-behavior">'
            'python datetime string pattern</a> '
            'expression. If time is stored in epoch '
            'format, put `epoch_s` or `epoch_ms`. Leave `Database Expression` '
            'below empty if timestamp is stored in '
            'String or Integer(epoch) type')), True)),
        'database_expression': LazyProxy(lambda: utils.markdown(_(
            'The database expression to cast internal datetime '
            'constants to database date/timestamp type according to the DBAPI. '
            'The expression should follow the pattern of '
            '%Y-%m-%d %H:%M:%S, based on different DBAPI. '
            'The string should be a python string formatter \n'
            "`Ex: TO_DATE('{}', 'YYYY-MM-DD HH24:MI:SS')` for Oracle "
            'Superset uses default expression based on DB URI if this '
            'field is blank.'), True)),
        'is_filter_key': _('The column will be used to limit the scope '
                           'of data visibility (in the parameters of each '
                           'individual user, a list of values available to '
                           'him can be specified)'),
    }
    description_columns['fake_auto_upd_verbose_name'] = description_columns['auto_upd_verbose_name']
    label_columns = {
        'column_name': _('Name'),
        'verbose_name': _('Verbose Name'),
        'description': _('Description'),
        'groupby': _('Groupable'),
        'filterable': _('Filterable'),
        'table': _('Table'),
        'count_distinct': _('Count Distinct'),
        'sum': _('Sum used'),
        'avg': _('Avg used'),
        'min': _('Min'),
        'max': _('Max'),
        'expression': _('Expression'),
        'is_dttm': _('Is temporal'),
        'auto_upd_verbose_name': _('Auto update verbose name'),
        'python_date_format': _('Datetime Format'),
        'database_expression': _('Database Expression'),
        'type': _('Type'),
        'is_filter_key': _('Filtering key'),
        'is_active': _('Is Active'),
        'hierarchies': _('Hierarchies'),
        'group': _('Column Group'),
        'changed_on': _('Changed on'),
        'created_on': _('Created on'),
        'changed_by': _('Changed by'),
        'created_by': _('Created by'),
    }
    label_columns['fake_auto_upd_verbose_name'] = label_columns['auto_upd_verbose_name']


appbuilder.add_view_no_menu(TableColumnInlineView)


class ComplexAggreationInlineView(SupersetModelView):
    datamodel = SQLAInterface(models.MetricComplexAggregation)
    list_columns = ['hier', 'aggregation_function', 'order']
    add_columns = ['metric', 'hier', 'aggregation_function', 'order', 'order_columns']
    edit_columns = ['metric', 'hier', 'aggregation_function', 'order', 'order_columns']

    label_columns = {
        'hier': _('Hier'),
        'aggregation_function': _('Aggregation function'),
        'order': _('Order'),
        'order_columns': _('Order Columns'),
    }

    list_title = _('List Metric Complex Aggregation')
    show_title = _('Show Metric Complex Aggregation')
    add_title = _('Add Metric Complex Aggregation')
    edit_title = _('Edit Metric Complex Aggregation')


appbuilder.add_view_no_menu(ComplexAggreationInlineView)


class SqlMetricInlineView(UsedInSliceObjectMixin, SupersetModelView):  # noqa
    datamodel = SQLAInterface(models.SqlMetric)
    list_title = _('List Metrics')
    show_title = _('Show Metric')
    add_title = _('Add Metric')
    edit_title = _('Edit Metric')
    list_columns = ['metric_name', 'verbose_name', 'metric_type', 'group']
    edit_columns = [
        'metric_name', 'description', 'verbose_name', 'metric_type',
        'expression', 'table', 'd3format', 'is_restricted', 'group']

    description_columns = {
        'expression': LazyProxy(lambda: utils.markdown(
            _('a valid, *aggregating* SQL expression as supported by the '
              'underlying backend. Example: `count(DISTINCT userid)`'), True)),
        'is_restricted': _('Whether the access to this metric is restricted '
                           'to certain roles. Only roles with the permission '
                           "'metric access on XXX (the name of this metric)' "
                           'are allowed to access this metric'),
        'd3format': LazyProxy(lambda: utils.markdown(
            _('d3 formatting string as defined [here](https://github.com/d3/d3-format/blob/master/README.md#format). '
              'For instance, this default formatting applies in the Table '
              'visualization and allow for different metric to use different formats'), True,
        )),
    }
    add_columns = edit_columns
    page_size = 500
    label_columns = {
        'metric_name': _('Metric'),
        'description': _('Description'),
        'verbose_name': _('Verbose Name'),
        'metric_type': _('Type'),
        'expression': _('SQL Expression'),
        'table': _('Table'),
        'group': _('Column Group'),
        'd3format': _('D3 Format'),
        'is_restricted': _('Is Restricted'),
        'warning_text': _('Warning Message'),
        'changed_on': _('Changed on'),
        'created_on': _('Created on'),
        'changed_by': _('Changed by'),
        'created_by': _('Created by'),
    }
    related_views = [ComplexAggreationInlineView]
    list_widget = ListWidgetWithPerms

    def post_add(self, metric):
        if metric.is_restricted:
            security_manager.merge_perm('metric_access', metric.get_perm())

    def post_update(self, metric):
        if metric.is_restricted:
            security_manager.merge_perm('metric_access', metric.get_perm())


appbuilder.add_view_no_menu(SqlMetricInlineView)


class FilterByHierTable(BaseFilter):
    def apply(self, query, value):
        pk = request.args.get('_flt_0_hier')
        hier = db.session.query(models.TableHierarchy).filter_by(id=pk).one()
        return query.filter(models.TableColumn.id.in_([c.id for c in hier.table.columns]))


class TableHierarchyColumnInlineView(SupersetModelView):
    datamodel = SQLAInterface(models.TableHierarchyColumn)
    list_columns = ['column', 'column_order']
    base_order = ('column_order', 'desc')
    add_columns = ['column', 'column_order', 'hier']
    edit_columns = ['column', 'column_order', 'hier']
    add_form_query_rel_fields = {'column': [['column_id', FilterByHierTable, None]]}
    edit_form_query_rel_fields = {'column': [['column_id', FilterByHierTable, None]]}

    label_columns = {
        'column': _('Column'),
        'column_order': _('Column Order'),
        'hier': _('Hier'),
    }

    list_title = _('List Table Hierarchy Column')
    show_title = _('Show Table Hierarchy Column')
    add_title = _('Add Table Hierarchy Column')
    edit_title = _('Edit Table Hierarchy Column')


appbuilder.add_view_no_menu(TableHierarchyColumnInlineView)


class TableHierarchyInlineView(SupersetModelView):
    datamodel = SQLAInterface(models.TableHierarchy)
    list_columns = ['hier_name', 'table', 'created_on', 'changed_on']
    add_columns = ['hier_name', 'table']
    edit_columns = ['hier_name', 'table']
    label_columns = {
        'hier_name': _('Name'),
        'table': _('Table'),
        'columns': _('Columns'),
        'changed_on': _('Changed on'),
        'created_on': _('Created on'),
    }
    base_order = ('hier_name', 'desc')
    related_views = [TableHierarchyColumnInlineView]

    list_title = _('List Table Hierarchy')
    show_title = _('Show Table Hierarchy')
    add_title = _('Add Table Hierarchy')
    edit_title = _('Edit Table Hierarchy')


appbuilder.add_view_no_menu(TableHierarchyInlineView)


class TableColumnGroup(UsedInTableObjectMixin, SupersetModelView):
    datamodel = SQLAInterface(models.TableColumnGroup)
    list_columns = ['title']
    add_columns = ['title']
    edit_columns = ['title']
    label_columns = {
        'title': _('Name')
    }

    list_title = _('List Table Column Group')
    show_title = _('Show Table Column Group')
    add_title = _('Add Table Column Group')
    edit_title = _('Edit Table Column Group')


appbuilder.add_view(TableColumnGroup, 'Column groups', category="Sources", icon='fa-columns')


class TableColumnFilterRelation(FilterRelation):
    def apply(self, query, value):
        '''
        :param query: sqlalchemy.orm.query.Query
        :param value: экземпляр .models.SqlaTable
        :return: sqlalchemy.orm.query.Query для TableColumn
        '''
        query, _ = get_field_setup_query(query, self.model, self.column_name)
        rel_obj = self.datamodel.get_related_obj(self.column_name, value)
        return rel_obj.get_columns_filter(query)


class SqlMetricFilterRelation(FilterRelation):
    def apply(self, query, value):
        '''
        :param query: sqlalchemy.orm.query.Query
        :param value: экземпляр .models.SqlaTable
        :return: sqlalchemy.orm.query.Query для SqlMetric
        '''
        query, _ = get_field_setup_query(query, self.model, self.column_name)
        rel_obj = self.datamodel.get_related_obj(self.column_name, value)
        return rel_obj.get_metrics_filter(query)


class TableModelViewFiltersMixin:
    # Замена дефолтных FilterRelationOneToManyEqual по типу
    # related_view : filter_class
    one_to_many_relation_filters = {
        TableColumnInlineView: TableColumnFilterRelation,
        SqlMetricInlineView: SqlMetricFilterRelation
    }

    def _get_related_view_widget(self, item, related_view,
                                 order_column='', order_direction='',
                                 page=None, page_size=None):
        """
        Переопределен для замены дефолтных FilterRelationOneToManyEqual,
        по словарю one_to_many_relation_filters
        """

        fk = related_view.datamodel.get_related_fk(self.datamodel.obj)
        filters = related_view.datamodel.get_filters()
        # Check if it's a many to one model relation
        if related_view.datamodel.is_relation_many_to_one(fk):
            filter_class = self.one_to_many_relation_filters.get(related_view.__class__)
            if filter_class is None:
                filters.add_filter_related_view(fk, self.datamodel.FilterRelationOneToManyEqual,
                                                self.datamodel.get_pk_value(item))
            else:
                filters.add_filter_related_view(fk, filter_class, self.datamodel.get_pk_value(item))
        # Check if it's a many to many model relation
        elif related_view.datamodel.is_relation_many_to_many(fk):
            filters.add_filter_related_view(fk, self.datamodel.FilterRelationManyToManyEqual,
                                            self.datamodel.get_pk_value(item))
        else:
            log.error("Can't find relation on related view {0}".format(related_view.name))
            return None
        return related_view._get_view_widget(filters=filters,
                                             order_column=order_column,
                                             order_direction=order_direction,
                                             page=page, page_size=page_size)


class TableModelView(PermissionMixin, TableModelViewFiltersMixin,
                     DatasourceModelView, DeleteMixin, YamlExportMixin):  # noqa
    datamodel = SQLAInterface(models.SqlaTable)

    list_title = _('List Tables')
    show_title = _('Show Table')
    add_title = _('Add Table')
    edit_title = _('Edit Table')

    list_columns = ['link', 'database', 'changed_by_', 'modified']
    order_columns = ['modified']
    add_columns = ['database', 'schema', 'table_name']
    edit_columns = [
        'table_name', 'sql', 'filter_select_enabled', 'slices',
        'fetch_values_predicate', 'database', 'schema',
        'description', 'owner',
        'main_dttm_col', 'default_endpoint', 'offset', 'cache_timeout']
    _show_columns = edit_columns + ['perm']
    related_views = [TableColumnInlineView, SqlMetricInlineView, TableHierarchyInlineView]
    base_order = ('changed_on', 'desc')
    search_columns = (
        'database', 'schema', 'table_name', 'owner',
    )
    description_columns = {
        'slices': _(
            'The list of slices associated with this table. By '
            'altering this datasource, you may change how these associated '
            'slices behave. '
            'Also note that slices need to point to a datasource, so '
            'this form will fail at saving if removing slices from a '
            'datasource. If you want to change the datasource for a slice, '
            "overwrite the slice from the 'explore view'"),
        'offset': _('Timezone offset (in hours) for this datasource'),
        'table_name': _(
            'Name of the table that exists in the source database'),
        'schema': _(
            'Schema, as used only in some databases like Postgres, Redshift '
            'and DB2'),
        'description': LazyProxy(lambda: Markup(
            _('Supports') + ' <a href="https://daringfireball.net/projects/markdown/">' + _('markdown') + '</a>')),
        'sql': _(
            'This fields acts a Superset view, meaning that Superset will '
            'run a query against this string as a subquery.',
        ),
        'fetch_values_predicate': _(
            'Predicate applied when fetching distinct value to '
            'populate the filter control component. Supports '
            'jinja template syntax. Applies only when '
            '`Enable Filter Select` is on.',
        ),
        'default_endpoint': _(
            'Redirects to this endpoint when clicking on the table '
            'from the table list'),
        'filter_select_enabled': _(
            "Whether to populate the filter's dropdown in the explore "
            "view's filter section with a list of distinct values fetched "
            'from the backend on the fly'),
    }
    base_filters = [['id', DatasourceFilter, lambda: []]]
    label_columns = {
        'slices': _('Associated Charts'),
        'link': _('Table'),
        'changed_by_': _('Changed By'),
        'change_log': _('Change log'),
        'database': _('Database'),
        'changed_on_': _('Last Changed'),
        'filter_select_enabled': _('Enable Filter Select'),
        'schema': _('Schema'),
        'default_endpoint': _('Default Endpoint'),
        'offset': _('Offset'),
        'cache_timeout': _('Cache Timeout'),
        'table_name': _('Table Name'),
        'fetch_values_predicate': _('Fetch Values Predicate'),
        'owner': _('Owner'),
        'main_dttm_col': _('Main Datetime Column'),
        'description': _('Description'),
        'perm': _('Permission'),
        'modified': _('Modified'),
    }
    base_permissions = const.TABLE_MODEL_VIEW_BASE_PERMISSIONS

    @property
    def show_columns(self):
        """ Скачивание логов будет отображаться только для пользователей, имеющих на это право """
        if current_user and self.appbuilder.sm.has_access(const.CAN_DOWNLOAD_CHANGELOG, self.__class__.__name__):
            return [*self._show_columns[:-1], 'change_log', *self._show_columns[-1:]]
        else:
            return self._show_columns

    def pre_add(self, table):
        with db.session.no_autoflush:
            table_query = db.session.query(models.SqlaTable).filter(
                models.SqlaTable.table_name == table.table_name,
                models.SqlaTable.schema == table.schema,
                models.SqlaTable.database_id == table.database.id)
            if db.session.query(table_query.exists()).scalar():
                raise Exception(
                    get_datasource_exist_error_mgs(table.full_name))

        # Fail before adding if the table can't be found
        if not table.database.has_table(table):
            raise Exception(_(
                'Table [{}] could not be found, '
                'please double check your '
                'database connection, schema, and '
                'table name').format(table.name))

    def post_add(self, table, flash_message=True):
        table.fetch_metadata()
        security_manager.merge_perm('datasource_access', table.get_perm())
        if table.schema:
            security_manager.merge_perm('schema_access', table.schema_perm)
        create_perm(table)

        if flash_message:
            flash(_(
                'The table was created. '
                'As part of this two phase configuration '
                'process, you should now click the edit button by '
                'the new table to configure it.'), 'info')

    def post_update(self, table):
        self.post_add(table, flash_message=False)

    def _delete(self, pk):
        DeleteMixin._delete(self, pk)

    @expose('/edit/<pk>', methods=['GET', 'POST'])
    @has_access
    def edit(self, pk):
        """Simple hack to redirect to explore view after saving"""
        resp = super(TableModelView, self).edit(pk)
        if isinstance(resp, basestring):
            return resp
        return redirect('/superset/explore/table/{}/'.format(pk))

    @action(
        'refresh',
        __('Refresh Metadata'),
        __('Refresh column metadata'),
        'fa-refresh')
    @has_access
    def refresh(self, tables):
        if not isinstance(tables, list):
            tables = [tables]
        ui_messages = set()  # Дополнительные информационные сообщения
        for t in tables:
            ui_messages |= t.fetch_metadata()
        msg = _(
            'Metadata refreshed for the following table(s): %(tables)s',
            tables=', '.join([t.table_name for t in tables]))
        [flash(text, level) for text, level in ((msg, 'info'), *ui_messages)]
        return redirect('/tablemodelview/list/')

    @expose('/<pk>/changelog', methods=['GET'])
    @has_access
    def download_changelog(self, pk):
        table_name, database_name = db.session.query(
            SqlaTable.table_name, Database.database_name
        ).filter(SqlaTable.id == pk).join(SqlaTable.database).first()
        query = db.session.query(ChangeLog).filter_by(table_id=pk).order_by('dttm').all()
        csv_data = ChangeLog.as_csv(query)
        today_str = datetime.today().strftime('%Y_%m_%d')
        filename = f'{today_str}_[{table_name}]_[{database_name}].csv'  # YYYY_MM_DD_[Название витрины]_[Название БД]
        headers = {
            'Content-Disposition': f'attachment; filename={quote(filename)}',
        }
        return Response(csv_data, mimetype='text/csv', headers=headers)


appbuilder.add_view(
    TableModelView,
    'Tables',
    label=__('Tables'),
    category='Sources',
    category_label=__('Sources'),
    icon='fa-table',
)

appbuilder.add_separator('Sources')
