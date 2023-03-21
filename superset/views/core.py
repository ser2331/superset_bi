# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import codecs
import json
import logging
import os
import re
import tempfile
import time
import traceback
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from io import BytesIO
from urllib import parse

import chardet
import requests
import sqlalchemy as sqla
from babel.support import LazyProxy
from flask import (
    flash, g, Markup, redirect, render_template, request, Response, url_for,
    send_file)
from flask_appbuilder import expose, SimpleFormView
from flask_appbuilder.actions import action
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access_api
from flask_babel import gettext as __
from flask_babel import lazy_gettext as _
from six import text_type
from sqlalchemy import create_engine, or_, text, String
from sqlalchemy.exc import IntegrityError
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm.exc import NoResultFound
from sqlalchemy.sql import select, func
from unidecode import unidecode
from werkzeug.routing import BaseConverter
from werkzeug.utils import secure_filename

import superset.models.core as models
from superset import (
    app, appbuilder, cache, db, results_backend, security_manager, sql_lab,
    utils,
    viz, conf
)
from superset.config import PATH_TO_CHROME_EXE, URL_TO_RENDER_PDF
from superset.connectors.base.models import BaseColumn
from superset.connectors.connector_registry import ConnectorRegistry
from superset.connectors.sqla.models import AnnotationDatasource, SqlaTable, \
    TableHierarchy, TableHierarchyColumn, TableColumn, SqlMetric
from superset.constants import CAN_EDIT, CAN_CONFIG, CAN_FAVSTAR, \
    CAN_FORCE_UPDATE, \
    CAN_DASHBOARD, CAN_DOWNLOAD, CAN_ADD, DATABASE_PERMISSIONS, \
    SLICE_MODEL_VIEW_BASE_PERMISSIONS, DASHBOARD_MODEL_VIEW_BASE_PERMISSIONS, \
    SLICE_DASH_PERMISSIONS, CAN_EXPLORE
from superset.exceptions import SupersetException, SupersetSecurityException
from superset.forms import CsvToDatabaseForm
from superset.jinja_context import get_template_processor
from superset.legacy import cast_form_data
from superset.models.sql_lab import Query
from superset.sql_parse import SupersetQuery
from superset.utils import (
    merge_extra_filters, merge_request_params, QueryStatus,
    ChromePDF)
from superset.views.folders import FoldersApiMixin, FoldersMixin
from superset.views.permissions import PermissionMixin
from superset.tasks import async_dashboard
from .base import (
    api, BaseSupersetView, CsvResponse, DeleteMixin,
    generate_download_headers, get_error_msg, get_user_roles,
    json_error_response, SupersetFilter, SupersetModelView, YamlExportMixin,
)
from .utils import bootstrap_user_data, create_perm, get_metric_expr
from ..models.helpers import get_query_result
from ..utils import has_access

config = app.config
stats_logger = config.get('STATS_LOGGER')
log_this = models.Log.log_this
DAR = models.DatasourceAccessRequest

UTC_OFFSET = datetime.now(timezone.utc).astimezone().utcoffset().seconds // 60 // 60

ALL_DATASOURCE_ACCESS_ERR = __(
    'This endpoint requires the `all_datasource_access` permission')
DATASOURCE_MISSING_ERR = __('The datasource seems to have been deleted')
ACCESS_REQUEST_MISSING_ERR = __(
    'The access requests seem to have been deleted')
USER_MISSING_ERR = __('The user seems to have been deleted')
perms_instruction_link = config.get('PERMISSION_INSTRUCTIONS_LINK')
if perms_instruction_link:
    DATASOURCE_ACCESS_ERR = __(
        "You don't have access to this datasource. <a href='{}'>(Gain access)</a>"
            .format(perms_instruction_link),
    )
else:
    DATASOURCE_ACCESS_ERR = __("You don't have access to this datasource")

# YANDEX_MAP_VISUALIZATIONS = {BubbleMapVisualization.viz_type, YandexHeatMapVisualization.viz_type}

FORM_DATA_KEY_BLACKLIST = []
if not config.get('ENABLE_JAVASCRIPT_CONTROLS'):
    FORM_DATA_KEY_BLACKLIST = [
        'js_tooltip',
        'js_onclick_href',
        'js_data_mutator',
    ]


def get_database_access_error_msg(database_name):
    return __('This view requires the database %(name)s or '
              '`all_datasource_access` permission', name=database_name)


def get_datasource_access_error_msg(datasource_name):
    return __('This endpoint requires the datasource %(name)s, database or '
              '`all_datasource_access` permission', name=datasource_name)


def json_success(json_msg, status=200):
    return Response(json_msg, status=status, mimetype='application/json')


def is_owner(obj, user):
    """ Check if user is owner of the slice """
    return obj and user in obj.owners


def check_ownership(obj, raise_if_false=True):
    """Meant to be used in `pre_update` hooks on models to enforce ownership

    Admin have all access, and other users need to be referenced on either
    the created_by field that comes with the ``AuditMixin``, or in a field
    named ``owners`` which is expected to be a one-to-many with the User
    model. It is meant to be used in the ModelView's pre_update hook in
    which raising will abort the update.
    """
    if not obj:
        return False

    security_exception = SupersetSecurityException(
        "You don't have the rights to alter [{}]".format(obj))

    if g.user.is_anonymous():
        if raise_if_false:
            raise security_exception
        return False
    roles = (r.name for r in get_user_roles())
    if 'Admin' in roles:
        return True
    session = db.create_scoped_session()
    orig_obj = session.query(obj.__class__).filter_by(id=obj.id).first()
    owner_names = (user.username for user in orig_obj.owners)
    if (
            hasattr(orig_obj, 'created_by') and
            orig_obj.created_by and
            orig_obj.created_by.username == g.user.username):
        return True
    if (
            hasattr(orig_obj, 'owners') and
            g.user and
            hasattr(g.user, 'username') and
            g.user.username in owner_names):
        return True
    if raise_if_false:
        raise security_exception
    else:
        return False


def user_is_admin():
    roles = (r.name for r in get_user_roles())
    return 'Admin' in roles


class SliceFilter(SupersetFilter):
    def apply(self, query, func):  # noqa
        if user_is_admin():
            return query

        Slice = models.Slice

        allow_slice_ids = []
        for slice in query:
            if not isinstance(slice, Slice):
                return query
            elif security_manager.item_has_access(slice, view_name=Superset.__name__):
                allow_slice_ids.append(slice.id)

        allowed_slc_query = query.filter(Slice.id.in_(allow_slice_ids))
        if g.user.is_anonymous():
            return allowed_slc_query.distinct()
        elif not self.has_all_datasource_access():
            perms = self.get_view_menus('datasource_access')
            query = allowed_slc_query.filter(Slice.perm.in_(perms))
            return query.distinct()
        owners_query = query.filter(self.model.owners.contains(g.user))
        query = owners_query.union_all(allowed_slc_query).distinct()
        return query


class DashboardFilter(SupersetFilter):
    """List dashboards for which users have access"""

    def apply(self, query, func):  # noqa
        if user_is_admin():
            return query

        # Slice = models.Slice  # noqa
        Dash = models.Dashboard  # noqa
        # slice_ids_qry = None

        # if not self.has_all_datasource_access():
        #     perms = self.get_view_menus('datasource_access')
        #     allow_slice_ids = []
        #     for slice in query:
        #         if (
        #                 isinstance(slice, Slice) and
        #                 security_manager.item_has_access(
        #                     slice, view_name=SliceModelView.__name__)
        #         ):
        #             allow_slice_ids.append(slice.id)
        #     slice_ids_qry = (
        #         db.session.query(Slice.id).filter(
        #             Slice.id.in_(allow_slice_ids)
        #         ).filter(Slice.perm.in_(perms))
        #     )
        # if slice_ids_qry:
        #     query = query.filter(
        #         Dash.id.in_(
        #             db.session.query(Dash.id).distinct().filter(Slice.id.in_(slice_ids_qry)),
        #         ),
        #     )
        allow_dash_ids = list()
        for dash in query:
            if not isinstance(dash, Dash):
                return query.distinct()
            if security_manager.item_has_access(dash, CAN_DASHBOARD, view_name=DashboardModelView.__name__):
                allow_dash_ids.append(dash.id)
        if g.user.is_anonymous():
            return query.filter(Dash.id.in_(allow_dash_ids)).distinct()
        dash_owners_query = query.filter(self.model.owners.contains(g.user))
        dash_allowed_query = query.filter(Dash.id.in_(allow_dash_ids))
        query = dash_owners_query.union_all(dash_allowed_query)
        return query.distinct()


class DatabaseView(PermissionMixin, SupersetModelView, DeleteMixin, YamlExportMixin):  # noqa
    datamodel = SQLAInterface(models.Database)

    list_title = _('List Databases')
    show_title = _('Show Database')
    add_title = _('Add Database')
    edit_title = _('Edit Database')

    list_columns = [
        'database_name', 'backend', 'allow_run_sync', 'allow_run_async',
        'allow_dml', 'creator', 'modified']
    order_columns = [
        'database_name', 'allow_run_sync', 'allow_run_async', 'allow_dml',
        'modified',
    ]
    add_columns = [
        'database_name', 'sqlalchemy_uri', 'cache_timeout', 'extra',
        'expose_in_sqllab', 'allow_run_sync', 'allow_run_async',
        'allow_ctas', 'allow_dml', 'force_ctas_schema', 'impersonate_user',
        'allow_multi_schema_metadata_fetch',
    ]
    search_exclude_columns = (
        'password', 'tables', 'created_by', 'changed_by', 'queries',
        'saved_queries')
    edit_columns = add_columns
    show_columns = [
        'tables',
        'cache_timeout',
        'extra',
        'database_name',
        'sqlalchemy_uri',
        'perm',
        'created_by',
        'created_on',
        'changed_by',
        'changed_on',
    ]
    add_template = 'superset/models/database/add.html'
    edit_template = 'superset/models/database/edit.html'
    base_order = ('changed_on', 'desc')
    description_columns = {
        'sqlalchemy_uri': LazyProxy(lambda: utils.markdown(_(
            'Refer to the '
            '[SqlAlchemy docs]'
            '(http://docs.sqlalchemy.org/en/rel_1_0/core/engines.html#'
            'database-urls) '
            'for more information on how to structure your URI.'), True)),
        'expose_in_sqllab': _('Expose this DB in SQL Lab'),
        'allow_run_sync': _(
            'Allow users to run synchronous queries, this is the default '
            'and should work well for queries that can be executed '
            'within a web request scope (<~1 minute)'),
        'allow_run_async': _(
            'Allow users to run queries, against an async backend. '
            'This assumes that you have a Celery worker setup as well '
            'as a results backend.'),
        'allow_ctas': _('Allow CREATE TABLE AS option in SQL Lab'),
        'allow_dml': _(
            'Allow users to run non-SELECT statements '
            '(UPDATE, DELETE, CREATE, ...) '
            'in SQL Lab'),
        'force_ctas_schema': _(
            'When allowing CREATE TABLE AS option in SQL Lab, '
            'this option forces the table to be created in this schema'),
        'extra': LazyProxy(lambda: utils.markdown(_(
            'JSON string containing extra configuration elements. '
            'The ``engine_params`` object gets unpacked into the '
            '[sqlalchemy.create_engine]'
            '(http://docs.sqlalchemy.org/en/latest/core/engines.html#'
            'sqlalchemy.create_engine) call, while the ``metadata_params`` '
            'gets unpacked into the [sqlalchemy.MetaData]'
            '(http://docs.sqlalchemy.org/en/rel_1_0/core/metadata.html'
            '#sqlalchemy.schema.MetaData) call.'), True)),
        'impersonate_user': _(
            'If Presto, all the queries in SQL Lab are going to be executed as the '
            'currently logged on user who must have permission to run them.<br/>'
            'If Hive and hive.server2.enable.doAs is enabled, will run the queries as '
            'service account, but impersonate the currently logged on user '
            'via hive.server2.proxy.user property.'),
        'allow_multi_schema_metadata_fetch': _(
            'Allow SQL Lab to fetch a list of all tables and all views across '
            'all database schemas. For large data warehouse with thousands of '
            'tables, this can be expensive and put strain on the system.'),
    }
    label_columns = {
        'expose_in_sqllab': _('Expose in SQL Lab'),
        'allow_ctas': _('Allow CREATE TABLE AS'),
        'allow_dml': _('Allow DML'),
        'force_ctas_schema': _('CTAS Schema'),
        'database_name': _('Database'),
        'creator': _('Creator'),
        'changed_on': _('Changed on'),
        'changed_by': _('Changed by'),
        'created_by': _('Created by'),
        'tables': _('Tables'),
        'backend': _('Backend'),
        'modified': _('Modified'),
        'created_on': _('Created on'),
        'sqlalchemy_uri': _('SQLAlchemy URI'),
        'cache_timeout': _('Cache Timeout'),
        'extra': _('Extra'),
        'allow_run_sync': _('Allow Run Sync'),
        'allow_run_async': _('Allow Run Async'),
        'impersonate_user': _('Impersonate the logged on user'),
        'perm': _('Permission'),
        'verbose_name': _('Verbose Name'),
        'allow_multi_schema_metadata_fetch': _('Allow Multi Schema Metadata Fetch'),
    }

    def pre_add(self, db):
        db.set_sqlalchemy_uri(db.sqlalchemy_uri)
        security_manager.merge_perm('database_access', db.perm)
        try:
            for schema in db.all_schema_names():
                security_manager.merge_perm(
                    'schema_access', security_manager.get_schema_perm(db, schema))
        except Exception as exc:
            raise utils.sub_message_connection_error(exc)

    def post_add(self, db):
        """Создаем разрешения для нового объекта."""
        create_perm(db)

    def pre_update(self, db):
        self.pre_add(db)

    def pre_delete(self, obj):
        """Удаляем связанные с объектом разрешения."""
        check_ownership(obj)
        for perm in DATABASE_PERMISSIONS:
            security_manager.del_permission_view_menu(perm, obj.get_perm())
        security_manager.del_view_menu(obj.get_perm())

    def _delete(self, pk):
        DeleteMixin._delete(self, pk)


appbuilder.add_link(
    'Import Dashboards',
    label=__('Import Dashboards'),
    href='/superset/import_dashboards',
    icon='fa-cloud-upload',
    category='Manage',
    category_label=__('Manage'),
    category_icon='fa-wrench')

appbuilder.add_view(
    DatabaseView,
    'Databases',
    label=__('Databases'),
    icon='fa-database',
    category='Sources',
    category_label=__('Sources'),
    category_icon='fa-database')


class DatabaseAsync(DatabaseView):
    list_columns = [
        'id', 'database_name',
        'expose_in_sqllab', 'allow_ctas', 'force_ctas_schema',
        'allow_run_async', 'allow_run_sync', 'allow_dml',
        'allow_multi_schema_metadata_fetch',
    ]


appbuilder.add_view_no_menu(DatabaseAsync)


class CSVFailException(Exception):
    pass


class CsvToDatabaseView(SimpleFormView):
    form = CsvToDatabaseForm
    form_title = _('CSV to Database configuration')
    add_columns = ['database', 'schema', 'table_name']

    def form_get(self, form):
        form.sep.data = ';'
        form.header.data = 0
        form.mangle_dupe_cols.data = True
        form.skipinitialspace.data = False
        form.skip_blank_lines.data = True
        form.infer_datetime_format.data = True
        form.decimal.data = '.'

    @staticmethod
    def get_file_encoding(file_path):
        """Определяет кодировку по содержимому файла по первым 5 Кб.
        (чтобы не считывать весь файл)"""
        with open(file_path, 'rb') as f:
            return chardet.detect(f.read(10240))['encoding']

    def form_post(self, form):
        csv_file = form.csv_file.data
        form.csv_file.data.filename = secure_filename(form.csv_file.data.filename)
        csv_filename = form.csv_file.data.filename
        load_method = form.if_exists.data
        table = None
        try:
            query = db.session.query(SqlaTable.id).join(models.Database).filter(
                SqlaTable.table_name == form.name.data,
                models.Database.database_name == form.con.data.database_name)
            table_id = query.scalar()
            if table_id:
                if load_method == 'append':
                    table = db.session.query(SqlaTable).filter(
                        SqlaTable.id == table_id).scalar()
                elif load_method == 'replace':
                    db.session.query(SqlMetric).filter(SqlMetric.table_id == table_id).delete()
                    db.session.query(TableColumn).filter(TableColumn.table_id == table_id).delete()
                    db.session.query(SqlaTable).filter(SqlaTable.id == table_id).delete()
                else:
                    raise CSVFailException
            csv_file.save(os.path.join(config['UPLOAD_FOLDER'], csv_filename))
            file_encoding = self.get_file_encoding(os.path.join(config['UPLOAD_FOLDER'], csv_filename))
            if not table:
                table = SqlaTable(table_name=form.name.data)
                table.database = form.data.get('con')
                table.database_id = table.database.id
            table.database.db_engine_spec.create_table_from_csv(form, table, encoding=file_encoding)
        except Exception as e:
            try:
                os.remove(os.path.join(config['UPLOAD_FOLDER'], csv_filename))
            except OSError:
                pass
            message = _('Table name {} already exists. Please pick another').format(
                form.name.data) if isinstance(e, (IntegrityError, CSVFailException)) else text_type(e)
            flash(
                message,
                'danger')
            return redirect('/csvtodatabaseview/form')

        os.remove(os.path.join(config['UPLOAD_FOLDER'], csv_filename))
        # Go back to welcome page / splash screen
        db_name = table.database.database_name
        message = _('CSV file "{0}" uploaded to table "{1}" in database "{2}"').format(
            csv_filename, form.name.data, db_name
        )
        flash(message, 'info')
        return redirect('/tablemodelview/list/')

    @log_this
    @expose("/form", methods=['POST'])
    @has_access
    def this_form_post(self):
        return super().this_form_post()


appbuilder.add_view_no_menu(CsvToDatabaseView)


class DatabaseTablesAsync(DatabaseView):
    list_columns = ['id', 'all_table_names', 'all_schema_names']


appbuilder.add_view_no_menu(DatabaseTablesAsync)

if config.get('ENABLE_ACCESS_REQUEST'):
    class AccessRequestsModelView(SupersetModelView, DeleteMixin):
        datamodel = SQLAInterface(DAR)
        list_columns = [
            'username', 'user_roles', 'datasource_link',
            'roles_with_datasource', 'created_on']
        order_columns = ['created_on']
        base_order = ('changed_on', 'desc')
        label_columns = {
            'username': _('User'),
            'user_roles': _('User Roles'),
            'database': _('Database URL'),
            'datasource_link': _('Datasource'),
            'roles_with_datasource': _('Roles to grant'),
            'created_on': _('Created On'),
        }


    appbuilder.add_view(
        AccessRequestsModelView,
        'Access requests',
        label=__('Access requests'),
        category='Security',
        category_label=__('Security'),
        icon='fa-table')


class SliceModelView(
    FoldersMixin, PermissionMixin,
    SupersetModelView, DeleteMixin, BaseSupersetView
):  # noqa

    datamodel = SQLAInterface(models.Slice)
    folder_model = models.SliceFolders

    list_template = 'appbuilder/general/model/list_with_folders.html'

    list_title = _('List Charts')
    show_title = _('Show Chart')
    add_title = _('Add Chart')
    edit_title = _('Edit Chart')

    can_add = False
    search_columns = (
        'slice_name', 'description', 'viz_type', 'datasource_name', 'owners',
    )
    list_columns = [
        'slice_link', 'viz_type', 'datasource_link', 'creator', 'modified']
    order_columns = ['viz_type', 'datasource_link', 'modified']
    edit_columns = [
        'slice_name', 'description', 'viz_type', 'owners', 'dashboards',
        'params', 'cache_timeout', 'folder']
    base_order = ('changed_on', 'desc')
    description_columns = {
        'description': LazyProxy(lambda: Markup(_(
            'The content here can be displayed as widget headers in the '
            'dashboard view. Supports '
            '<a href="https://daringfireball.net/projects/markdown/">'
            'markdown</a>'))),
        'params': _(
            'These parameters are generated dynamically when clicking '
            'the save or overwrite button in the explore view. This JSON '
            'object is exposed here for reference and for power users who may '
            'want to alter specific parameters.',
        ),
        'cache_timeout': _(
            'Duration (in seconds) of the caching timeout for this slice.'),
    }
    base_filters = [['id', SliceFilter, lambda: []]]
    label_columns = {
        'cache_timeout': _('Cache Timeout'),
        'creator': _('Creator'),
        'dashboards': _('Dashboards'),
        'datasource_link': _('Datasource'),
        'datasource_name': _('Datasource Name'),
        'datasource_type': _('Datasource Type'),
        'datasource_id': _('Datasource Id'),
        'description': _('Description'),
        'modified': _('Last Modified'),
        'owners': _('Owners'),
        'params': _('Parameters'),
        'slice_link': _('Chart'),
        'slice_name': _('Name'),
        'table': _('Table'),
        'changed_on': _('Changed on'),
        'changed_by': _('Changed by'),
        'created_by': _('Created by'),
        'created_on': _('Created on'),
        'perm': _('Permission'),
        'viz_type': _('Visualization Type'),
        'folder': _('Folder'),
    }
    base_permissions = SLICE_MODEL_VIEW_BASE_PERMISSIONS

    def pre_add(self, obj):
        utils.validate_json(obj.params)

    def post_add(self, slice):
        security_manager.add_view_menu(slice.get_perm())
        create_perm(slice)

    def pre_update(self, obj):
        utils.validate_json(obj.params)
        check_ownership(obj)

    def _delete(self, pk):
        DeleteMixin._delete(self, pk)

    @expose('/add', methods=['GET', 'POST'])
    @has_access
    def add(self):
        datasources = ConnectorRegistry.get_all_datasources(db.session)
        datasources = [
            {'value': str(d.id) + '__' + d.type, 'label': repr(d)}
            for d in datasources
        ]
        return self.render_template(
            'superset/add_slice.html',
            bootstrap_data=json.dumps({
                'datasources': sorted(datasources, key=lambda d: d['label']),
                'common': self.common_bootsrap_payload()
            }),
        )


appbuilder.add_view(
    SliceModelView,
    'Charts',
    label=__('Charts'),
    icon='fa-bar-chart',
    category='',
    category_icon='')


class SliceAsync(SliceModelView):  # noqa
    list_columns = [
        'id', 'slice_link', 'viz_type', 'slice_name',
        'creator', 'modified', 'icons']
    label_columns = {
        'icons': ' ',
        'slice_link': _('Chart'),
    }


appbuilder.add_view_no_menu(SliceAsync)


class SliceAddView(SliceModelView):  # noqa
    list_columns = [
        'id', 'slice_name', 'slice_link', 'viz_type',
        'datasource_link', 'owners', 'modified', 'changed_on']
    show_columns = list(set(SliceModelView.edit_columns + list_columns))
    base_filters = [['id', SliceFilter, lambda: []]]


appbuilder.add_view_no_menu(SliceAddView)


class DashboardModelView(
    FoldersMixin, PermissionMixin, SupersetModelView,
    DeleteMixin, BaseSupersetView
):  # noqa
    datamodel = SQLAInterface(models.Dashboard)
    folder_model = models.DashboardFolders

    list_template = 'appbuilder/general/model/list_with_folders.html'

    list_title = _('List Dashboards')
    show_title = _('Show Dashboard')
    add_title = _('Add Dashboard')
    edit_title = _('Edit Dashboard')

    list_columns = ['dashboard_link', 'creator', 'modified']
    order_columns = ['modified']
    edit_columns = [
        'dashboard_title', 'slug', 'slices', 'owners', 'position_json', 'css',
        'json_metadata', 'folder', ]
    show_columns = edit_columns + ['table_names']
    search_columns = ('dashboard_title', 'slug', 'owners')
    add_columns = edit_columns
    base_order = ('changed_on', 'desc')
    description_columns = {
        'position_json': _(
            'This json object describes the positioning of the widgets in '
            'the dashboard. It is dynamically generated when adjusting '
            'the widgets size and positions by using drag & drop in '
            'the dashboard view'),
        'css': _(
            'The css for individual dashboards can be altered here, or '
            'in the dashboard view where changes are immediately '
            'visible'),
        'slug': _('To get a readable URL for your dashboard'),
        'json_metadata': _(
            'This JSON object is generated dynamically when clicking '
            'the save or overwrite button in the dashboard view. It '
            'is exposed here for reference and for power users who may '
            'want to alter specific parameters.'),
        'owners': _('Owners is a list of users who can alter the dashboard.'),
    }
    base_filters = [['slice', DashboardFilter, lambda: []]]
    add_form_query_rel_fields = {
        'slices': [['slices', SliceFilter, None]],
    }
    edit_form_query_rel_fields = add_form_query_rel_fields
    label_columns = {
        'dashboard_link': _('Dashboard'),
        'dashboard_title': _('Title'),
        'slug': _('Slug'),
        'slices': _('Charts'),
        'owners': _('Owners'),
        'creator': _('Creator'),
        'modified': _('Modified'),
        'position_json': _('Position JSON'),
        'css': _('CSS'),
        'json_metadata': _('JSON Metadata'),
        'table_names': _('Underlying Tables'),
        'folder': _('Folder'),
    }
    base_permissions = DASHBOARD_MODEL_VIEW_BASE_PERMISSIONS

    def pre_add(self, obj):
        obj.slug = obj.slug.strip() or None
        if obj.slug:
            obj.slug = obj.slug.replace(' ', '-')
            obj.slug = re.sub(r'[^\w\-]+', '', obj.slug)
        if g.user not in obj.owners:
            obj.owners.append(g.user)
        utils.validate_json(obj.json_metadata)
        utils.validate_json(obj.position_json)
        owners = [o for o in obj.owners]
        for slc in obj.slices:
            slc.owners = list(set(owners) | set(slc.owners))

    def post_add(self, dashboard):
        security_manager.add_view_menu(dashboard.get_perm())
        create_perm(dashboard)

    def pre_update(self, obj):
        check_ownership(obj)
        self.pre_add(obj)

    def _delete(self, pk):
        DeleteMixin._delete(self, pk)

    @action('mulexport', __('Export'), __('Export dashboards?'), 'fa-database')
    @has_access
    def mulexport(self, items):
        if not isinstance(items, list):
            items = [items]
        ids = ''.join('&id={}'.format(d.id) for d in items)
        return redirect(
            '/dashboardmodelview/export_dashboards_form?{}'.format(ids[1:]))

    @expose('/export_dashboards_form')
    def download_dashboards(self):
        if request.args.get('action') == 'go':
            ids = request.args.getlist('id')
            return Response(
                models.Dashboard.export_dashboards(ids),
                headers=generate_download_headers('json'),
                mimetype='application/text')
        return self.render_template(
            'superset/export_dashboards.html',
            dashboards_url='/dashboardmodelview/list',
        )

    def _get_add_widget(self, form, exclude_cols=None, widgets=None):
        from .folders import ROOT_FOLDER_ID
        folder_id = request.args.get('folder_id')
        if folder_id and folder_id != ROOT_FOLDER_ID:
            form.folder.data = db.session.query(self.folder_model
                                                ).get(int(folder_id))
        widgets = super()._get_add_widget(form, exclude_cols, widgets)
        return widgets


appbuilder.add_view(
    DashboardModelView,
    'Dashboards',
    label=__('Dashboards'),
    icon='fa-dashboard',
    category='',
    category_icon='')


class DashboardModelViewAsync(DashboardModelView):  # noqa
    list_columns = [
        'id', 'dashboard_link', 'creator', 'modified', 'dashboard_title',
        'changed_on', 'url', 'changed_by_name',
    ]
    label_columns = {
        'dashboard_link': _('Dashboard'),
        'dashboard_title': _('Title'),
        'creator': _('Creator'),
        'modified': _('Modified'),
    }


appbuilder.add_view_no_menu(DashboardModelViewAsync)


class DashboardAddView(DashboardModelView):  # noqa
    list_columns = [
        'id', 'dashboard_link', 'creator', 'modified', 'dashboard_title',
        'changed_on', 'url', 'changed_by_name',
    ]
    show_columns = list(set(DashboardModelView.edit_columns + list_columns))


appbuilder.add_view_no_menu(DashboardAddView)


class LogModelView(SupersetModelView):
    datamodel = SQLAInterface(models.Log)
    list_columns = ('user', 'action', 'dttm')
    edit_columns = ('user', 'action', 'dttm', 'json')
    base_order = ('dttm', 'desc')
    label_columns = {
        'user': _('User'),
        'action': _('Action'),
        'dttm': _('dttm'),
        'json': _('JSON'),
        'slice_id': _('Slice ID'),
        'dashboard_id': _('Dashboard ID'),
        'duration_ms': _('Duration Ms'),
    }

    list_title = _('List Log')
    show_title = _('Show Log')
    add_title = _('Add Log')
    edit_title = _('Edit Log')


appbuilder.add_view(
    LogModelView,
    'Action Log',
    label=__('Action Log'),
    category='Security',
    category_label=__('Security'),
    icon='fa-list-ol')


@app.route('/health')
def health():
    return 'OK'


@app.route('/healthcheck')
def healthcheck():
    return 'OK'


@app.route('/ping')
def ping():
    return 'OK'


class KV(BaseSupersetView):
    """Used for storing and retrieving key value pairs"""

    @log_this
    @expose('/store/', methods=['POST'])
    def store(self):
        try:
            value = request.form.get('data')
            obj = models.KeyValue(value=value)
            db.session.add(obj)
            db.session.commit()
        except Exception as e:
            return json_error_response(e)
        return Response(
            json.dumps({'id': obj.id}),
            status=200)

    @log_this
    @expose('/<key_id>/', methods=['GET'])
    def get_value(self, key_id):
        kv = None
        try:
            kv = db.session.query(models.KeyValue).filter_by(id=key_id).one()
        except Exception as e:
            return json_error_response(e)
        return Response(kv.value, status=200)


appbuilder.add_view_no_menu(KV)


class R(BaseSupersetView):
    """used for short urls"""

    @log_this
    @expose('/<url_id>')
    def index(self, url_id):
        url = db.session.query(models.Url).filter_by(id=url_id).first()
        if url:
            return redirect('/' + url.url)
        else:
            flash('URL to nowhere...', 'danger')
            return redirect('/')

    @log_this
    @expose('/shortner/', methods=['POST', 'GET'])
    def shortner(self):
        url = request.form.get('data')
        directory = url.split('?')[0][2:]
        obj = models.Url(url=url)
        db.session.add(obj)
        db.session.commit()
        return ('http://{request.headers[Host]}/{directory}?r={obj.id}'.format(
            request=request, directory=directory, obj=obj))

    @expose('/msg/')
    def msg(self):
        """Redirects to specified url while flash a message"""
        flash(Markup(request.args.get('msg')), 'info')
        return redirect(request.args.get('url'))


appbuilder.add_view_no_menu(R)


class Superset(FoldersApiMixin, BaseSupersetView):
    """The base views for Superset!"""

    def json_response(self, obj, status=200, default=utils.json_int_dttm_ser):
        return Response(
            json.dumps(obj, default=default),
            status=status,
            mimetype='application/json')

    @has_access_api
    @expose('/datasources/')
    def datasources(self):
        datasources = ConnectorRegistry.get_all_datasources(db.session)
        datasources = [o.short_data for o in datasources]
        datasources = sorted(datasources, key=lambda o: o['name'])
        return self.json_response(datasources)

    @has_access_api
    @expose('/datasource/<datasource_type>/<datasource_id>/')
    def datasource(self, datasource_type, datasource_id):
        """Эндпоинт для получения datasource"""
        ds_class = ConnectorRegistry.sources.get(datasource_type)
        qry = db.session.query(ds_class)

        if datasource_id.isdigit():
            qry = qry.filter_by(id=int(datasource_id))
        else:
            qry = qry.filter_by(slug=datasource_id)

        ds = qry.one()
        data = ds.data
        return json_success(json.dumps({ds.uid: data if isinstance(data, property) else data()}))

    @has_access_api
    @expose('/override_role_permissions/', methods=['POST'])
    def override_role_permissions(self):
        """Updates the role with the give datasource permissions.

          Permissions not in the request will be revoked. This endpoint should
          be available to admins only. Expects JSON in the format:
           {
            'role_name': '{role_name}',
            'database': [{
                'datasource_type': '{table|druid}',
                'name': '{database_name}',
                'schema': [{
                    'name': '{schema_name}',
                    'datasources': ['{datasource name}, {datasource name}']
                }]
            }]
        }
        """
        data = request.get_json(force=True)
        role_name = data['role_name']
        databases = data['database']

        db_ds_names = set()
        for dbs in databases:
            for schema in dbs['schema']:
                for ds_name in schema['datasources']:
                    fullname = utils.get_datasource_full_name(
                        dbs['name'], ds_name, schema=schema['name'])
                    db_ds_names.add(fullname)

        existing_datasources = ConnectorRegistry.get_all_datasources(db.session)
        datasources = [
            d for d in existing_datasources if d.full_name in db_ds_names]
        role = security_manager.find_role(role_name)
        # remove all permissions
        role.permissions = []
        # grant permissions to the list of datasources
        granted_perms = []
        for datasource in datasources:
            view_menu_perm = security_manager.find_permission_view_menu(
                view_menu_name=datasource.perm,
                permission_name='datasource_access')
            # prevent creating empty permissions
            if view_menu_perm and view_menu_perm.view_menu:
                role.permissions.append(view_menu_perm)
                granted_perms.append(view_menu_perm.view_menu.name)
        db.session.commit()
        return self.json_response({
            'granted': granted_perms,
            'requested': list(db_ds_names),
        }, status=201)

    @log_this
    @has_access
    @expose('/request_access/')
    def request_access(self):
        datasources = set()
        dashboard_id = request.args.get('dashboard_id')
        if dashboard_id:
            dash = (
                db.session.query(models.Dashboard)
                    .filter_by(id=int(dashboard_id))
                    .one()
            )
            datasources |= dash.datasources
        datasource_id = request.args.get('datasource_id')
        datasource_type = request.args.get('datasource_type')
        if datasource_id:
            ds_class = ConnectorRegistry.sources.get(datasource_type)
            datasource = (
                db.session.query(ds_class)
                    .filter_by(id=int(datasource_id))
                    .one()
            )
            datasources.add(datasource)

        has_access = all(
            (
                datasource and security_manager.datasource_access(datasource)
                for datasource in datasources
            ))
        if has_access:
            return redirect('/superset/dashboard/{}'.format(dashboard_id))

        if request.args.get('action') == 'go':
            for datasource in datasources:
                access_request = DAR(
                    datasource_id=datasource.id,
                    datasource_type=datasource.type)
                db.session.add(access_request)
                db.session.commit()
            flash(__('Access was requested'), 'info')
            return redirect('/')

        return self.render_template(
            'superset/request_access.html',
            datasources=datasources,
            datasource_names=', '.join([o.name for o in datasources]),
        )

    @log_this
    @has_access
    @expose('/approve')
    def approve(self):
        def clean_fulfilled_requests(session):
            for r in session.query(DAR).all():
                datasource = ConnectorRegistry.get_datasource(
                    r.datasource_type, r.datasource_id, session)
                user = security_manager.get_user_by_id(r.created_by_fk)
                if not datasource or \
                        security_manager.datasource_access(datasource, user):
                    # datasource does not exist anymore
                    session.delete(r)
            session.commit()

        datasource_type = request.args.get('datasource_type')
        datasource_id = request.args.get('datasource_id')
        created_by_username = request.args.get('created_by')
        role_to_grant = request.args.get('role_to_grant')
        role_to_extend = request.args.get('role_to_extend')

        session = db.session
        datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, session)

        if not datasource:
            flash(DATASOURCE_MISSING_ERR, 'alert')
            return json_error_response(DATASOURCE_MISSING_ERR)

        requested_by = security_manager.find_user(username=created_by_username)
        if not requested_by:
            flash(USER_MISSING_ERR, 'alert')
            return json_error_response(USER_MISSING_ERR)

        requests = (
            session.query(DAR)
                .filter(
                DAR.datasource_id == datasource_id,
                DAR.datasource_type == datasource_type,
                DAR.created_by_fk == requested_by.id)
                .all()
        )

        if not requests:
            flash(ACCESS_REQUEST_MISSING_ERR, 'alert')
            return json_error_response(ACCESS_REQUEST_MISSING_ERR)

        # check if you can approve
        if security_manager.all_datasource_access() or g.user.id == datasource.owner_id:
            # can by done by admin only
            if role_to_grant:
                role = security_manager.find_role(role_to_grant)
                requested_by.roles.append(role)
                msg = __(
                    '%(user)s was granted the role %(role)s that gives access '
                    'to the %(datasource)s',
                    user=requested_by.username,
                    role=role_to_grant,
                    datasource=datasource.full_name)
                utils.notify_user_about_perm_udate(
                    g.user, requested_by, role, datasource,
                    'email/role_granted.txt', app.config)
                flash(msg, 'info')

            if role_to_extend:
                perm_view = security_manager.find_permission_view_menu(
                    'email/datasource_access', datasource.perm)
                role = security_manager.find_role(role_to_extend)
                security_manager.add_permission_role(role, perm_view)
                msg = __('Role %(r)s was extended to provide the access to '
                         'the datasource %(ds)s', r=role_to_extend,
                         ds=datasource.full_name)
                utils.notify_user_about_perm_udate(
                    g.user, requested_by, role, datasource,
                    'email/role_extended.txt', app.config)
                flash(msg, 'info')
            clean_fulfilled_requests(session)
        else:
            flash(__('You have no permission to approve this request'),
                  'danger')
            return redirect('/accessrequestsmodelview/list/')
        for r in requests:
            session.delete(r)
        session.commit()
        return redirect('/accessrequestsmodelview/list/')

    def get_form_data(self, slice_id=None):
        form_data = {}
        post_data = request.form.get('form_data')
        request_args_data = request.args.get('form_data')
        # Supporting POST
        if post_data:
            form_data.update(json.loads(post_data))
        # request params can overwrite post body
        if request_args_data:
            form_data.update(json.loads(request_args_data))

        fields_by_slice = form_data.get('fields_by_slice', False)

        url_id = request.args.get('r')
        if url_id:
            saved_url = db.session.query(models.Url).filter_by(id=url_id).first()
            if saved_url:
                url_str = parse.unquote_plus(
                    saved_url.url.split('?')[1][10:], encoding='utf-8', errors=None)
                url_form_data = json.loads(url_str)
                # allow form_date in request override saved url
                url_form_data.update(form_data)
                form_data = url_form_data

        if request.args.get('viz_type'):
            # Converting old URLs
            form_data = cast_form_data(form_data)

        if request.args.get('folder_id') is not None:
            form_data['folder_id'] = request.args.get('folder_id')

        form_data = {
            k: v
            for k, v in form_data.items()
            if k not in FORM_DATA_KEY_BLACKLIST
        }

        # When a slice_id is present, load from DB and override
        # the form_data from the DB with the other form_data provided
        slice_id = form_data.get('slice_id') or slice_id
        slc = None

        if slice_id:
            if set(form_data.keys()) != {'slice_id', 'fields_by_slice'}:
                if 'columns' not in form_data:
                    form_data['columns'] = []
                if 'groupby' not in form_data:
                    form_data['groupby'] = []

            slc = db.session.query(models.Slice).filter_by(id=slice_id).first()
            slice_form_data = slc.form_data.copy()
            # allow form_data in request override slice from_data
            slice_form_data.update(form_data)

            # remove keys that are not present in request form_data
            # Don't remove fields, when we get form data from db by slice_id
            if not fields_by_slice:
                for key in list(slice_form_data):
                    if key not in form_data:
                        del slice_form_data[key]

            form_data = slice_form_data

        if form_data.get('viz_type') == 'pie':
            form_data['columns'] = []
        return form_data, slc

    def get_viz(
            self,
            slice_id=None,
            form_data=None,
            datasource_type=None,
            datasource_id=None,
            force=False,
            session=None
    ):
        session = session or db.session
        if slice_id:
            slc = (session.query(models.Slice).filter_by(id=slice_id).one())
            viz_obj = slc.get_viz()

            # добавляем права на слайс
            viz_obj.form_data['perms'] = self.get_available_slice_perms(slc)
        else:
            viz_type = form_data.get('viz_type', 'table')
            datasource = ConnectorRegistry.get_datasource(datasource_type, datasource_id, session)
            viz_obj = viz.viz_types[viz_type](
                datasource,
                form_data=form_data,
                force=force,
            )
        # В слайсе нужно брать минимальное значение из row_limit слайса и системного ROW_LIMIT.
        try:
            row_limit = int(viz_obj.form_data.get('row_limit'))
        except (TypeError, ValueError):
            row_limit = None

        viz_obj.form_data['row_limit'] = min(row_limit, conf.get('ROW_LIMIT')) if row_limit else conf.get('ROW_LIMIT')

        return viz_obj

    @has_access
    @expose('/slice/<slice_id>/')
    def slice(self, slice_id):
        form_data, slc = self.get_form_data(slice_id)
        endpoint = '/superset/explore/?form_data={}'.format(
            parse.quote(json.dumps(form_data)),
        )
        if request.args.get('standalone') == 'true':
            endpoint += '&standalone=true'
        return redirect(endpoint)

    @has_access
    @expose("/slice_formdata/<slice_id>/")
    def slice_formdata(self, slice_id):
        viz_obj = self.get_viz(slice_id)
        payload = viz_obj.get_payload()
        form_data = payload['form_data']
        form_data['datasource'] = '{}__{}'.format(viz_obj.datasource.id, viz_obj.datasource.type)
        form_data['allow_run_async'] = viz_obj.datasource.database.allow_run_async
        return viz_obj.json_dumps(payload)

    def get_query_string_response(self, viz_obj):
        query = None
        try:
            query_obj = viz_obj.query_obj()
            if query_obj:
                query = viz_obj.datasource.get_query_str(query_obj)
        except Exception as e:
            logging.exception(e)
            return json_error_response(e)

        if query_obj and query_obj['prequeries']:
            query_obj['prequeries'].append(query)
            query = ';\n\n'.join(query_obj['prequeries'])
        if query:
            query += ';'
        else:
            query = 'No query.'

        return Response(
            json.dumps({
                'query': query,
                'language': viz_obj.datasource.query_language,
            }),
            status=200,
            mimetype='application/json')

    def generate_json(self, datasource_type, datasource_id, form_data,
                      csv=False, excel=False, query=False, force=False, user=None, session=None, async_mode=False,
                      payload_type=None):
        try:
            if user:
                g.user = user
            viz_obj = self.get_viz(
                datasource_type=datasource_type,
                datasource_id=datasource_id,
                form_data=form_data,
                force=force,
                session=session
            )
        except Exception as e:
            logging.exception(e)
            return json_error_response(
                utils.error_msg_from_exception(e),
                stacktrace=traceback.format_exc())

        if not security_manager.datasource_access(viz_obj.datasource, g.user):
            return json_error_response(DATASOURCE_ACCESS_ERR, status=404)

        if csv:
            return CsvResponse(
                viz_obj.get_csv(),
                status=200,
                headers=generate_download_headers('csv'),
                mimetype='application/csv')

        if excel:
            return Response(
                viz_obj.get_excel(),
                status=200,
                headers=generate_download_headers("xlsx"))

        if query:
            return self.get_query_string_response(viz_obj)

        try:
            if payload_type and hasattr(viz_obj, payload_type):
                get_payload = getattr(viz_obj, payload_type)
                payload = get_payload(session=session)
            else:
                payload = viz_obj.get_payload(session=session)
        except SupersetException as se:
            logging.exception(se)
            return json_error_response(utils.error_msg_from_exception(se),
                                       status=se.status)
        except Exception as e:
            logging.exception(e)
            return json_error_response(utils.error_msg_from_exception(e))

        status = 200
        if (
                payload.get('status') == QueryStatus.FAILED or
                payload.get('error') is not None
        ):
            status = 400
        viz_serialized_data = viz_obj.json_dumps(payload)
        payload['utc_offset'] = UTC_OFFSET
        if async_mode:
            return viz_serialized_data
        return json_success(viz_obj.json_dumps(payload), status=status)

    @log_this
    @has_access_api
    @expose('/slice_json/<slice_id>')
    def slice_json(self, slice_id):
        try:
            form_data, slc = self.get_form_data(slice_id)
            datasource_type = slc.datasource.type
            datasource_id = slc.datasource.id

        except Exception as e:
            return json_error_response(
                utils.error_msg_from_exception(e),
                stacktrace=traceback.format_exc())
        return self.generate_json(datasource_type=datasource_type,
                                  datasource_id=datasource_id,
                                  form_data=form_data)

    @log_this
    @has_access_api
    @expose('/annotation_json/<layer_id>')
    def annotation_json(self, layer_id):
        form_data = self.get_form_data()[0]
        form_data['layer_id'] = layer_id
        form_data['filters'] = [{'col': 'layer_id',
                                 'op': '==',
                                 'val': layer_id}]
        datasource = AnnotationDatasource()
        viz_obj = viz.viz_types['table'](
            datasource,
            form_data=form_data,
            force=False,
        )
        try:
            payload = viz_obj.get_payload()
        except Exception as e:
            logging.exception(e)
            return json_error_response(utils.error_msg_from_exception(e))
        status = 200
        if payload.get('status') == QueryStatus.FAILED:
            status = 400
        return json_success(viz_obj.json_dumps(payload), status=status)

    @log_this
    @has_access_api
    @expose('/explore_json/<datasource_type>/<datasource_id>/', methods=['GET', 'POST'])
    @expose('/explore_json/', methods=['GET', 'POST'])
    def explore_json(self, datasource_type=None, datasource_id=None):
        try:
            csv = request.args.get('csv') == 'true'
            excel = request.args.get('excel') == 'true'
            query = request.args.get('query') == 'true'
            force = request.args.get('force') == 'true'
            async_mode = request.args.get('async') == 'true'
            query_identity = request.args.get('query_identity')
            form_data = self.get_form_data()[0]
            datasource_id, datasource_type = self.datasource_info(datasource_id, datasource_type, form_data)
            if async_mode and not (csv or excel or query):
                async_dashboard.delay(datasource_type, datasource_id, form_data, csv, excel, query, force, g.user.id,
                                      query_identity)
                resp = json_success(None, status=202)
            else:
                resp = self.generate_json(datasource_type=datasource_type,
                                          datasource_id=datasource_id,
                                          form_data=form_data,
                                          csv=csv,
                                          excel=excel,
                                          query=query,
                                          force=force,
                                          payload_type='get_payload_with_parsing')
        except Exception as e:
            logging.exception(e)
            return json_error_response(
                utils.error_msg_from_exception(e),
                stacktrace=traceback.format_exc())
        return resp

    @log_this
    @has_access_api
    @expose('/aggregate_by_area/<datasource_type>/<datasource_id>/', methods=['GET', 'POST'])
    @expose('/aggregate_by_area', methods=['POST'])
    def aggregate_by_area(self, datasource_type=None, datasource_id=None):
        session = db.session
        aggregation_name = 'aggregation_result'

        force = request.args.get('force') == 'true'
        form_data = self.get_form_data()[0]
        datasource_id, datasource_type = self.datasource_info(datasource_id, datasource_type, form_data)

        viz_obj = self.get_viz(
            datasource_type=datasource_type,
            datasource_id=datasource_id,
            form_data=form_data,
            force=force,
            session=session
        )

        datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, session)
        query_obj = viz_obj.query_obj()

        point_name = datasource.get_col(form_data["pointName"]).sqla_col
        lat = datasource.get_col(form_data["latitude"]).inner_sqla_col
        lng = datasource.get_col(form_data["longitude"]).inner_sqla_col

        metrics = query_obj["metrics"]
        metrics_exprs, main_metric, metric_type = datasource.get_metrics(
            metrics,
            session,
            datasource=datasource,
            with_main_metric=True,
            with_metric_type=True,
        )
        main_metric_expr = get_metric_expr(main_metric)

        all_columns = [str(c.sqla_col) for c in datasource.columns] + ['*']

        replaced_column = [col for col in all_columns if col in main_metric_expr][0]
        main_metric_alias = f'"{main_metric.name}"'
        aggregation_text = main_metric_expr.replace(replaced_column, main_metric_alias)
        if metric_type in ['COUNT', 'COUNT_DISTINCT']:
            if metric_type == 'COUNT_DISTINCT':
                aggregation_text = aggregation_text.replace('DISTINCT ', '', 1)
            func_len = aggregation_text.index('(')
            func_to_replace = aggregation_text[:func_len]
            aggregation_text = aggregation_text.replace(func_to_replace, 'SUM', 1)
        aggregate_expr = text(aggregation_text + f' AS {aggregation_name}')

        wherecls = func.concat(
            lat.cast(String),
            lng.cast(String),
            point_name.cast(String)
        )

        aggregates = form_data["aggregates"]
        engine = datasource.database.get_sqla_engine()

        select_cols = [
            datasource.get_col(c).inner_sqla_col for c in query_obj["groupby"]
            if c not in [form_data["latitude"], form_data["longitude"]]
        ] + [text(main_metric_alias)]
        aggregate_result = dict()

        for aggregate in aggregates:
            wherecondition = []
            for point in aggregate["points"]:
                wherecondition.append(
                    func.concat(
                        str(point["latitude"]["value"]),
                        str(point["longitude"]["value"]),
                        str(point["pointName"]["value"])
                    )
                )
            inner_qry = datasource.get_sqla_query(**query_obj)
            inner_qry = inner_qry.alias('inner')
            subq = (
                select(columns=select_cols, from_obj=inner_qry)
                .where(wherecls.in_(wherecondition))
                .group_by(*select_cols).alias("subq")
            )
            qry = select(columns=[aggregate_expr], from_obj=subq)

            result = get_query_result(query=qry, datasource=datasource, engine=engine)

            if result.error_message:
                return json_error_response(result.error_message, status=400)

            viz_obj.metrics = [aggregation_name]
            payload = viz_obj.get_payload_df(result.df)

            result = dict(metric=payload["data"]["features"][0]["metric"][0])
            result["metric"]["name"] = main_metric.name
            result["metric"]["value"] = str(result["metric"]["value"])
            result["center"] = aggregate.get("center")

            aggregate_result[aggregate["area_name"]] = result

        return json_success(json.dumps(aggregate_result), status=200)

    @log_this
    @has_access_api
    @expose('/save_as_datasource/', methods=['POST'])
    def save_as_datasource(self):
        '''
        Эндпоинт для сохранение запроса как витрину
        :return: json в котором url=относительный путь до эндпоинта редактирования новой витрины
        :except:
            400: Если витрина с таким table_name уже существует
            some_error: Если не удалось распознать form_data
        '''
        form_data = self.get_form_data()[0]
        table_name = request.form.get('table_name')

        session = db.session()

        datasource_id, datasource_type = self.datasource_info(None, None, form_data)
        datasource = session.query(SqlaTable).filter(SqlaTable.id == datasource_id).scalar()

        if session.query(SqlaTable).filter(
                SqlaTable.table_name == table_name,
                SqlaTable.database_id == datasource.database.id).scalar() is not None:
            return json_error_response(f'Table with name={table_name} already exist', status=400)

        try:
            viz_obj = self.get_viz(
                datasource_type=datasource_type,
                datasource_id=datasource_id,
                form_data=form_data,
            )
        except Exception as e:
            logging.exception(e)
            return json_error_response(
                utils.error_msg_from_exception(e),
                stacktrace=traceback.format_exc())

        try:
            payload = viz_obj.get_payload()
        except SupersetException as se:
            logging.exception(se)
            return json_error_response(utils.error_msg_from_exception(se), status=se.status)

        superset_query = SupersetQuery(SupersetQuery.exclude_limit(payload['query']))

        new_datasource = SqlaTable(
            table_name=table_name,
            database=datasource.database,
            parent_id=datasource.parent_id or datasource.id,
            user_id=g.user.id,
            sql=superset_query.stripped(),
        )

        session.add(new_datasource)
        session.flush()

        create_perm(new_datasource)

        new_datasource_columns_ids = {column.id for column in new_datasource.columns}

        for hier in datasource.hierarchies:
            hier_columns_ids = session.query(
                TableHierarchyColumn.column_id, TableHierarchyColumn.column_order).filter(
                TableHierarchyColumn.hier_id == hier.id).all()

            hier_columns_data = {id_: column_order for id_, column_order, in hier_columns_ids}
            hier_columns_ids = set(hier_columns_data.keys())

            if not hier_columns_ids or not hier_columns_ids.issubset(new_datasource_columns_ids):
                continue

            cloned_hier = TableHierarchy(
                hier_name=hier.hier_name,
                table_id=new_datasource.id,
            )
            session.add(cloned_hier)
            session.flush()

            for column_id in hier_columns_ids:
                session.add(TableHierarchyColumn(
                    hier_id=cloned_hier.id,
                    column_id=column_id,
                    column_order=hier_columns_data[column_id]
                ))
            session.flush()

        session.commit()
        security_manager.add_view_menu(new_datasource.get_perm())

        return json_success(json.dumps({'datasource_id': new_datasource.id}))

    @log_this
    @has_access
    @expose('/import_dashboards', methods=['GET', 'POST'])
    def import_dashboards(self):
        """Overrides the dashboards using json instances from the file."""
        f = request.files.get('file')
        if request.method == 'POST' and f:
            current_tt = int(time.time())
            data = json.loads(f.stream.read().decode('utf-8'), object_hook=utils.decode_dashboards)
            # TODO: import DRUID datasources
            for table in data['datasources']:
                type(table).import_obj(table, import_time=current_tt)
            db.session.commit()
            old_to_new_dashboard_id_dict = {}
            dashboard_slices = []
            for dashboard in data['dashboards'] + data['dd_dashboards']:
                if isinstance(dashboard.slices, list):
                    dashboard_slices += dashboard.slices
                new_dashboard_id = models.Dashboard.import_obj(
                    dashboard, import_time=current_tt)
                old_to_new_dashboard_id_dict[dashboard.id] = new_dashboard_id
            db.session.commit()
            old_to_new_slc_id_dict, *_ = models.Dashboard.import_slices(
                import_time=current_tt,
                import_slices=data['dd_slices'] + dashboard_slices
            )
            db.session.commit()

            new_dd_slices = db.session.query(models.Slice).filter(
                models.Slice.id.in_(old_to_new_slc_id_dict.values())).all()
            for slc in new_dd_slices:
                url_drilldowns = deepcopy(slc.params_dict.get('url_drilldowns', []))
                for index, index_dd_data in enumerate(url_drilldowns):
                    # в силу ограничении вложенности до 3-х уровней вложенности ссылок url_drilldowns,
                    # необходима проверка есть ли в импортируемых данных отчет
                    if index_dd_data['type'] == 'slices' and index_dd_data['url'] in old_to_new_slc_id_dict:
                        url_drilldowns[index]['url'] = old_to_new_slc_id_dict[index_dd_data['url']]
                    if index_dd_data['type'] == 'dashboards' and index_dd_data['url'] in old_to_new_dashboard_id_dict:
                        url_drilldowns[index]['url'] = old_to_new_dashboard_id_dict[index_dd_data['url']]
                if url_drilldowns:
                    slc.alter_params(
                        url_drilldowns=url_drilldowns,
                    )
            db.session.commit()
            return redirect('/dashboardmodelview/list/')
        return self.render_template('superset/import_dashboards.html')

    @log_this
    @has_access
    @expose('/explorev2/<datasource_type>/<datasource_id>/')
    def explorev2(self, datasource_type, datasource_id):
        """Deprecated endpoint, here for backward compatibility of urls"""
        return redirect(url_for(
            'Superset.explore',
            datasource_type=datasource_type,
            datasource_id=datasource_id,
            **request.args))

    @staticmethod
    def datasource_info(datasource_id, datasource_type, form_data):
        """Compatibility layer for handling of datasource info

        datasource_id & datasource_type used to be passed in the URL
        directory, now they should come as part of the form_data,
        This function allows supporting both without duplicating code"""
        datasource = form_data.get('datasource', '')
        if '__' in datasource:
            datasource_id, datasource_type = datasource.split('__')
        datasource_id = int(datasource_id)
        return datasource_id, datasource_type

    @log_this
    @has_access
    @expose('/explore/<datasource_type>/<datasource_id>/', methods=['GET', 'POST'])
    @expose('/explore/', methods=['GET', 'POST'])
    def explore(self, datasource_type=None, datasource_id=None):
        user_id = g.user.get_id() if g.user else None
        form_data, slc = self.get_form_data()

        datasource_id, datasource_type = self.datasource_info(
            datasource_id, datasource_type, form_data)

        error_redirect = '/slicemodelview/list/'
        datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, db.session)
        if not datasource:
            flash(DATASOURCE_MISSING_ERR, 'danger')
            return redirect(error_redirect)

        if not security_manager.datasource_access(datasource):
            flash(
                __(get_datasource_access_error_msg(datasource.name)),
                'danger')
            return redirect(
                'superset/request_access/?'
                'datasource_type={datasource_type}&'
                'datasource_id={datasource_id}&'
                ''.format(**locals()))

        viz_type = form_data.get('viz_type')
        if not viz_type and datasource.default_endpoint:
            return redirect(datasource.default_endpoint)

        # slc perms
        slice_view_name = SliceModelView.__name__
        slice_add_perm = security_manager.can_access(CAN_ADD, slice_view_name)
        slice_overwrite_perm = is_owner(slc, g.user)
        item = slc or datasource
        if not slice_overwrite_perm:
            slice_overwrite_perm = security_manager.item_has_access(item, CAN_EDIT, view_name=slice_view_name)

        slice_download_perm = security_manager.can_access(CAN_DOWNLOAD, view_name=slice_view_name)
        if not slice_download_perm:
            slice_download_perm = security_manager.item_has_access(item, CAN_DOWNLOAD)

        slice_favstar_perm = security_manager.can_access(CAN_FAVSTAR, self.__class__.__name__)
        if not slice_favstar_perm:
            slice_favstar_perm = security_manager.item_has_access(item, CAN_FAVSTAR, view_name=slice_view_name)
        slice_can_config = security_manager.item_has_access(item, CAN_CONFIG, view_name=slice_view_name)
        form_data['datasource'] = str(datasource_id) + '__' + datasource_type

        # On explore, merge extra filters into the form data
        merge_extra_filters(form_data)

        # merge request url params
        if request.method == 'GET':
            merge_request_params(form_data, request.args)

        # handle save or overwrite
        action = request.args.get('action')

        if action == 'overwrite' and not slice_overwrite_perm:
            return json_error_response(
                _('You don\'t have the rights to ') + _('alter this ') + _('chart'),
                status=400)

        if action == 'saveas' and not slice_add_perm:
            return json_error_response(
                _('You don\'t have the rights to ') + _('create a ') + _('chart'),
                status=400)

        folder_id = form_data.get('folder_id') if form_data.get('folder_id') else None

        if action in ('saveas', 'overwrite'):
            return self.save_or_overwrite_slice(
                request.args,
                slc, slice_add_perm,
                slice_overwrite_perm,
                slice_download_perm,
                datasource_id,
                datasource_type,
                datasource.name,
                folder_id)

        polygons = db.session.query(models.GeoPoligons.id, models.GeoPoligons.name).all()

        standalone = request.args.get('standalone') == 'true'
        bootstrap_data = {
            'can_add': slice_add_perm,
            'can_download': slice_download_perm,
            'can_edit': slice_overwrite_perm,
            'can_favstar': slice_favstar_perm,
            'can_config': slice_can_config,
            'datasource': datasource.data(),
            'form_data': form_data,
            'datasource_id': datasource_id,
            'datasource_type': datasource_type,
            'slice': slc.data if slc else None,
            'standalone': standalone,
            'user_id': user_id,
            'forced_height': request.args.get('height'),
            'common': self.common_bootsrap_payload(),
            'polygons': polygons
        }

        hierarchies = db.session.query(
            TableHierarchy).filter(
            TableHierarchy.table_id == datasource_id
        )

        bootstrap_data["hierarchies"] = [
            {
                'name': h.hier_name,
                'id': h.id,
                'table_id': h.table_id,
                'columns': [h_column.column.column_name for h_column in h.columns]
            }
            for h in hierarchies]

        bootstrap_data["data_objects"] = {
            'slices': [{'name': s.slice_name, 'id': s.id, 'folder_id': s.folder_id} for s in
                       db.session.query(models.Slice).all()],
            'dashboards': [{'name': d.dashboard_title, 'id': d.id} for d in db.session.query(models.Dashboard).all()],
        }

        table_name = datasource.table_name \
            if datasource_type == 'table' \
            else datasource.datasource_name
        if slc:
            title = slc.slice_name
        else:
            title = 'Explore - ' + table_name
        return self.render_template(
            'superset/basic.html',
            bootstrap_data=json.dumps(bootstrap_data),
            entry='explore',
            title=title,
            standalone_mode=standalone,
            yandex_api_key=config.get('YANDEX_API_KEY')
        )

    @api
    @has_access_api
    @expose('/filter/<datasource_type>/<datasource_id>/<column>/')
    def filter(self, datasource_type, datasource_id, column):
        """
        Endpoint to retrieve values for specified column.

        :param datasource_type: Type of datasource e.g. table
        :param datasource_id: Datasource id
        :param column: Column name to retrieve values for
        :return:
        """
        # TODO: Cache endpoint by user, datasource and column
        datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, db.session)
        if not datasource:
            return json_error_response(DATASOURCE_MISSING_ERR)
        if not security_manager.datasource_access(datasource):
            return json_error_response(DATASOURCE_ACCESS_ERR)

        payload = json.dumps(
            datasource.values_for_column(
                column,
                config.get('FILTER_SELECT_ROW_LIMIT', 10000),
            ),
            default=utils.json_int_dttm_ser)
        return json_success(payload)

    def save_or_overwrite_slice(
            self, args, slc, slice_add_perm, slice_overwrite_perm, slice_download_perm,
            datasource_id, datasource_type, datasource_name, folder_id):
        """Save or overwrite a slice"""
        slice_name = args.get('slice_name')
        action = args.get('action')
        form_data, _ = self.get_form_data()

        if action in ('saveas'):
            if 'slice_id' in form_data:
                form_data.pop('slice_id')  # don't save old slice_id
            slc = models.Slice(owners=[g.user] if g.user else [])

        # column_formats = form_data.pop('column_formats', dict())
        slc.params = json.dumps(form_data)
        slc.datasource_name = datasource_name
        slc.viz_type = form_data['viz_type']
        slc.datasource_type = datasource_type
        slc.datasource_id = datasource_id
        slc.slice_name = slice_name
        slc.folder_id = folder_id
        if action == 'saveas' and slice_add_perm:
            self.save_slice(slc)
        elif action == 'overwrite' and slice_overwrite_perm:
            self.overwrite_slice(slc)

        # Adding slice to a dashboard if requested
        dash = None
        if request.args.get('add_to_dash') == 'existing':
            dash = (
                db.session.query(models.Dashboard)
                    .filter_by(id=int(request.args.get('save_to_dashboard_id')))
                    .one()
            )

            # check edit dashboard permissions
            dash_overwrite_perm = check_ownership(dash, raise_if_false=False)
            if not dash_overwrite_perm:
                return json_error_response(
                    _('You don\'t have the rights to ') + _('alter this ') +
                    _('dashboard'),
                    status=400)

            flash(
                __('Slice [%(slice)s] was added to dashboard [%(dashboard)s]',
                   slice=slc.slice_name,
                   dashboard=dash.dashboard_title),
                'info')
        elif request.args.get('add_to_dash') == 'new':
            # check create dashboard permissions
            dash_add_perm = security_manager.can_access('can_add', 'DashboardModelView')
            if not dash_add_perm:
                return json_error_response(
                    _('You don\'t have the rights to ') + _('create a ') + _('dashboard'),
                    status=400)

            dash = models.Dashboard(
                dashboard_title=request.args.get('new_dashboard_name'),
                owners=[g.user] if g.user else [])
            flash(
                __('Dashboard [%(dashboard)s] just got created and slice [%(slice)s] was added to it',
                   dashboard=dash.dashboard_title,
                   slice=slc.slice_name),
                'info')

        if dash and slc not in dash.slices:
            dash.slices.append(slc)
            db.session.commit()
            create_perm(dash)

        response = {
            'can_add': slice_add_perm,
            'can_download': slice_download_perm,
            'can_overwrite': is_owner(slc, g.user),
            'form_data': slc.form_data,
            'slice': slc.data,
        }

        if request.args.get('goto_dash') == 'true':
            response.update({'dashboard': dash.url})

        return json_success(json.dumps(response))

    @staticmethod
    def save_slice(slc):
        session = db.session()
        msg = _('Slice [{}] has been saved').format(slc.slice_name)
        session.add(slc)
        session.commit()
        create_perm(slc)
        # self.update_d3_metrics(column_formats, slc.datasource_id)
        flash(msg, 'info')

    @staticmethod
    def overwrite_slice(slc):
        session = db.session()
        session.merge(slc)
        session.commit()
        # self.update_d3_metrics(column_formats, slc.datasource_id)
        msg = _('Slice [{}] has been overwritten').format(slc.slice_name)
        flash(msg, 'info')

    # @staticmethod
    # def update_d3_metrics(column_formats, table_id):
    #     for metric_name, _format in column_formats.items():
    #         db.session.query(SqlMetric).filter(SqlMetric.table_id == table_id,
    #                                            SqlMetric.metric_name == metric_name).update(
    #             values=dict(d3format=_format))

    @api
    @has_access_api
    @expose('/checkbox/<model_view>/<id_>/<attr>/<value>', methods=['GET'])
    def checkbox(self, model_view, id_, attr, value):
        """endpoint for checking/unchecking any boolean in a sqla model"""
        modelview_to_model = {
            'TableColumnInlineView':
                ConnectorRegistry.sources['table'].column_class,
            'DruidColumnInlineView':
                ConnectorRegistry.sources['druid'].column_class,
        }
        model = modelview_to_model[model_view]
        col = db.session.query(model).filter_by(id=id_).first()
        checked = value == 'true'
        if col:
            setattr(col, attr, checked)
            if checked:
                metrics = col.get_metrics().values()
                db.session.add_all(col.datasource.add_missing_metrics(metrics))
            db.session.commit()
        return json_success('OK')

    @api
    @has_access_api
    @expose('/schemas/<db_id>/')
    def schemas(self, db_id):
        db_id = int(db_id)
        database = (
            db.session
                .query(models.Database)
                .filter_by(id=db_id)
                .one()
        )
        schemas = database.all_schema_names()
        schemas = security_manager.schemas_accessible_by_user(database, schemas)
        return Response(
            json.dumps({'schemas': schemas}),
            mimetype='application/json')

    @api
    @has_access_api
    @expose('/tables/<db_id>/<schema>/<substr>/')
    def tables(self, db_id, schema, substr):
        """Endpoint to fetch the list of tables for given database"""
        db_id = int(db_id)
        schema = utils.js_string_to_python(schema)
        substr = utils.js_string_to_python(substr)
        database = db.session.query(models.Database).filter_by(id=db_id).one()
        table_names = security_manager.accessible_by_user(
            database, database.all_table_names(schema), schema)
        view_names = security_manager.accessible_by_user(
            database, database.all_view_names(schema), schema)

        if substr:
            table_names = [tn for tn in table_names if substr in tn]
            view_names = [vn for vn in view_names if substr in vn]

        max_items = config.get('MAX_TABLE_NAMES') or len(table_names)
        total_items = len(table_names) + len(view_names)
        max_tables = len(table_names)
        max_views = len(view_names)
        if total_items and substr:
            max_tables = max_items * len(table_names) // total_items
            max_views = max_items * len(view_names) // total_items

        table_options = [{'value': tn, 'label': tn}
                         for tn in table_names[:max_tables]]
        table_options.extend([{'value': vn, 'label': '[view] {}'.format(vn)}
                              for vn in view_names[:max_views]])
        payload = {
            'tableLength': len(table_names) + len(view_names),
            'options': table_options,
        }
        return json_success(json.dumps(payload))

    @api
    @has_access_api
    @expose('/copy_dash/<dashboard_id>/', methods=['GET', 'POST'])
    def copy_dash(self, dashboard_id):
        """Copy dashboard"""
        session = db.session()
        data = json.loads(request.form.get('data'))
        dash = models.Dashboard()
        original_dash = (
            session
                .query(models.Dashboard)
                .filter_by(id=dashboard_id).first())

        dash.owners = [g.user] if g.user else []
        dash.dashboard_title = data['dashboard_title']
        if data['duplicate_slices']:
            # Duplicating slices as well, mapping old ids to new ones
            old_to_new_sliceids = {}
            for slc in original_dash.slices:
                new_slice = slc.clone()
                new_slice.owners = [g.user] if g.user else []
                session.add(new_slice)
                session.flush()
                new_slice.dashboards.append(dash)
                old_to_new_sliceids['{}'.format(slc.id)] = \
                    '{}'.format(new_slice.id)
                create_perm(new_slice)
            for d in data['positions']:
                d['slice_id'] = old_to_new_sliceids[d['slice_id']]
        else:
            dash.slices = original_dash.slices
        dash.params = original_dash.params

        self._set_dash_metadata(dash, data)
        session.add(dash)
        session.commit()
        create_perm(dash)
        dash_json = json.dumps(dash.data)
        session.close()
        return json_success(dash_json)

    @log_this
    @api
    @has_access
    @expose('/save_dash/<dashboard_id>/', methods=['GET', 'POST'])
    def save_dash(self, dashboard_id):
        """Save a dashboard's metadata"""
        session = db.session()
        dash = (session
                .query(models.Dashboard)
                .filter_by(id=dashboard_id).first())
        # check_ownership(dash, raise_if_false=True)
        data = json.loads(request.form.get('data'))
        self._set_dash_metadata(dash, data)
        session.merge(dash)
        session.commit()
        session.close()
        return 'SUCCESS'

    @staticmethod
    def _set_dash_metadata(dashboard, data):
        positions = data['positions']
        slice_ids = [int(d['slice_id']) for d in positions]

        dashboard.slices = [o for o in dashboard.slices if o.id in slice_ids]
        dashboard_slices_ids = [int(d.id) for d in dashboard.slices]
        added_slices_ids = list(set(slice_ids) - set(dashboard_slices_ids))

        if len(added_slices_ids):
            session = db.session()
            Slice = models.Slice  # noqa
            new_slices = session.query(Slice).filter(
                Slice.id.in_(added_slices_ids))
            dashboard.slices += new_slices

        positions = sorted(data['positions'], key=lambda x: int(x['slice_id']))
        dashboard.position_json = json.dumps(positions, indent=4, sort_keys=True)
        md = dashboard.params_dict
        dashboard.css = data['css']
        dashboard.dashboard_title = data['dashboard_title']
        dashboard.folder_id = data.get('folder_id') or None

        if 'filter_immune_slices' not in md:
            md['filter_immune_slices'] = []
        if 'timed_refresh_immune_slices' not in md:
            md['timed_refresh_immune_slices'] = []
        if 'filter_immune_slice_fields' not in md:
            md['filter_immune_slice_fields'] = {}
        md['expanded_slices'] = data['expanded_slices']
        md['default_filters'] = data.get('default_filters', '')
        dashboard.json_metadata = json.dumps(md, indent=4)

    @api
    @has_access_api
    @expose('/add_slices/<dashboard_id>/', methods=['POST'])
    def add_slices(self, dashboard_id):
        """Add and save slices to a dashboard"""
        data = json.loads(request.form.get('data'))
        session = db.session()
        Slice = models.Slice  # noqa
        dash = (
            session.query(models.Dashboard).filter_by(id=dashboard_id).first())
        check_ownership(dash, raise_if_false=True)
        new_slices = session.query(Slice).filter(
            Slice.id.in_(data['slice_ids']))
        dash.slices += new_slices
        session.merge(dash)
        session.commit()
        session.close()
        return 'SLICES ADDED'

    @api
    @has_access_api
    @expose('/testconn', methods=['POST', 'GET'])
    def testconn(self):
        """Tests a sqla connection"""
        try:
            username = g.user.username if g.user is not None else None
            uri = request.json.get('uri')
            db_name = request.json.get('name')
            impersonate_user = request.json.get('impersonate_user')
            database = None
            if db_name:
                database = (
                    db.session
                        .query(models.Database)
                        .filter_by(database_name=db_name)
                        .first()
                )
                if database and uri == database.safe_sqlalchemy_uri():
                    # the password-masked uri was passed
                    # use the URI associated with this database
                    uri = database.sqlalchemy_uri_decrypted

            configuration = {}

            if database and uri:
                url = make_url(uri)
                db_engine = models.Database.get_db_engine_spec_for_backend(
                    url.get_backend_name())
                db_engine.patch()

                masked_url = database.get_password_masked_url_from_uri(uri)
                logging.info('Superset.testconn(). Masked URL: {0}'.format(masked_url))

                configuration.update(
                    db_engine.get_configuration_for_impersonation(uri,
                                                                  impersonate_user,
                                                                  username),
                )

            connect_args = (
                request.json
                    .get('extras', {})
                    .get('engine_params', {})
                    .get('connect_args', {}))

            if configuration:
                connect_args['configuration'] = configuration

            engine = create_engine(uri, connect_args=connect_args)
            engine.connect()
            return json_success(json.dumps(engine.table_names(), indent=4))
        except Exception as e:
            logging.exception(e)
            return json_error_response((
                                           'Connection failed!\n\n'
                                           'The error message returned was:\n{}').format(e))

    @api
    @has_access_api
    @expose('/recent_activity/<user_id>/', methods=['GET'])
    def recent_activity(self, user_id):
        """Recent activity (actions) for a given user"""
        M = models  # noqa

        if request.args.get('limit'):
            limit = int(request.args.get('limit'))
        else:
            limit = 1000

        qry = (
            db.session.query(M.Log, M.Dashboard, M.Slice)
                .outerjoin(
                M.Dashboard,
                M.Dashboard.id == M.Log.dashboard_id,
            )
                .outerjoin(
                M.Slice,
                M.Slice.id == M.Log.slice_id,
            )
                .filter(
                sqla.and_(
                    ~M.Log.action.in_(('queries', 'shortner', 'sql_json')),
                    M.Log.user_id == user_id,
                ),
            )
                .order_by(M.Log.dttm.desc())
                .limit(limit)
        )
        payload = []
        for log in qry.all():
            item_url = None
            item_title = None
            if log.Dashboard:
                item_url = log.Dashboard.url
                item_title = log.Dashboard.dashboard_title
            elif log.Slice:
                item_url = log.Slice.slice_url
                item_title = log.Slice.slice_name

            payload.append({
                'action': log.Log.action,
                'item_url': item_url,
                'item_title': item_title,
                'time': log.Log.dttm,
            })
        return json_success(
            json.dumps(payload, default=utils.json_int_dttm_ser))

    @api
    @has_access_api
    @expose('/csrf_token/', methods=['GET'])
    def csrf_token(self):
        return Response(
            self.render_template('superset/csrf_token.json'),
            mimetype='text/json',
        )

    @api
    @has_access_api
    @expose('/fave_dashboards_by_username/<username>/', methods=['GET'])
    def fave_dashboards_by_username(self, username):
        """This lets us use a user's username to pull favourite dashboards"""
        user = security_manager.find_user(username=username)
        return self.fave_dashboards(user.get_id())

    @api
    @has_access_api
    @expose('/fave_dashboards/<user_id>/', methods=['GET'])
    def fave_dashboards(self, user_id):
        qry = (
            db.session.query(
                models.Dashboard,
                models.FavStar.dttm,
            )
                .join(
                models.FavStar,
                sqla.and_(
                    models.FavStar.user_id == int(user_id),
                    models.FavStar.class_name == 'Dashboard',
                    models.Dashboard.id == models.FavStar.obj_id,
                ),
            )
                .order_by(
                models.FavStar.dttm.desc(),
            )
        )
        payload = []
        for o in qry.all():
            d = {
                'id': o.Dashboard.id,
                'dashboard': o.Dashboard.dashboard_link(),
                'title': o.Dashboard.dashboard_title,
                'url': o.Dashboard.url,
                'dttm': o.dttm,
            }
            if o.Dashboard.created_by:
                user = o.Dashboard.created_by
                d['creator'] = str(user)
                d['creator_url'] = '/superset/profile/{}/'.format(
                    user.username)
            payload.append(d)
        return json_success(
            json.dumps(payload, default=utils.json_int_dttm_ser))

    @api
    @has_access_api
    @expose('/created_dashboards/<user_id>/', methods=['GET'])
    def created_dashboards(self, user_id):
        Dash = models.Dashboard  # noqa
        qry = (
            db.session.query(
                Dash,
            )
                .filter(
                sqla.or_(
                    Dash.created_by_fk == user_id,
                    Dash.changed_by_fk == user_id,
                ),
            )
                .order_by(
                Dash.changed_on.desc(),
            )
        )
        payload = [{
            'id': o.id,
            'dashboard': o.dashboard_link(),
            'title': o.dashboard_title,
            'url': o.url,
            'dttm': o.changed_on,
        } for o in qry.all()]
        return json_success(
            json.dumps(payload, default=utils.json_int_dttm_ser))

    @api
    @has_access_api
    @expose('/user_slices', methods=['GET'])
    @expose('/user_slices/<user_id>/', methods=['GET'])
    def user_slices(self, user_id=None):
        """List of slices a user created, or faved"""
        if not user_id:
            user_id = g.user.id
        Slice = models.Slice  # noqa
        FavStar = models.FavStar  # noqa
        qry = (
            db.session.query(Slice,
                             FavStar.dttm).join(
                models.FavStar,
                sqla.and_(
                    models.FavStar.user_id == int(user_id),
                    models.FavStar.class_name == 'slice',
                    models.Slice.id == models.FavStar.obj_id,
                ),
                isouter=True).filter(
                sqla.or_(
                    Slice.created_by_fk == user_id,
                    Slice.changed_by_fk == user_id,
                    FavStar.user_id == user_id,
                ),
            )
                .order_by(Slice.slice_name.asc())
        )
        payload = [{
            'id': o.Slice.id,
            'title': o.Slice.slice_name,
            'url': o.Slice.slice_url,
            'data': o.Slice.form_data,
            'dttm': o.dttm if o.dttm else o.Slice.changed_on,
            'viz_type': o.Slice.viz_type,
        } for o in qry.all()]
        return json_success(
            json.dumps(payload, default=utils.json_int_dttm_ser))

    @api
    @has_access_api
    @expose('/created_slices', methods=['GET'])
    @expose('/created_slices/<user_id>/', methods=['GET'])
    def created_slices(self, user_id=None):
        """List of slices created by this user"""
        if not user_id:
            user_id = g.user.id
        Slice = models.Slice  # noqa
        qry = (
            db.session.query(Slice)
                .filter(
                sqla.or_(
                    Slice.created_by_fk == user_id,
                    Slice.changed_by_fk == user_id,
                ),
            )
                .order_by(Slice.changed_on.desc())
        )
        payload = [{
            'id': o.id,
            'title': o.slice_name,
            'url': o.slice_url,
            'dttm': o.changed_on,
            'viz_type': o.viz_type,
        } for o in qry.all()]
        return json_success(
            json.dumps(payload, default=utils.json_int_dttm_ser))

    @api
    @has_access_api
    @expose('/fave_slices', methods=['GET'])
    @expose('/fave_slices/<user_id>/', methods=['GET'])
    def fave_slices(self, user_id=None):
        """Favorite slices for a user"""
        if not user_id:
            user_id = g.user.id
        qry = (
            db.session.query(
                models.Slice,
                models.FavStar.dttm,
            )
                .join(
                models.FavStar,
                sqla.and_(
                    models.FavStar.user_id == int(user_id),
                    models.FavStar.class_name == 'slice',
                    models.Slice.id == models.FavStar.obj_id,
                ),
            )
                .order_by(
                models.FavStar.dttm.desc(),
            )
        )
        payload = []
        for o in qry.all():
            d = {
                'id': o.Slice.id,
                'title': o.Slice.slice_name,
                'url': o.Slice.slice_url,
                'dttm': o.dttm,
                'viz_type': o.Slice.viz_type,
            }
            if o.Slice.created_by:
                user = o.Slice.created_by
                d['creator'] = str(user)
                d['creator_url'] = '/superset/profile/{}/'.format(
                    user.username)
            payload.append(d)
        return json_success(
            json.dumps(payload, default=utils.json_int_dttm_ser))

    @api
    @has_access_api
    @expose('/warm_up_cache/', methods=['GET'])
    def warm_up_cache(self):
        """Warms up the cache for the slice or table.

        Note for slices a force refresh occurs.
        """
        slices = None
        session = db.session()
        slice_id = request.args.get('slice_id')
        table_name = request.args.get('table_name')
        db_name = request.args.get('db_name')

        if not slice_id and not (table_name and db_name):
            return json_error_response(__(
                'Malformed request. slice_id or table_name and db_name '
                'arguments are expected'), status=400)
        if slice_id:
            slices = session.query(models.Slice).filter_by(id=slice_id).all()
            if not slices:
                return json_error_response(__(
                    'Slice %(id)s not found', id=slice_id), status=404)
        elif table_name and db_name:
            SqlaTable = ConnectorRegistry.sources['table']
            table = (
                session.query(SqlaTable)
                    .join(models.Database)
                    .filter(
                    models.Database.database_name == db_name or
                    SqlaTable.table_name == table_name)
            ).first()
            if not table:
                return json_error_response(__(
                    "Table %(t)s wasn't found in the database %(d)s",
                    t=table_name, s=db_name), status=404)
            slices = session.query(models.Slice).filter_by(
                datasource_id=table.id,
                datasource_type=table.type).all()

        for slc in slices:
            try:
                obj = slc.get_viz(force=True)
                obj.get_json()
            except Exception as e:
                return json_error_response(utils.error_msg_from_exception(e))
        return json_success(json.dumps(
            [{'slice_id': slc.id, 'slice_name': slc.slice_name}
             for slc in slices]))

    @has_access
    @expose('/favstar/<class_name>/<obj_id>/<action>/')
    def favstar(self, class_name, obj_id, action):
        """Toggle favorite stars on Slices and Dashboard"""
        session = db.session()
        FavStar = models.FavStar  # noqa
        count = 0
        favs = session.query(FavStar).filter_by(
            class_name=class_name, obj_id=obj_id,
            user_id=g.user.get_id()).all()
        if action == 'select':
            if not favs:
                session.add(
                    FavStar(
                        class_name=class_name,
                        obj_id=obj_id,
                        user_id=g.user.get_id(),
                        dttm=datetime.now(),
                    ),
                )
            count = 1
        elif action == 'unselect':
            for fav in favs:
                session.delete(fav)
        else:
            count = len(favs)
        session.commit()
        return json_success(json.dumps({'count': count}))

    @has_access
    @expose('/dashboard/<dashboard_id>/filter_settings/', methods=['POST', 'GET'])
    def dashboard_user_settings(self, dashboard_id):
        """Save user dashboard filter settings"""
        session = db.session()
        qry = session.query(models.Dashboard)

        if dashboard_id.isdigit():
            qry = qry.filter_by(id=int(dashboard_id))
        else:
            qry = qry.filter_by(slug=dashboard_id)

        dash = qry.one()

        try:
            user_settings = session.query(models.UserFilterSettings).filter_by(user_id=g.user.get_id(),
                                                                               dashboard_id=dash.id).one()
        except NoResultFound:
            user_settings = models.UserFilterSettings(user_id=g.user.get_id(), dashboard_id=dash.id)
            session.add(user_settings)
            session.commit()

        if request.method == 'POST':
            user_settings.json = request.form.get('data')
            session.commit()
            return Response(status=200)
        else:
            return Response(user_settings.json or '[]', status=200, content_type='application/json')

    @has_access
    @expose('/dashboard/<dashboard_id>/')
    def dashboard(self, dashboard_id):
        """Server side rendering for a dashboard"""
        session = db.session()
        qry = session.query(models.Dashboard)

        if dashboard_id.isdigit():
            qry = qry.filter_by(id=int(dashboard_id))
        else:
            qry = qry.filter_by(slug=dashboard_id)

        dash = qry.one()
        datasources = set()
        # viz_type = None
        for slc in dash.slices:
            # slc_viz_type = slc.form_data.get('viz_type')
            # if slc_viz_type in YANDEX_MAP_VISUALIZATIONS:
            #     viz_type = slc_viz_type
            datasource = slc.datasource
            if datasource:
                datasources.add(datasource)

        if config.get('ENABLE_ACCESS_REQUEST'):
            for datasource in datasources:
                if datasource and not security_manager.datasource_access(datasource):
                    flash(
                        __(get_datasource_access_error_msg(datasource.name)),
                        'danger')
                    return redirect(
                        'superset/request_access/?'
                        'dashboard_id={dash.id}&'.format(**locals()))

        # Hack to log the dashboard_id properly, even when getting a slug
        @log_this
        def dashboard(**kwargs):  # noqa
            pass

        dashboard(dashboard_id=dash.id)

        dash_edit_perm = check_ownership(dash, raise_if_false=False)

        standalone_mode = request.args.get('standalone') == 'true'
        dash_save_perm = security_manager.item_has_access(
            dash, CAN_EDIT, view_name='DashboardModelView'
        )
        dashboard_can_edit = security_manager.can_access(CAN_EDIT, 'DashboardModelView')
        dashboard_can_edit |= dash_save_perm
        dash_favstar_perm = security_manager.can_access(CAN_FAVSTAR, 'Superset')
        dash_force_update_perm = security_manager.item_has_access(dash, CAN_FORCE_UPDATE)

        if not dash_edit_perm:
            dash_edit_perm = security_manager.item_has_access(dash, CAN_CONFIG)

        if not dash_favstar_perm:
            dash_favstar_perm = security_manager.item_has_access(dash, CAN_FAVSTAR)

        dashboard_data = dash.data
        dashboard_data.update({
            'standalone_mode': standalone_mode,
            'dash_save_perm': dash_save_perm,
            'dash_edit_perm': dash_edit_perm,
            'can_edit': dashboard_can_edit,
            'dash_favstar_perm': dash_favstar_perm,
            'dash_force_update_perm': dash_force_update_perm
        })

        slices_perms = [
            dict(
                id=slice.id,
                perms=self.get_available_slice_perms(slice)
            ) for slice in dash.slices
        ]

        dashboard_data.update({
            'slices_perms': slices_perms
        })

        bootstrap_data = {
            'user_id': g.user.get_id(),
            'user_name': g.user.get_full_name() if not g.user.is_anonymous() else '',
            'dashboard_data': dashboard_data,
            'datasources': {ds.uid: ds.data if isinstance(ds.data, property) else ds.data() for ds in datasources},
            'common': self.common_bootsrap_payload(),
            'editMode': request.args.get('edit') == 'true',
        }

        if request.args.get('json') == 'true':
            return json_success(json.dumps(bootstrap_data))
        return self.render_template(
            'superset/dashboard.html',
            entry='dashboard',
            standalone_mode=standalone_mode,
            title=dash.dashboard_title,
            bootstrap_data=json.dumps(bootstrap_data)
        )

    @api
    @log_this
    @expose('/log/', methods=['POST'])
    def log(self):
        return Response(status=200)

    @has_access
    @expose('/sync_druid/', methods=['POST'])
    @log_this
    def sync_druid_source(self):
        """Syncs the druid datasource in main db with the provided config.

        The endpoint takes 3 arguments:
            user - user name to perform the operation as
            cluster - name of the druid cluster
            config - configuration stored in json that contains:
                name: druid datasource name
                dimensions: list of the dimensions, they become druid columns
                    with the type STRING
                metrics_spec: list of metrics (dictionary). Metric consists of
                    2 attributes: type and name. Type can be count,
                    etc. `count` type is stored internally as longSum
                    other fields will be ignored.

            Example: {
                'name': 'test_click',
                'metrics_spec': [{'type': 'count', 'name': 'count'}],
                'dimensions': ['affiliate_id', 'campaign', 'first_seen']
            }
        """
        payload = request.get_json(force=True)
        druid_config = payload['config']
        user_name = payload['user']
        cluster_name = payload['cluster']

        user = security_manager.find_user(username=user_name)
        DruidDatasource = ConnectorRegistry.sources['druid']
        DruidCluster = DruidDatasource.cluster_class
        if not user:
            err_msg = __("Can't find User '%(name)s', please ask your admin "
                         'to create one.', name=user_name)
            logging.error(err_msg)
            return json_error_response(err_msg)
        cluster = db.session.query(DruidCluster).filter_by(
            cluster_name=cluster_name).first()
        if not cluster:
            err_msg = __("Can't find DruidCluster with cluster_name = "
                         "'%(name)s'", name=cluster_name)
            logging.error(err_msg)
            return json_error_response(err_msg)
        try:
            DruidDatasource.sync_to_db_from_config(
                druid_config, user, cluster)
        except Exception as e:
            logging.exception(utils.error_msg_from_exception(e))
            return json_error_response(utils.error_msg_from_exception(e))
        return Response(status=201)

    @has_access
    @expose('/sqllab_viz/', methods=['POST'])
    @log_this
    def sqllab_viz(self):
        SqlaTable = ConnectorRegistry.sources['table']
        data = json.loads(request.form.get('data'))
        table_name = data.get('datasourceName')
        table = (
            db.session.query(SqlaTable)
                .filter_by(table_name=table_name)
                .first()
        )

        saved_columns = {}
        saved_metrics = {}

        if not table:
            table = SqlaTable(table_name=table_name)
        else:
            for column in table.columns:
                saved_columns[column.column_name] = column

            for metric in table.metrics:
                saved_metrics[metric.metric_name] = metric

        table.database_id = data.get('dbId')
        table.schema = data.get('schema')
        q = SupersetQuery(data.get('sql'))
        table.sql = q.stripped()
        table.from_sql_lab = True
        db.session.add(table)
        db.session.commit()
        cols = []
        dims = []
        metrics = []
        for column_name, config in data.get('columns').items():
            is_dim = config.get('is_dim', False)
            SqlaTable = ConnectorRegistry.sources['table']
            TableColumn = SqlaTable.column_class
            SqlMetric = SqlaTable.metric_class
            col = TableColumn(
                column_name=column_name,
                filterable=is_dim,
                groupby=is_dim,
                is_dttm=config.get('is_date', False),
                type=config.get('type', False),
            )
            cols.append(col)
            if is_dim:
                dims.append(col)
            agg = config.get('agg')
            if agg:
                if agg == 'count_distinct':
                    metrics.append(SqlMetric(
                        metric_name='{agg}__{column_name}'.format(**locals()),
                        expression='COUNT(DISTINCT {column_name})'
                            .format(**locals()),
                    ))
                else:
                    metrics.append(SqlMetric(
                        metric_name='{agg}__{column_name}'.format(**locals()),
                        expression='{agg}({column_name})'.format(**locals()),
                    ))
        if not metrics:
            metrics.append(SqlMetric(
                metric_name='count'.format(**locals()),
                expression='count(*)'.format(**locals()),
            ))

        for column in cols:
            saved_columns.pop(column.column_name, None)

        for metric in metrics:
            saved_metrics.pop(metric.metric_name, None)

        if saved_metrics or saved_columns:
            errors = []

            for slice in db.session.query(models.Slice).filter_by(datasource_id=table.id):
                deleted_columns = set(saved_columns.keys()) & set(slice.form_data['groupby']
                                                                  + slice.form_data['all_columns'])
                deleted_metrics = set(saved_metrics.keys()) & set(slice.form_data['metrics'])

                if deleted_columns or deleted_metrics:
                    columns_str = (' показатели ' + ', '.join(deleted_columns)) if deleted_columns else ''
                    metric_str = (' метрики ' + ', '.join(deleted_metrics)) if deleted_metrics else ''
                    errors.append('В отчете "%s" используются%s%s' % (slice, columns_str, metric_str))

            if errors:
                return Response(
                    json.dumps({
                        'message': 'Удаленные поля найдены в отчетах. Необходимо вручную внести изменения в отчеты,'
                                   ' после чего, обновить структуру повторно.',
                        'details': errors
                    }),
                    status=400,
                    mimetype="application/json"
                )
        db.session.flush()

        for dependent_model in cols + metrics:
            dependent_model.table_id = table.id

        db.session.add_all(cols)
        db.session.add_all(metrics)

        db.session.commit()

        return self.json_response(json.dumps({
            'table_id': table.id,
        }))

    @has_access
    @expose('/table/<database_id>/<table_name>/<schema>/')
    @log_this
    def table(self, database_id, table_name, schema):
        schema = utils.js_string_to_python(schema)
        sql_table = db.session.query(SqlaTable).filter(
            SqlaTable.database_id == database_id,
            SqlaTable.table_name == table_name,
            or_(SqlaTable.schema.in_((schema, '')), SqlaTable.schema.is_(None))
        ).first()
        if sql_table:
            columns_verbose_name = {
                c.column_name: c.verbose_name for c in sql_table.columns
            }
        else:
            columns_verbose_name = {}
        mydb = db.session.query(models.Database).filter_by(id=database_id).one()
        payload_columns = []
        indexes = []
        primary_key = []
        foreign_keys = []
        try:
            columns = mydb.get_columns(table_name, schema)
            indexes = mydb.get_indexes(table_name, schema)
            primary_key = mydb.get_pk_constraint(table_name, schema)
            foreign_keys = mydb.get_foreign_keys(table_name, schema)
        except Exception as e:
            return json_error_response(utils.error_msg_from_exception(e))
        keys = []
        if primary_key and primary_key.get('constrained_columns'):
            primary_key['column_names'] = primary_key.pop('constrained_columns')
            primary_key['type'] = 'pk'
            keys += [primary_key]
        for fk in foreign_keys:
            fk['column_names'] = fk.pop('constrained_columns')
            fk['type'] = 'fk'
        keys += foreign_keys
        for idx in indexes:
            idx['type'] = 'index'
        keys += indexes

        for col in columns:
            dtype = ''
            try:
                dtype = '{}'.format(col['type'])
            except Exception:
                pass
            payload_columns.append({
                'name': col['name'],
                'type': dtype.split('(')[0] if '(' in dtype else dtype,
                'longType': dtype,
                'keys': [
                    k for k in keys
                    if col['name'] in k.get('column_names')
                ],
                'verbose_name': columns_verbose_name.get(col['name'])
            })
        tbl = {
            'name': table_name,
            'columns': payload_columns,
            'selectStar': mydb.select_star(
                table_name, schema=schema, show_cols=True, indent=True,
                cols=columns, latest_partition=False),
            'primaryKey': primary_key,
            'foreignKeys': foreign_keys,
            'indexes': keys,
        }
        return json_success(json.dumps(tbl))

    @has_access
    @expose('/extra_table_metadata/<database_id>/<table_name>/<schema>/')
    @log_this
    def extra_table_metadata(self, database_id, table_name, schema):
        schema = utils.js_string_to_python(schema)
        mydb = db.session.query(models.Database).filter_by(id=database_id).one()
        payload = mydb.db_engine_spec.extra_table_metadata(
            mydb, table_name, schema)
        return json_success(json.dumps(payload))

    @has_access
    @expose('/select_star/<database_id>/<table_name>/')
    @log_this
    def select_star(self, database_id, table_name):
        mydb = db.session.query(
            models.Database).filter_by(id=database_id).first()
        return self.render_template(
            'superset/ajah.html',
            content=mydb.select_star(table_name, show_cols=True),
        )

    @expose('/theme/')
    def theme(self):
        return self.render_template('superset/theme.html')

    @has_access_api
    @expose('/cached_key/<key>/')
    @log_this
    def cached_key(self, key):
        """Returns a key from the cache"""
        resp = cache.get(key)
        if resp:
            return resp
        return 'nope'

    @has_access_api
    @expose('/cache_key_exist/<key>/')
    @log_this
    def cache_key_exist(self, key):
        """Returns if a key from cache exist"""
        key_exist = True if cache.get(key) else False
        status = 200 if key_exist else 404
        return json_success(json.dumps({'key_exist': key_exist}),
                            status=status)

    @has_access_api
    @expose('/results/<key>/')
    @log_this
    def results(self, key):
        """Serves a key off of the results backend"""
        if not results_backend:
            return json_error_response("Results backend isn't configured")

        blob = results_backend.get(key)
        if not blob:
            return json_error_response(
                'Data could not be retrieved. '
                'You may want to re-run the query.',
                status=410,
            )

        query = db.session.query(Query).filter_by(results_key=key).one()
        rejected_tables = security_manager.rejected_datasources(
            query.sql, query.database, query.schema)
        if rejected_tables:
            return json_error_response(get_datasource_access_error_msg(
                '{}'.format(rejected_tables)))

        payload = utils.zlib_decompress_to_string(blob)
        display_limit = app.config.get('DISPLAY_SQL_MAX_ROW', None)
        if display_limit:
            payload_json = json.loads(payload)
            payload_json['data'] = payload_json['data'][:display_limit]
        return json_success(
            json.dumps(payload_json, default=utils.json_iso_dttm_ser))

    @has_access_api
    @expose('/dashboard/result/', methods=['POST'])
    @log_this
    def async_dashboard_result(self):
        """Retrieve data from async dashboard request"""
        if not results_backend:
            return json_error_response("Results backend isn't configured")
        data = dict()
        for identity in request.json:
            blob = results_backend.get(identity)
            if blob:
                data[identity] = json.loads(utils.zlib_decompress_to_string(blob))
                results_backend.delete(identity)
        if not data:
            return json_error_response(
                'Data could not be retrieved. '
                'You may want to re-run the query.',
                status=410,
            )
        return json_success(json.dumps(data))

    @has_access_api
    @expose('/stop_query/', methods=['POST'])
    @log_this
    def stop_query(self):
        client_id = request.form.get('client_id')
        try:
            query = (
                db.session.query(Query)
                    .filter_by(client_id=client_id).one()
            )
            query.status = utils.QueryStatus.STOPPED
            db.session.commit()
        except Exception:
            pass
        return self.json_response('OK')

    @has_access_api
    @expose('/sql_json/', methods=['POST', 'GET'])
    @log_this
    def sql_json(self):
        """Runs arbitrary sql and returns and json"""
        async = request.form.get('runAsync') == 'true'
        sql = request.form.get('sql')
        database_id = request.form.get('database_id')
        limit = request.form.get('limit') or 500
        offset = request.form.get('pageOffset') or 0
        schema = request.form.get('schema') or None
        template_params = json.loads(
            request.form.get('templateParams') or '{}')

        session = db.session()
        mydb = session.query(models.Database).filter_by(id=database_id).first()

        if not mydb:
            json_error_response(
                'Database with id {} is missing.'.format(database_id))

        rejected_tables = security_manager.rejected_datasources(sql, mydb, schema)
        if rejected_tables:
            return json_error_response(get_datasource_access_error_msg(
                '{}'.format(rejected_tables)))
        session.commit()

        select_as_cta = request.form.get('select_as_cta') == 'true'
        tmp_table_name = request.form.get('tmp_table_name')
        if select_as_cta and mydb.force_ctas_schema:
            tmp_table_name = '{}.{}'.format(
                mydb.force_ctas_schema,
                tmp_table_name,
            )

        query = Query(
            database_id=int(database_id),
            limit=int(app.config.get('SQL_MAX_ROW', None)),
            sql=sql,
            select_sql=sql,
            schema=schema,
            select_as_cta=request.form.get('select_as_cta') == 'true',
            start_time=utils.now_as_float(),
            tab_name=request.form.get('tab'),
            status=QueryStatus.PENDING if async else QueryStatus.RUNNING,
            sql_editor_id=request.form.get('sql_editor_id'),
            tmp_table_name=tmp_table_name,
            user_id=int(g.user.get_id()),
            client_id=request.form.get('client_id'),
        )
        session.add(query)
        session.flush()
        query_id = query.id
        session.commit()  # shouldn't be necessary
        if not query_id:
            raise Exception(_('Query record was not created as expected.'))
        logging.info('Triggering query_id: {}'.format(query_id))

        try:
            template_processor = get_template_processor(
                database=query.database, query=query)
            rendered_query = template_processor.process_template(
                query.sql,
                **template_params)
        except Exception as e:
            return json_error_response(
                'Template rendering failed: {}'.format(utils.error_msg_from_exception(e)))

        # Async request.
        if async:
            logging.info('Running query on a Celery worker')
            # Ignore the celery future object and the request may time out.
            try:
                sql_lab.get_sql_results.delay(
                    query_id,
                    rendered_query,
                    return_results=False,
                    store_results=not query.select_as_cta,
                    user_name=g.user.username,
                    limit=limit,
                    offset=offset)
            except Exception as e:
                logging.exception(e)
                msg = (
                    'Failed to start remote query on a worker. '
                    'Tell your administrator to verify the availability of '
                    'the message queue.'
                )
                query.status = QueryStatus.FAILED
                query.error_message = msg
                session.commit()
                return json_error_response('{}'.format(msg))

            resp = json_success(json.dumps(
                {'query': query.to_dict()}, default=utils.json_int_dttm_ser,
                allow_nan=False), status=202)
            session.commit()
            return resp

        # Sync request.
        try:
            timeout = config.get('SQLLAB_TIMEOUT')
            timeout_msg = (
                'The query exceeded the {timeout} seconds '
                'timeout.').format(**locals())
            with utils.timeout(seconds=timeout,
                               error_message=timeout_msg):
                # pylint: disable=no-value-for-parameter
                data = sql_lab.get_sql_results(
                    query_id,
                    rendered_query,
                    return_results=True,
                    limit=limit,
                    offset=offset)
            payload = json.dumps(
                data, default=utils.pessimistic_json_iso_dttm_ser)
        except Exception as e:
            logging.exception(e)
            return json_error_response('{}'.format(e))
        if data.get('status') == QueryStatus.FAILED:
            return json_error_response(payload=data)
        return json_success(payload)

    @has_access
    @expose('/csv/<client_id>')
    @log_this
    def csv(self, client_id):
        """Download the query results as csv."""
        logging.info('Exporting CSV file [{}]'.format(client_id))
        query = (
            db.session.query(Query)
                .filter_by(client_id=client_id)
                .one()
        )

        rejected_tables = security_manager.rejected_datasources(
            query.sql, query.database, query.schema)
        if rejected_tables:
            flash(get_datasource_access_error_msg('{}'.format(rejected_tables)))
            return redirect('/')
        conf = config.get('CSV_EXPORT')
        conf['encoding'] = 'utf-8'

        logging.info('Running a query to turn into CSV')
        sql = query.select_sql or query.executed_sql
        sql = query.database.wrap_sql_limit(sql, limit=config.get("ROW_LIMIT"))
        df = query.database.get_df(sql, query.schema)
        # TODO(bkyryliuk): add compression=gzip for big files.
        csv = df.to_csv(index=False, **conf)

        csv = codecs.BOM_UTF8 + csv.encode(conf['encoding'])

        response = Response(csv, mimetype='text/csv')
        response.headers['Content-Disposition'] = (
            'attachment; filename={}.csv'.format(unidecode(query.name)))
        logging.info('Ready to return response')
        return response

    @has_access
    @expose('/fetch_datasource_metadata')
    @log_this
    def fetch_datasource_metadata(self):
        datasource_id, datasource_type = (
            request.args.get('datasourceKey').split('__'))
        datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, db.session)
        # Check if datasource exists
        if not datasource:
            return json_error_response(DATASOURCE_MISSING_ERR)

        # Check permission for datasource
        if not security_manager.datasource_access(datasource):
            return json_error_response(DATASOURCE_ACCESS_ERR)
        return json_success(json.dumps(datasource.data()))

    @has_access
    @expose("/fetch_hierarchies")
    @log_this
    def fetch_hierarchies(self):
        hierarchies = [{'name': h.hier_name, 'id': h.id, 'table_id': h.table_id} for h in
                       db.session.query(TableHierarchy).all()]
        return json_success(json.dumps(hierarchies))

    @expose('/queries/<last_updated_ms>')
    def queries(self, last_updated_ms):
        """Get the updated queries."""
        stats_logger.incr('queries')
        if not g.user.get_id():
            return json_error_response(
                'Please login to access the queries.', status=403)

        # Unix time, milliseconds.
        last_updated_ms_int = int(float(last_updated_ms)) if last_updated_ms else 0

        # UTC date time, same that is stored in the DB.
        last_updated_dt = utils.EPOCH + timedelta(seconds=last_updated_ms_int / 1000)

        sql_queries = (
            db.session.query(Query)
                .filter(
                Query.user_id == g.user.get_id(),
                Query.changed_on >= last_updated_dt,
            )
                .all()
        )
        dict_queries = {q.client_id: q.to_dict() for q in sql_queries}
        return json_success(
            json.dumps(dict_queries, default=utils.json_int_dttm_ser))

    @has_access
    @expose('/search_queries')
    @log_this
    def search_queries(self):
        """Search for queries."""
        query = db.session.query(Query)
        search_user_id = request.args.get('user_id')
        database_id = request.args.get('database_id')
        search_text = request.args.get('search_text')
        status = request.args.get('status')
        # From and To time stamp should be Epoch timestamp in seconds
        from_time = request.args.get('from')
        to_time = request.args.get('to')

        if search_user_id:
            # Filter on db Id
            query = query.filter(Query.user_id == search_user_id)

        if database_id:
            # Filter on db Id
            query = query.filter(Query.database_id == database_id)

        if status:
            # Filter on status
            query = query.filter(Query.status == status)

        if search_text:
            # Filter on search text
            query = query \
                .filter(Query.sql.like('%{}%'.format(search_text)))

        if from_time:
            query = query.filter(Query.start_time > int(from_time))

        if to_time:
            query = query.filter(Query.start_time < int(to_time))

        query_limit = config.get('QUERY_SEARCH_LIMIT', 1000)
        sql_queries = (
            query.order_by(Query.start_time.asc())
                .limit(query_limit)
                .all()
        )

        dict_queries = [q.to_dict() for q in sql_queries]

        return Response(
            json.dumps(dict_queries, default=utils.json_int_dttm_ser),
            status=200,
            mimetype='application/json')

    @app.errorhandler(500)
    def show_traceback(self):
        return render_template(
            'superset/traceback.html',
            error_msg=get_error_msg(),
        ), 500

    @expose('/welcome')
    def welcome(self):
        """Personalized welcome page"""
        if not g.user or not g.user.get_id():
            return redirect(appbuilder.get_url_for_login)

        payload = {
            'user': bootstrap_user_data(),
            'common': self.common_bootsrap_payload(),
        }

        return self.render_template(
            'superset/basic.html',
            entry='welcome',
            title='Superset',
            bootstrap_data=json.dumps(payload, default=utils.json_iso_dttm_ser),
        )

    @has_access
    @expose('/profile/<username>/')
    def profile(self, username):
        """User profile page"""
        if not username and g.user:
            username = g.user.username

        payload = {
            'user': bootstrap_user_data(username, include_perms=True),
            'common': self.common_bootsrap_payload(),
        }

        return self.render_template(
            'superset/basic.html',
            title=username + "'s profile",
            entry='profile',
            bootstrap_data=json.dumps(payload, default=utils.json_iso_dttm_ser),
        )

    @has_access
    @expose('/sqllab')
    def sqllab(self):
        """SQL Editor"""
        d = {
            'defaultDbId': config.get('SQLLAB_DEFAULT_DBID'),
            'common': self.common_bootsrap_payload(),
        }
        return self.render_template(
            'superset/basic.html',
            entry='sqllab',
            bootstrap_data=json.dumps(d, default=utils.json_iso_dttm_ser),
        )

    @api
    @has_access_api
    @expose('/slice_query/<slice_id>/')
    def sliceQuery(self, slice_id):
        """
        This method exposes an API endpoint to
        get the database query string for this slice
        """
        viz_obj = self.get_viz(slice_id)
        if not security_manager.datasource_access(viz_obj.datasource):
            return json_error_response(DATASOURCE_ACCESS_ERR, status=401)
        return self.get_query_string_response(viz_obj)

    @api
    @has_access_api
    @expose('/get_column_data/<datasource_id>/<column_name>/', methods=['GET'])
    def get_column_data(self, datasource_id, column_name):
        text = request.args.get('text')
        limit = int(request.args.get('limit', 10))
        page = int(request.args.get('page', 0))
        offset = page * limit

        datasource_type = 'table'
        datasource = ConnectorRegistry.get_datasource(datasource_type, datasource_id, db.session)
        database = datasource.database
        sql = datasource.sql
        if sql:
            column = db.session.query(TableColumn).filter(
                TableColumn.table_id == datasource.id,
                TableColumn.column_name == column_name,
            ).first()
            column_type_str = str(column.type).upper()
            # if needed column is virtual
            if column and column.expression:
                sql = f"""SELECT {column.expression} as {column_name} FROM ({sql}) as expr_qry GROUP BY {column_name}"""
                filtered_df_len, values = models.sql_dataframe_filter(datasource, sql, column_name, text, limit, offset,
                                                                      column_type_str)
            else:
                filtered_df_len, values = models.sql_dataframe_filter(datasource, sql, column_name, text, limit, offset,
                                                                      column_type_str)
            total, total_rows = filtered_df_len, filtered_df_len
        else:
            table = database.get_table(datasource.table_name)
            column = getattr(table.c, column_name, db.session.query(TableColumn).filter(
                TableColumn.table_id == datasource.id,
                TableColumn.column_name == column_name,
            ).first())
            engine = database.get_sqla_engine()
            column_type_str = str(column.type).upper()
            is_clickhouse = engine.name == 'clickhouse'
            processed_column = column
            formatted_column = "CAST({column}, 'Nullable(String)')".format(column=column)
            virtual_calculated_field = isinstance(column, TableColumn) and column.expression
            if column_type_str.startswith(BaseColumn.date_types) and not virtual_calculated_field:
                date_format = None
                if is_clickhouse:
                    if column_type_str.startswith(('TIMESTAMP', 'DATETIME')):
                        date_format = '%d-%m-%Y %H:%M:%S'
                    elif column_type_str.startswith('DATE'):
                        date_format = '%d-%m-%Y'
                    elif column_type_str.startswith('TIME'):
                        date_format = '%H:%M:%S'
                    if date_format:
                        formatted_column = f"formatDateTime({column_name}, '{date_format}')"
                else:
                    if column_type_str.startswith(('TIMESTAMP', 'DATETIME')):
                        date_format = 'DD-MM-YYYY HH:MI:SS'
                    elif column_type_str.startswith('DATE'):
                        date_format = 'DD-MM-YYYY'
                    elif column_type_str.startswith('TIME'):
                        date_format = 'HH:MI:SS'
                    if date_format:
                        processed_column = func.to_char(column, date_format)

            if virtual_calculated_field:
                sql = f"""SELECT {column.expression} as {column_name} FROM {datasource.name} GROUP BY {column_name};"""
                filtered_df_len, values = models.sql_dataframe_filter(datasource, sql, column_name, text, limit, offset,
                                                                      column_type_str)
                total, total_rows = filtered_df_len, filtered_df_len
            else:
                if is_clickhouse:
                    query_count = """SELECT COUNT(DISTINCT {column}), COUNT({column})
                                     FROM {database}
                                     WHERE lowerUTF8({formatted_column}) LIKE lowerUTF8('%{text}%')
                    """.format(database=datasource.name, column=column_name, formatted_column=formatted_column,
                               text=text)
                else:
                    query_count = select([func.count(column).distinct(), func.count(column)]) \
                        .where(processed_column.ilike('%{}%'.format(text)))

                res = engine.execute(query_count)
                total, total_rows = list(res)[0]
                if offset >= total:
                    return self.json_response({'status': 'error'})

                if is_clickhouse:
                    query = """SELECT DISTINCT {column}, COUNT({column}) AS cnt
                               FROM {database}
                               WHERE lowerUTF8({formatted_column}) LIKE lowerUTF8('%{text}%')
                               GROUP BY {column} ORDER BY cnt DESC
                               LIMIT {offset}, {limit}
                    """.format(database=datasource.name, column=column_name, formatted_column=formatted_column,
                               text=text,
                               limit=limit, offset=offset)
                    results = engine.execute(query)
                else:
                    query = select([column, func.count(column).label('cnt')]) \
                        .group_by(column) \
                        .where(processed_column.ilike('%{}%'.format(text))) \
                        .distinct() \
                        .limit(limit)
                    if offset:
                        query = query.offset(offset)
                    results = engine.execute(query)
                values = [{'value': row[0], 'count': row[1]} for row in results]
        data = {'values': values, 'total': total, 'total_rows': total_rows}

        path = '{}?text={}&limit={}{}'.format(request.path, text, limit, '&page={}')
        if page > 1:
            data.update(prev_page=path.format(page - 1))
        if total > offset + limit:
            data.update(next_page=path.format(page + 1))

        return self.json_response(data, default=utils.json_without_timezone)

    @api
    @has_access_api
    @expose('/get_table_filters/', methods=['GET'])
    def get_table_filters(self):
        results = db.session.query(SqlaTable).filter(
            SqlaTable.sql != None
        ).filter(SqlaTable.sql != '').all()

        return self.json_response([
            (res.id, res.name) for res in results
            if security_manager.item_has_access(res, view_name='TableModelView')
        ])

    @log_this
    @has_access_api
    @expose('/html_to_pdf/', methods=['POST'])
    def html_to_pdf(self):
        html_body = request.form.get('html_body')
        pdf_params = request.form.get('pdf_params')
        json_params = {'html': html_body, 'emulateScreenMedia': False}

        if pdf_params:
            json_params['pdf'] = pdf_params

        if URL_TO_RENDER_PDF:
            try:
                response = requests.post(URL_TO_RENDER_PDF, json=json_params)
            except requests.RequestException:
                return json_error_response('Error sending request! url={url}', status=500)
            else:
                if response.status_code == 200:
                    return send_file(BytesIO(response.content),
                                     attachment_filename='export.pdf',
                                     as_attachment=True)
                else:
                    msg = f'Render service return error, code {response.status_code}, content {response.content}'
                    return json_error_response(msg, status=response.status_code)

        if PATH_TO_CHROME_EXE:
            try:
                cpdf = ChromePDF(PATH_TO_CHROME_EXE)
            except AssertionError:
                return json_error_response('Invalid body', status=400)
            with tempfile.NamedTemporaryFile(suffix='.pdf') as output_file:
                if cpdf.html_to_pdf(html_body, output_file):
                    return send_file(output_file.name,
                                     attachment_filename='export.pdf',
                                     as_attachment=True)
                else:
                    return json_error_response('Error generating pdf.', status=500)

        return json_error_response(f'Set in config `URL_TO_RENDER_PDF` or `PATH_TO_CHROME_EXE`', status=500)

    def get_available_slice_perms(self, slice):
        return [
            perm_name for perm_name in SLICE_DASH_PERMISSIONS
            if security_manager.item_has_access(
                slice, perm_name, view_name=SliceModelView.__name__
                if perm_name not in (CAN_EXPLORE, CAN_FORCE_UPDATE)
                else Superset.__name__
            )]


appbuilder.add_view_no_menu(Superset)


class CssTemplateModelView(SupersetModelView, DeleteMixin):
    datamodel = SQLAInterface(models.CssTemplate)
    list_columns = ['template_name']
    edit_columns = ['template_name', 'css']
    add_columns = edit_columns
    label_columns = {
        'template_name': _('Template Name'),
        'changed_by': _('Changed by'),
        'css': _('CSS'),
        'changed_on': _('Changed on'),
        'created_on': _('Created on'),
        'created_by': _('Created by'),
    }

    list_title = _('List CSS Template')
    show_title = _('Show CSS Template')
    add_title = _('Add CSS Template')
    edit_title = _('Edit CSS Template')


class CssTemplateAsyncModelView(CssTemplateModelView):
    list_columns = ['template_name', 'css']


appbuilder.add_separator('Sources')
appbuilder.add_view(
    CssTemplateModelView,
    'CSS Templates',
    label=__('CSS Templates'),
    icon='fa-css3',
    category='Manage',
    category_label=__('Manage'),
    category_icon='')

appbuilder.add_view_no_menu(CssTemplateAsyncModelView)

appbuilder.add_link(
    'SQL Editor',
    label=_('SQL Editor'),
    href='/superset/sqllab',
    category_icon='fa-flask',
    icon='fa-flask',
    category='SQL Lab',
    category_label=__('SQL Lab'),
)

appbuilder.add_link(
    'Query Search',
    label=_('Query Search'),
    href='/superset/sqllab#search',
    icon='fa-search',
    category_icon='fa-flask',
    category='SQL Lab',
    category_label=__('SQL Lab'),
)

appbuilder.add_link(
    'Upload a CSV',
    label=__('Upload a CSV'),
    href='/csvtodatabaseview/form',
    icon='fa-upload',
    category='Sources',
    category_label=__('Sources'),
    category_icon='fa-wrench')
appbuilder.add_separator('Sources')


@app.after_request
def apply_caching(response):
    """Applies the configuration's http headers to all responses"""
    for k, v in config.get('HTTP_HEADERS').items():
        response.headers[k] = v
    return response


# ---------------------------------------------------------------------
# Redirecting URL from previous names
class RegexConverter(BaseConverter):
    def __init__(self, url_map, *items):
        super(RegexConverter, self).__init__(url_map)
        self.regex = items[0]


app.url_map.converters['regex'] = RegexConverter


@app.route('/<regex("panoramix\/.*"):url>')
def panoramix(url):  # noqa
    return redirect(request.full_path.replace('panoramix', 'superset'))


@app.route('/<regex("caravel\/.*"):url>')
def caravel(url):  # noqa
    return redirect(request.full_path.replace('caravel', 'superset'))

# ---------------------------------------------------------------------
