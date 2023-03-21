# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from flask import g, redirect
from flask_appbuilder import expose
from flask_appbuilder.baseviews import expose_api
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access_api, \
    permission_name
from flask_babel import gettext as __
from flask_babel import lazy_gettext as _

from superset import appbuilder
from superset.models.sql_lab import Query, SavedQuery
from .base import BaseSupersetView, DeleteMixin, SupersetModelView, log_this


class QueryView(SupersetModelView, BaseSupersetView):
    datamodel = SQLAInterface(Query)
    list_columns = ['user', 'database', 'status', 'start_time', 'end_time']
    label_columns = {
        'user': _('User'),
        'database': _('Database'),
        'status': _('Status'),
        'start_time': _('Start Time'),
        'end_time': _('End Time'),
        'sql_editor_id': _('SQL editor ID'),
        'schema': _('Schema'),
        'results_key': _('Result keys'),
        'rows': _('Rows'),
        'limit': _('Limit'),
        'tracking_url': _('Tracking URL'),
        'tmp_table_name': _('Tmp table name'),
        'client_id': _('Client ID'),
        'progress': _('Progress'),
        'end_result_backend_time': _('End Result Backend Time'),
        'select_sql': _('Select SQL'),
        'error_message': _('Error message'),
        'sql': _('SQL'),
        'start_running_time': _('Start running time'),
        'executed_sql': _('Executed SQL'),
        'tab_name': _('Tab name'),
        'changed_on': _('Changed on'),
        'select_as_cta': _('Select As Cta'),
        'limit_used': _('Limit Used'),
        'select_as_cta_used': _('Select As Cta Used'),
    }

    list_title = _('List Query')
    show_title = _('Show Query')
    add_title = _('Add Query')
    edit_title = _('Edit Query')


appbuilder.add_view(
    QueryView,
    'Queries',
    label=__('Queries'),
    category='Manage',
    category_label=__('Manage'),
    icon='fa-search')


class SavedQueryView(SupersetModelView, DeleteMixin, BaseSupersetView):
    datamodel = SQLAInterface(SavedQuery)

    list_title = _('List Saved Query')
    show_title = _('Show Saved Query')
    add_title = _('Add Saved Query')
    edit_title = _('Edit Saved Query')

    list_columns = ['id', 'label', 'user', 'database', 'schema', 'description', 'modified', 'pop_tab_link', 'for_iam']
    show_columns = ['id', 'label', 'user', 'database', 'description', 'sql', 'pop_tab_link', 'for_iam']
    search_columns = ('id', 'label', 'user', 'database', 'schema', 'changed_on', 'for_iam')
    add_columns = ['label', 'database', 'description', 'sql', 'for_iam']
    edit_columns = add_columns
    base_order = ('changed_on', 'desc')
    label_columns = {
        'label': _('Query name'),
        'user': _('User'),
        'database': _('Database'),
        'description': _('Description'),
        'modified': _('Modified'),
        'end_time': _('End Time'),
        'pop_tab_link': _('Pop Tab Link'),
        'changed_on': _('Changed on'),
        'schema': _('Schema'),
        'for_iam': _('For IAM'),
    }

    def pre_add(self, obj):
        obj.user = g.user

    def pre_update(self, obj):
        self.pre_add(obj)


class SavedQueryViewApi(SavedQueryView, BaseSupersetView):
    show_columns = ['label', 'db_id', 'schema', 'description', 'sql', 'for_iam']
    add_columns = show_columns
    edit_columns = add_columns

    @log_this
    @expose_api(name='create', url='/api/create', methods=['POST'])
    @has_access_api
    @permission_name('add')
    def api_create(self):
        return super().api_create()

    @log_this
    @expose_api(name='get', url='/api/get/<pk>', methods=['GET'])
    @has_access_api
    @permission_name('show')
    def api_get(self, pk):
        return super().api_get(pk)


appbuilder.add_view_no_menu(SavedQueryViewApi)
appbuilder.add_view_no_menu(SavedQueryView)

appbuilder.add_link(
    __('Saved Queries'),
    href='/sqllab/my_queries/',
    icon='fa-save',
    category='SQL Lab')


class SqlLab(BaseSupersetView):
    """The base views for Superset!"""
    @expose('/my_queries/')
    def my_queries(self):
        """Assigns a list of found users to the given role."""
        return redirect(
            '/savedqueryview/list/')


appbuilder.add_view_no_menu(SqlLab)
