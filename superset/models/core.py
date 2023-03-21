# -*- coding: utf-8 -*-
"""A collection of ORM sqlalchemy models for Superset"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import codecs
import csv
import functools
import json
import logging
import re
import textwrap
from copy import copy, deepcopy
from datetime import datetime, timezone
from io import BytesIO

import numpy
import pandas as pd
from pandas.api.types import is_datetime64_any_dtype
import sqlalchemy as sqla
from flask import escape, g, Markup, request
from flask_appbuilder import Model
from flask_appbuilder.models.decorators import renders
from flask_babel import lazy_gettext as _
from future.standard_library import install_aliases
from sqlalchemy import (
    Boolean, Column, create_engine, DateTime, ForeignKey, func, Integer,
    MetaData, String, Table, Text, JSON
)
from sqlalchemy.engine import url
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import relationship, subqueryload
from sqlalchemy.orm.session import make_transient
from sqlalchemy.pool import NullPool
from sqlalchemy.schema import UniqueConstraint
from sqlalchemy_mptt import BaseNestedSets
from sqlalchemy_utils import EncryptedType

from superset import app, db, db_engine_specs, security_manager, utils
from superset.connectors.connector_registry import ConnectorRegistry
from superset.models.helpers import AuditMixinNullable, ImportMixin, set_perm
from superset.viz import viz_types

install_aliases()
from urllib import parse  # noqa

config = app.config
custom_password_store = config.get('SQLALCHEMY_CUSTOM_PASSWORD_STORE')
stats_logger = config.get('STATS_LOGGER')
metadata = Model.metadata  # pylint: disable=no-member

LOGGING_OBJ_TYPE_NAMES = {
    'TableColumn': _('TableColumn'),
    'TableColumn expression': _('TableColumn expression'),
    'SqlMetric': _('SqlMetric'),
    'TableHierarchy': _('TableHierarchy'),
    'TableHierarchyColumn': _('TableHierarchyColumn'),
}
PASSWORD_MASK = 'X' * 10
DATETIME_CHECK = {'TIMESTAMP', 'DATETIME'}


def check_val(val, column_type_str):
    if type(val) == pd.Timestamp:
        if column_type_str == 'DATE':
            val = val.date()
        elif column_type_str in DATETIME_CHECK:
            val -= val.utcoffset()
            val = val.tz_localize(None)
    return val


def sql_dataframe_filter(datasource, sql, column_name, text, limit, offset, column_type_str=None):
    df = datasource.database.get_df(sql, datasource.schema or 'public')
    if column_type_str in DATETIME_CHECK:
        df[column_name] = pd.to_datetime(
            pd.to_datetime(df[column_name], utc=True).dt.tz_convert(datetime.now(timezone.utc).astimezone().tzinfo),
            format='%Y-%m-%d %H:%M:%S')
    filtered_df = df[df[column_name].astype(str).str.contains(text, case=False)][column_name].value_counts()
    results = filtered_df.nlargest(limit + offset).tail(limit)
    values = [{'value': check_val(value, column_type_str),
               'count': value_count} for value, value_count in results.iteritems()]
    filtered_df_len = len(filtered_df)
    return filtered_df_len, values


def set_related_perm(mapper, connection, target):  # noqa
    src_class = target.cls_model
    id_ = target.datasource_id
    if id_:
        ds = db.session.query(src_class).filter_by(id=int(id_)).first()
        if ds:
            target.perm = ds.perm


class Url(Model, AuditMixinNullable):
    """Used for the short url feature"""

    __tablename__ = 'url'
    id = Column(Integer, primary_key=True)
    url = Column(Text)


class KeyValue(Model):
    """Used for any type of key-value store"""

    __tablename__ = 'keyvalue'
    id = Column(Integer, primary_key=True)
    value = Column(Text, nullable=False)


class CssTemplate(Model, AuditMixinNullable):
    """CSS templates for dashboards"""

    __tablename__ = 'css_templates'
    id = Column(Integer, primary_key=True)
    template_name = Column(String(250))
    css = Column(Text, default='')


slice_user = Table('slice_user', metadata,
                   Column('id', Integer, primary_key=True),
                   Column('user_id', Integer, ForeignKey('ab_user.id')),
                   Column('slice_id', Integer, ForeignKey('slices.id')))


class Slice(Model, AuditMixinNullable, ImportMixin):
    """A slice is essentially a report or a view on data"""

    __tablename__ = 'slices'
    id = Column(Integer, primary_key=True)
    slice_name = Column(String(250))
    datasource_id = Column(Integer)
    datasource_type = Column(String(200))
    datasource_name = Column(String(2000))
    viz_type = Column(String(250))
    params = Column(Text)
    description = Column(Text)
    cache_timeout = Column(Integer)
    perm = Column(String(1000))
    owners = relationship(security_manager.user_model, secondary=slice_user)

    folder_id = Column(Integer, ForeignKey('slice_folders.id'))
    folder = relationship('SliceFolders', back_populates="objects")

    export_fields = ('slice_name', 'datasource_type', 'datasource_name',
                     'viz_type', 'params', 'cache_timeout')

    def __repr__(self):
        return self.slice_name

    @property
    def cls_model(self):
        return ConnectorRegistry.sources[self.datasource_type]

    @property
    def datasource(self):
        return self.get_datasource

    def clone(self):
        return Slice(
            slice_name=self.slice_name,
            datasource_id=self.datasource_id,
            datasource_type=self.datasource_type,
            datasource_name=self.datasource_name,
            viz_type=self.viz_type,
            params=self.params,
            description=self.description,
            cache_timeout=self.cache_timeout)

    @datasource.getter
    @utils.memoized
    def get_datasource(self):
        return (
            db.session.query(self.cls_model)
                .filter_by(id=self.datasource_id)
                .first()
        )

    @renders('datasource_name')
    def datasource_link(self):
        # pylint: disable=no-member
        datasource = self.datasource
        return datasource.link if datasource else None

    @property
    def datasource_edit_url(self):
        # pylint: disable=no-member
        datasource = self.datasource
        return datasource.url if datasource else None

    @property
    @utils.memoized
    def viz(self):
        d = json.loads(self.params)
        viz_class = viz_types[self.viz_type]
        # pylint: disable=no-member
        return viz_class(self.datasource, form_data=d)

    @property
    def description_markeddown(self):
        return utils.markdown(self.description)

    @property
    def data(self):
        """Data used to render slice in templates"""
        d = {}
        self.token = ''
        try:
            d = self.viz.data
            self.token = d.get('token')
        except Exception as e:
            logging.exception(e)
            d['error'] = str(e)
        return {
            'datasource': self.datasource_name,
            'description': self.description,
            'description_markeddown': self.description_markeddown,
            'edit_url': self.edit_url,
            'form_data': self.form_data,
            'slice_id': self.id,
            'slice_name': self.slice_name,
            'slice_url': self.slice_url,
            'allow_run_async': self.datasource.database.allow_run_async
        }

    @property
    def json_data(self):
        return json.dumps(self.data)

    @property
    def form_data(self):
        form_data = {}
        try:
            form_data = json.loads(self.params)
        except Exception as e:
            logging.error("Malformed json in slice's params")
            logging.exception(e)
        form_data.update({
            'folder_id': self.folder_id,
            'slice_id': self.id,
            'viz_type': self.viz_type,
            'datasource': '{}__{}'.format(
                self.datasource_id, self.datasource_type),
            'allow_run_async': self.datasource.database.allow_run_async
        })
        if self.cache_timeout:
            form_data['cache_timeout'] = self.cache_timeout
        return form_data

    def get_explore_url(self, base_url='/superset/explore', overrides=None):
        overrides = overrides or {}
        form_data = {'slice_id': self.id, 'fields_by_slice': True}
        form_data.update(overrides)
        params = parse.quote(json.dumps(form_data))
        return (
            '{base_url}/?form_data={params}'.format(**locals()))

    @property
    def slice_url(self):
        """Defines the url to access the slice"""
        return self.get_explore_url()

    @property
    def explore_json_url(self):
        """Defines the url to access the slice"""
        return self.get_explore_url('/superset/explore_json')

    @property
    def edit_url(self):
        return '/slicemodelview/edit/{}'.format(self.id)

    @property
    def slice_link(self):
        url = self.slice_url
        name = escape(self.slice_name)
        return Markup('<a href="{url}">{name}</a>'.format(**locals()))

    def get_viz(self, force=False):
        """Creates :py:class:viz.BaseViz object from the url_params_multidict.

        :return: object of the 'viz_type' type that is taken from the
            url_params_multidict or self.params.
        :rtype: :py:class:viz.BaseViz
        """
        slice_params = json.loads(self.params)
        slice_params['slice_id'] = self.id
        slice_params['json'] = 'false'
        slice_params['slice_name'] = self.slice_name
        slice_params['viz_type'] = self.viz_type if self.viz_type else 'table'

        return viz_types[slice_params.get('viz_type')](
            self.datasource,
            form_data=slice_params,
            force=force,
        )

    @classmethod
    def import_obj(cls, slc_to_import, slc_to_override, import_time=None):
        """Inserts or overrides slc in the database.

        remote_id and import_time fields in params_dict are set to track the
        slice origin and ensure correct overrides for multiple imports.
        Slice.perm is used to find the datasources and connect them.

        :param Slice slc_to_import: Slice object to import
        :param Slice slc_to_override: Slice to replace, id matches remote_id
        :returns: The resulting id for the imported slice
        :rtype: int
        """
        session = db.session
        make_transient(slc_to_import)
        slc_to_import.dashboards = []
        slc_to_import.alter_params(
            remote_id=slc_to_import.id, import_time=import_time)

        slc_to_import = slc_to_import.copy()
        params = slc_to_import.params_dict
        slc_to_import.datasource_id = ConnectorRegistry.get_datasource_by_name(
            session, slc_to_import.datasource_type, params['datasource_name'],
            params['schema'], params['database_name']).id
        if slc_to_override:
            slc_to_override.override(slc_to_import)
            session.flush()
            return slc_to_override.id
        session.add(slc_to_import)
        logging.info('Final slice: {}'.format(slc_to_import.to_json()))
        session.flush()
        return slc_to_import.id

    def get_perm(self):
        return ('[slice].(id:{obj.id})').format(obj=self)


sqla.event.listen(Slice, 'before_insert', set_related_perm)
sqla.event.listen(Slice, 'before_update', set_related_perm)

dashboard_slices = Table(
    'dashboard_slices', metadata,
    Column('id', Integer, primary_key=True),
    Column('dashboard_id', Integer, ForeignKey('dashboards.id')),
    Column('slice_id', Integer, ForeignKey('slices.id')),
)

dashboard_user = Table(
    'dashboard_user', metadata,
    Column('id', Integer, primary_key=True),
    Column('user_id', Integer, ForeignKey('ab_user.id')),
    Column('dashboard_id', Integer, ForeignKey('dashboards.id')),
)


class UserFilterSettings(Model):
    """

    """
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('ab_user.id'))
    dashboard_id = Column(Integer, ForeignKey('dashboards.id', ondelete='CASCADE'))
    json = Column(Text)


class Dashboard(Model, AuditMixinNullable, ImportMixin):
    """The dashboard object!"""

    __tablename__ = 'dashboards'
    id = Column(Integer, primary_key=True)
    dashboard_title = Column(String(500))
    position_json = Column(Text)
    description = Column(Text)
    css = Column(Text)
    json_metadata = Column(Text)
    slug = Column(String(255), unique=True)
    slices = relationship(
        'Slice', secondary=dashboard_slices, backref='dashboards')
    owners = relationship(security_manager.user_model, secondary=dashboard_user)

    folder_id = Column(Integer, ForeignKey('dashboard_folders.id'))
    folder = relationship('DashboardFolders', back_populates="objects")

    export_fields = ('dashboard_title', 'position_json', 'json_metadata',
                     'description', 'css', 'slug')

    def __repr__(self):
        return self.dashboard_title

    @property
    def table_names(self):
        # pylint: disable=no-member
        return ', '.join(
            {'{}'.format(s.datasource.full_name) for s in self.slices})

    @property
    def url(self):
        return '/superset/dashboard/{}/'.format(self.slug or self.id)

    @property
    def datasources(self):
        return {slc.datasource for slc in self.slices}

    @property
    def sqla_metadata(self):
        # pylint: disable=no-member
        metadata = MetaData(bind=self.get_sqla_engine())
        return metadata.reflect()

    def dashboard_link(self):
        title = escape(self.dashboard_title)
        return Markup(
            '<a href="{self.url}">{title}</a>'.format(**locals()))

    @property
    def data(self):
        positions = self.position_json
        if positions:
            positions = json.loads(positions)
        return {
            'id': self.id,
            'metadata': self.params_dict,
            'css': self.css,
            'dashboard_title': self.dashboard_title,
            'slug': self.slug,
            'slices': [slc.data for slc in self.slices],
            'position_json': positions,
            'folder_id': self.folder_id,
        }

    @property
    def params(self):
        return self.json_metadata

    @params.setter
    def params(self, value):
        self.json_metadata = value

    @property
    def position_array(self):
        if self.position_json:
            return json.loads(self.position_json)
        return []

    @classmethod
    def import_slices(cls, import_time, dashboard_to_import=None, import_slices=None):
        session = db.session

        if dashboard_to_import is not None:
            slices = copy(dashboard_to_import.slices)
            i_params_dict = dashboard_to_import.params_dict
        elif import_slices is not None:
            slices = import_slices
            i_params_dict = {}
        else:
            slices = []
            i_params_dict = {}

        old_to_new_slc_id_dict = {}
        new_filter_immune_slices = []
        new_timed_refresh_immune_slices = []
        new_expanded_slices = {}
        remote_id_slice_map = {
            slc.params_dict['remote_id']: slc
            for slc in session.query(Slice).all()
            if 'remote_id' in slc.params_dict
        }

        for slc in slices:
            if dashboard_to_import is not None:
                logging.info('Importing slice {} from the dashboard: {}'.format(
                    slc.to_json(), dashboard_to_import.dashboard_title))
            else:
                logging.info(f'Importing slice {slc.to_json()}')

            remote_slc = remote_id_slice_map.get(slc.id)
            new_slc_id = Slice.import_obj(slc, remote_slc, import_time=import_time)
            old_to_new_slc_id_dict[slc.id] = new_slc_id
            # update json metadata that deals with slice ids
            new_slc_id_str = '{}'.format(new_slc_id)
            old_slc_id_str = '{}'.format(slc.id)
            if ('filter_immune_slices' in i_params_dict and
                    old_slc_id_str in i_params_dict['filter_immune_slices']):
                new_filter_immune_slices.append(new_slc_id_str)
            if ('timed_refresh_immune_slices' in i_params_dict and
                    old_slc_id_str in
                    i_params_dict['timed_refresh_immune_slices']):
                new_timed_refresh_immune_slices.append(new_slc_id_str)
            if ('expanded_slices' in i_params_dict and
                    old_slc_id_str in i_params_dict['expanded_slices']):
                new_expanded_slices[new_slc_id_str] = (
                    i_params_dict['expanded_slices'][old_slc_id_str])

        return old_to_new_slc_id_dict, new_expanded_slices, new_filter_immune_slices, new_timed_refresh_immune_slices

    @classmethod
    def import_obj(cls, dashboard_to_import, import_time=None):
        """Imports the dashboard from the object to the database.

         Once dashboard is imported, json_metadata field is extended and stores
         remote_id and import_time. It helps to decide if the dashboard has to
         be overridden or just copies over. Slices that belong to this
         dashboard will be wired to existing tables. This function can be used
         to import/export dashboards between multiple superset instances.
         Audit metadata isn't copied over.
        """

        def alter_positions(dashboard, old_to_new_slc_id_dict):
            """ Updates slice_ids in the position json.

            Sample position json:
            [{
                "col": 5,
                "row": 10,
                "size_x": 4,
                "size_y": 2,
                "slice_id": "3610"
            }]
            """
            position_array = dashboard.position_array
            for position in position_array:
                if 'slice_id' not in position:
                    continue
                old_slice_id = int(position['slice_id'])
                if old_slice_id in old_to_new_slc_id_dict:
                    position['slice_id'] = '{}'.format(
                        old_to_new_slc_id_dict[old_slice_id])
            dashboard.position_json = json.dumps(position_array)

        logging.info('Started import of the dashboard: {}'
                     .format(dashboard_to_import.to_json()))
        session = db.session
        logging.info('Dashboard has {} slices'
                     .format(len(dashboard_to_import.slices)))
        # copy slices object as Slice.import_slice will mutate the slice
        # and will remove the existing dashboard - slice association

        # override the dashboard
        existing_dashboard = None
        for dash in session.query(Dashboard).all():
            if ('remote_id' in dash.params_dict and
                    dash.params_dict['remote_id'] ==
                    dashboard_to_import.id):
                existing_dashboard = dash

        old_to_new_slc_id_dict, new_expanded_slices, \
        new_filter_immune_slices, new_timed_refresh_immune_slices = cls.import_slices(
            import_time, dashboard_to_import=dashboard_to_import)

        # dashboard_to_import.id = None
        alter_positions(dashboard_to_import, old_to_new_slc_id_dict)
        dashboard_to_import.alter_params(import_time=import_time)
        if new_expanded_slices:
            dashboard_to_import.alter_params(
                expanded_slices=new_expanded_slices)
        if new_filter_immune_slices:
            dashboard_to_import.alter_params(
                filter_immune_slices=new_filter_immune_slices)
        if new_timed_refresh_immune_slices:
            dashboard_to_import.alter_params(
                timed_refresh_immune_slices=new_timed_refresh_immune_slices)

        new_slices = session.query(Slice).filter(
            Slice.id.in_(old_to_new_slc_id_dict.values())).all()

        if existing_dashboard:
            existing_dashboard.override(dashboard_to_import)
            existing_dashboard.slices = new_slices
            session.flush()
            return existing_dashboard.id
        else:
            # session.add(dashboard_to_import) causes sqlachemy failures
            # related to the attached users / slices. Creating new object
            # allows to avoid conflicts in the sql alchemy state.
            copied_dash = dashboard_to_import.copy()
            copied_dash.slices = new_slices
            session.add(copied_dash)
            session.flush()
            return copied_dash.id

    @classmethod
    def _get_slices_url_drilldowns_data(cls, slices):
        slices_data = set()
        dashboards_data = set()
        for s in slices:
            for drilldown in s.params_dict.get('url_drilldowns', []):
                if drilldown['type'] == 'dashboards':
                    dashboards_data.add(
                        db.session.query(Dashboard)
                            .filter_by(id=drilldown['url']).first()
                    )
                elif drilldown['type'] == 'slices':
                    slice = db.session.query(Slice).filter_by(id=drilldown['url']).first()

                    if not slice:
                        continue

                    slice.alter_params(
                        remote_id=slice.id,
                        datasource_name=slice.datasource.name,
                        schema=slice.datasource.name,
                        database_name=slice.datasource.database.name,
                    )
                    slices_data.add(slice)
                else:
                    continue
        return slices_data, dashboards_data

    @classmethod
    def get_slices_url_drilldowns_data(cls, dashboards_slices, depth):
        slices = set(dashboards_slices)
        dashboards = set()
        for i in range(depth):
            slices_data, dashboards_data = cls._get_slices_url_drilldowns_data(slices)
            slices = slices_data | slices
            dashboards = dashboards | dashboards_data
        slices = slices - set(dashboards_slices)
        return slices, dashboards

    @classmethod
    def export_dashboards(cls, dashboard_ids):
        all_dashboards_slices = set()

        def prepare_dashboards(dashboard_ids, consider_dd=False):
            all_dd_dashboards = set()
            all_dd_slices = set()

            copied_dashboards = []
            datasource_ids = set()

            for dashboard_id in dashboard_ids:
                # make sure that dashboard_id is an integer
                dashboard_id = int(dashboard_id)
                copied_dashboard = (
                    db.session.query(Dashboard)
                        .options(subqueryload(Dashboard.slices))
                        .filter_by(id=dashboard_id).first()
                )
                make_transient(copied_dashboard)
                for slc in copied_dashboard.slices:
                    datasource_ids.add((slc.datasource_id, slc.datasource_type))
                    # add extra params for the import
                    slc.alter_params(
                        remote_id=slc.id,
                        datasource_name=slc.datasource.name,
                        schema=slc.datasource.name,
                        database_name=slc.datasource.database.name,
                    )
                    all_dashboards_slices.add(slc)

                copied_dashboard.alter_params(remote_id=dashboard_id)
                copied_dashboards.append(copied_dashboard)

                if consider_dd:
                    dd_slices, dd_dashboards = cls.get_slices_url_drilldowns_data(copied_dashboard.slices, 3)
                    all_dd_dashboards = all_dd_dashboards | dd_dashboards
                    all_dd_slices = all_dd_slices | dd_slices

            eager_datasources = []
            for dashboard_id, dashboard_type in datasource_ids:
                eager_datasource = ConnectorRegistry.get_eager_datasource(
                    db.session, dashboard_type, dashboard_id)
                eager_datasource.alter_params(
                    remote_id=eager_datasource.id,
                    database_name=eager_datasource.database.name,
                )
                make_transient(eager_datasource)
                eager_datasources.append(eager_datasource)

            return eager_datasources, copied_dashboards, all_dd_dashboards, all_dd_slices

        eager_datasources, copied_dashboards, \
        all_dd_dashboards, all_dd_slices = prepare_dashboards(dashboard_ids, consider_dd=True)

        all_dd_slices.difference(all_dashboards_slices)
        all_dd_dashboards.difference(set(copied_dashboards))

        if all_dd_dashboards:
            dd_eager_datasources, dd_copied_dashboards, *_ = prepare_dashboards([dash.id for dash in all_dd_dashboards])
        else:
            dd_eager_datasources = []
            dd_copied_dashboards = []

        return json.dumps({
            'dashboards': copied_dashboards,
            'datasources': list(set(eager_datasources) | set(dd_eager_datasources)),
            'dd_slices': list(all_dd_slices),
            'dd_dashboards': dd_copied_dashboards,
        }, cls=utils.DashboardEncoder, indent=4)

    def get_perm(self):
        return ('[dashboard].(id:{obj.id})').format(obj=self)


class Database(Model, AuditMixinNullable, ImportMixin):
    """An ORM object that stores Database related information"""

    __tablename__ = 'dbs'
    type = 'table'
    __table_args__ = (UniqueConstraint('database_name'),)

    id = Column(Integer, primary_key=True)
    verbose_name = Column(String(250), unique=True)
    # short unique name, used in permissions
    database_name = Column(String(250), unique=True)
    sqlalchemy_uri = Column(String(1024))
    password = Column(EncryptedType(String(1024), config.get('SECRET_KEY')))
    cache_timeout = Column(Integer)
    select_as_create_table_as = Column(Boolean, default=False)
    expose_in_sqllab = Column(Boolean, default=False)
    allow_run_sync = Column(Boolean, default=True)
    allow_run_async = Column(Boolean, default=False)
    allow_ctas = Column(Boolean, default=False)
    allow_dml = Column(Boolean, default=False)
    force_ctas_schema = Column(String(250))
    allow_multi_schema_metadata_fetch = Column(Boolean, default=True)
    extra = Column(Text, default=textwrap.dedent("""\
    {
        "metadata_params": {},
        "engine_params": {}
    }
    """))
    perm = Column(String(1000))

    impersonate_user = Column(Boolean, default=False)
    export_fields = ('database_name', 'sqlalchemy_uri', 'cache_timeout',
                     'expose_in_sqllab', 'allow_run_sync', 'allow_run_async',
                     'allow_ctas', 'extra')
    export_children = ['tables']

    def __repr__(self):
        return self.verbose_name if self.verbose_name else self.database_name

    @property
    def name(self):
        return self.verbose_name if self.verbose_name else self.database_name

    @property
    def data(self):
        return {
            'name': self.database_name,
            'backend': self.backend,
            'allow_multi_schema_metadata_fetch':
                self.allow_multi_schema_metadata_fetch,
        }

    @property
    def unique_name(self):
        return self.database_name

    @property
    def backend(self):
        url = make_url(self.sqlalchemy_uri_decrypted)
        return url.get_backend_name()

    @classmethod
    def get_password_masked_url_from_uri(cls, uri):
        url = make_url(uri)
        return cls.get_password_masked_url(url)

    @classmethod
    def get_password_masked_url(cls, url):
        url_copy = deepcopy(url)
        if url_copy.password is not None and url_copy.password != PASSWORD_MASK:
            url_copy.password = PASSWORD_MASK
        return url_copy

    def set_sqlalchemy_uri(self, uri):
        conn = sqla.engine.url.make_url(uri.strip())
        if conn.password != PASSWORD_MASK and not custom_password_store:
            # do not over-write the password with the password mask
            self.password = conn.password
        conn.password = PASSWORD_MASK if conn.password else None
        self.sqlalchemy_uri = str(conn)  # hides the password

    def get_effective_user(self, url, user_name=None):
        """
        Get the effective user, especially during impersonation.
        :param url: SQL Alchemy URL object
        :param user_name: Default username
        :return: The effective username
        """
        effective_username = None
        if self.impersonate_user:
            effective_username = url.username
            if user_name:
                effective_username = user_name
            elif (
                    hasattr(g, 'user') and hasattr(g.user, 'username') and
                    g.user.username is not None
            ):
                effective_username = g.user.username
        return effective_username

    @utils.memoized(
        watch=('impersonate_user', 'sqlalchemy_uri_decrypted', 'extra'))
    def get_sqla_engine(self, schema=None, nullpool=True, user_name=None):
        extra = self.get_extra()
        url = make_url(self.sqlalchemy_uri_decrypted)
        url = self.db_engine_spec.adjust_database_uri(url, schema)
        effective_username = self.get_effective_user(url, user_name)
        # If using MySQL or Presto for example, will set url.username
        # If using Hive, will not do anything yet since that relies on a
        # configuration parameter instead.
        self.db_engine_spec.modify_url_for_impersonation(
            url,
            self.impersonate_user,
            effective_username)

        masked_url = self.get_password_masked_url(url)
        logging.info('Database.get_sqla_engine(). Masked URL: {0}'.format(masked_url))

        params = extra.get('engine_params', {})
        if nullpool:
            params['poolclass'] = NullPool

        # If using Hive, this will set hive.server2.proxy.user=$effective_username
        configuration = {}
        configuration.update(
            self.db_engine_spec.get_configuration_for_impersonation(
                str(url),
                self.impersonate_user,
                effective_username))
        if configuration:
            params['connect_args'] = {'configuration': configuration}

        DB_CONNECTION_MUTATOR = config.get('DB_CONNECTION_MUTATOR')
        if DB_CONNECTION_MUTATOR:
            url, params = DB_CONNECTION_MUTATOR(
                url, params, effective_username, security_manager)
        return create_engine(url, **params)

    def get_reserved_words(self):
        return self.get_dialect().preparer.reserved_words

    def get_quoter(self):
        return self.get_dialect().identifier_preparer.quote

    def get_df(self, sql, schema):
        sql = sql.strip().strip(';')
        eng = self.get_sqla_engine(schema=schema)
        df = pd.read_sql(sql, eng)

        def needs_conversion(df_series):
            if df_series.empty:
                return False
            if isinstance(df_series[0], (list, dict)):
                return True
            return False

        for k, v in df.dtypes.items():
            if v.type == numpy.object_ and needs_conversion(df[k]):
                df[k] = df[k].apply(utils.json_dumps_w_dates)
            elif is_datetime64_any_dtype(df[k]):
                df[k] = df[k].dt.tz_localize(None)
        return df

    def compile_sqla_query(self, qry, schema=None):
        eng = self.get_sqla_engine(schema=schema)
        compiled = qry.compile(eng, compile_kwargs={'literal_binds': True})
        return '{}'.format(compiled)

    def select_star(
            self, table_name, schema=None, limit=100, show_cols=False,
            indent=True, latest_partition=True, cols=None):
        """Generates a ``select *`` statement in the proper dialect"""
        return self.db_engine_spec.select_star(
            self, table_name, schema=schema, limit=limit, show_cols=show_cols,
            indent=indent, latest_partition=latest_partition, cols=cols)

    def wrap_sql_limit(self, sql, limit=1000, offset=0):
        return self.db_engine_spec.wrap_sql_limit(sql=sql, limit=limit, offset=offset, database=self)

    def safe_sqlalchemy_uri(self):
        return self.sqlalchemy_uri

    @property
    def inspector(self):
        engine = self.get_sqla_engine()
        return sqla.inspect(engine)

    def all_table_names(self, schema=None, force=False):
        if not schema:
            if not self.allow_multi_schema_metadata_fetch:
                return []
            tables_dict = self.db_engine_spec.fetch_result_sets(
                self, 'table', force=force)
            return tables_dict.get('', [])
        return sorted(
            self.db_engine_spec.get_table_names(schema, self.inspector))

    def all_view_names(self, schema=None, force=False):
        if not schema:
            if not self.allow_multi_schema_metadata_fetch:
                return []
            views_dict = self.db_engine_spec.fetch_result_sets(
                self, 'view', force=force)
            return views_dict.get('', [])
        views = []
        try:
            views = self.inspector.get_view_names(schema)
        except Exception:
            pass
        return views

    def all_schema_names(self):
        return sorted(self.db_engine_spec.get_schema_names(self.inspector))

    @property
    def db_engine_spec(self):
        return db_engine_specs.engines.get(
            self.backend, db_engine_specs.BaseEngineSpec)

    @classmethod
    def get_db_engine_spec_for_backend(cls, backend):
        return db_engine_specs.engines.get(backend, db_engine_specs.BaseEngineSpec)

    def grains(self):
        """Defines time granularity database-specific expressions.

        The idea here is to make it easy for users to change the time grain
        form a datetime (maybe the source grain is arbitrary timestamps, daily
        or 5 minutes increments) to another, "truncated" datetime. Since
        each database has slightly different but similar datetime functions,
        this allows a mapping between database engines and actual functions.
        """
        return self.db_engine_spec.time_grains

    def grains_dict(self):
        return {grain.duration: grain for grain in self.grains()}

    def get_extra(self):
        extra = {}
        if self.extra:
            try:
                extra = json.loads(self.extra)
            except Exception as e:
                logging.error(e)
        return extra

    def get_table(self, table_name, schema=None):
        extra = self.get_extra()
        meta = MetaData(**extra.get('metadata_params', {}))
        return Table(
            table_name, meta,
            schema=schema or None,
            autoload=True,
            autoload_with=self.get_sqla_engine())

    def get_columns(self, table_name, schema=None):
        return self.inspector.get_columns(table_name, schema)

    def get_indexes(self, table_name, schema=None):
        return self.inspector.get_indexes(table_name, schema)

    def get_pk_constraint(self, table_name, schema=None):
        return self.inspector.get_pk_constraint(table_name, schema)

    def get_foreign_keys(self, table_name, schema=None):
        return self.inspector.get_foreign_keys(table_name, schema)

    @property
    def sqlalchemy_uri_decrypted(self):
        conn = sqla.engine.url.make_url(self.sqlalchemy_uri)
        if custom_password_store:
            conn.password = custom_password_store(conn)
        else:
            conn.password = self.password
        return str(conn)

    @property
    def sql_url(self):
        return '/superset/sql/{}/'.format(self.id)

    def get_perm(self):
        return (
            '[{obj.database_name}].(id:{obj.id})').format(obj=self)

    def has_table(self, table):
        engine = self.get_sqla_engine()
        return engine.has_table(
            table.table_name, table.schema or None)

    @utils.memoized
    def get_dialect(self):
        sqla_url = url.make_url(self.sqlalchemy_uri_decrypted)
        return sqla_url.get_dialect()()


sqla.event.listen(Database, 'after_insert', set_perm)
sqla.event.listen(Database, 'after_update', set_perm)


class Log(Model):
    """ORM object used to log Superset actions to the database"""

    __tablename__ = 'logs'

    id = Column(Integer, primary_key=True)
    action = Column(String(512))
    user_id = Column(Integer, ForeignKey('ab_user.id'))
    dashboard_id = Column(Integer)
    slice_id = Column(Integer)
    json = Column(Text)
    user = relationship(
        security_manager.user_model, backref='logs', foreign_keys=[user_id])
    dttm = Column(DateTime, default=datetime.utcnow)
    duration_ms = Column(Integer)
    referrer = Column(String(1024))

    @classmethod
    def log_this(cls, f):
        """Decorator to log user actions"""

        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            log_event = True
            start_dttm = datetime.now()
            user_id = None
            if g.user:
                user_id = g.user.get_id()
            d = request.form.to_dict() or {}
            # request parameters can overwrite post body
            request_params = request.args.to_dict()
            d.update(request_params)
            d.update(kwargs)
            slice_id = d.get('slice_id')
            action_name = f.__name__
            obj_type = ''

            if args and not d.get('type'):
                from superset.views.core import Superset
                from superset.security import CustomAuthDBView

                view_class = args[0]
                if type(view_class) is Superset:
                    if action_name == 'explore':
                        obj_type = d['type'] = 'slice'
                        # логгируем событие только в случае POST запроса
                        log_event = request.method == 'POST'
                        # сохранение отчета
                        if d.get('new_dashboard_name'):
                            # Сохранение отчета на новую информационную панель
                            action_name = 'new_dashboard'
                        else:
                            action_name = 'save'
                    # логирование действий с папками
                    elif action_name in (
                            'edit_folders', 'move_object_to_folder'):
                        obj_type = d['type'] = d.get('object_type')
                        log_event = True
                elif type(view_class) is CustomAuthDBView:
                    # логгируем событие только в случае POST запроса
                    log_event = request.method == 'POST'
                    obj_type = 'user'
                else:
                    if hasattr(view_class, 'datamodel'):
                        obj_type = view_class.datamodel.obj.__name__.lower()
                    else:
                        obj_type = view_class.__class__.__name__
                    d['type'] = obj_type
                    if action_name == 'action_post':
                        action_name = d.get('action')
                    if obj_type == 'dashboard':
                        # Игнорируем открытие формы создания витрины
                        if request.method == 'GET' and not d.get('pk'):
                            log_event = False

                action_name = f'{action_name} {obj_type}'

            try:
                slice_id = int(
                    slice_id or json.loads(d.get('form_data')).get('slice_id'))
            except (ValueError, TypeError):
                slice_id = 0

            params = ''
            try:
                params = json.dumps(d)
            except Exception:
                pass
            stats_logger.incr(f.__name__)
            value = f(*args, **kwargs)
            if log_event:
                sesh = db.session()
                log = cls(
                    action=action_name,
                    json=params,
                    dashboard_id=d.get('dashboard_id'),
                    slice_id=slice_id,
                    duration_ms=(
                                        datetime.now() - start_dttm).total_seconds() * 1000,
                    referrer=request.referrer[:1000] if request.referrer else None,
                    user_id=user_id)
                sesh.add(log)
                sesh.commit()
            return value

        return wrapper


class LogAction:
    ADD = 'add'
    DEL = 'del'
    UPD = 'upd'
    UPD_META = 'upd_meta'

    CHOICES_DICT = {
        ADD: _('Added'),
        DEL: _('Deleted'),
        UPD: _('Updated'),
        UPD_META: _('Metadata updated'),  # Обновление метаданных
    }
    CHOICES = tuple(CHOICES_DICT.items())


class ChangeLog(Model):
    """ORM object used to log Superset`s table_column values in the database"""

    __tablename__ = 'change_logs'

    id = Column(Integer, primary_key=True, autoincrement=True)
    action = Column(String(16), nullable=False, name=_('action'))  # Действие
    user_id = Column(Integer, ForeignKey('ab_user.id'), nullable=False)  # Пользователь
    user_name = Column(String(64), nullable=False, name=_('user_name'))  # Имя пользователя
    user_roles = Column(String(512), nullable=False, name=_('user_roles'))  # Роли пользователя на момент сов. действия
    table_id = Column(Integer, ForeignKey('tables.id', ondelete='SET NULL'), nullable=True)  # Витрина
    table_name = Column(String(512), nullable=False, name=_('table_name'))  # Название витрины
    obj_type = Column(String(32), nullable=False, name=_('obj_type'))  # Тип объекта: показатель, метрика, иерархия
    obj_name = Column(String(512), nullable=False, name=_('obj_name'))  # Название объекта
    obj_field = Column(String(32), nullable=False, name=_('obj_field'))  # Поле объекта
    old_value = Column(Text, name=_('old_value'))  # Старое значение (NULL если значения не было)
    new_value = Column(Text, name=_('new_value'))  # Новое значение (NULL если значения не было)
    dttm = Column(DateTime, default=func.now(), name=_('dttm'))

    __user_role_regex = re.compile(r'<\d+\|(?P<role>[^<>]+)>')

    @staticmethod
    def _quoted_or_default(value, default='NULL'):
        return f'"{value}"' if value is not None else default

    def _extract_user_roles_names(self):
        user_roles_names = self.__user_role_regex.findall(self.user_roles)
        return ', '.join(user_roles_names)

    def _get_obj_field_name(self) -> str:
        if self.obj_field == '__all__':
            return _('All fields')
        import superset.connectors.sqla.views as sqla_views
        try:
            obj_view = getattr(sqla_views, self.obj_type + 'InlineView')
        except AttributeError:
            return self.obj_field
        else:
            return obj_view.label_columns.get(self.obj_field, self.obj_field)

    @property
    def as_dict(self):
        return {
            'dttm': self.dttm.isoformat(timespec='microseconds'),
            'user_name': self.user_name,
            'user_roles': self._extract_user_roles_names(),
            'action': LogAction.CHOICES_DICT.get(self.action, self.action),
            'obj_type': LOGGING_OBJ_TYPE_NAMES.get(self.obj_type, self.obj_type),
            'obj_name': self.obj_name,
            'obj_field': self._get_obj_field_name(),
            'old_value': self._quoted_or_default(self.old_value),
            'new_value': self._quoted_or_default(self.new_value),
        }

    @classmethod
    def as_csv(cls, queryset):
        fieldnames = ('dttm', 'user_name', 'user_roles', 'action', 'obj_type', 'obj_name',
                      'obj_field', 'old_value', 'new_value')
        csv_headers = map(_, fieldnames)

        with BytesIO() as csv_file:
            csv_file = codecs.getwriter('utf-8-sig')(csv_file)
            wr = csv.writer(csv_file, delimiter=';')
            wr.writerow(csv_headers)
            wr = csv.DictWriter(csv_file, fieldnames=fieldnames, delimiter=';')
            for obj in queryset:
                wr.writerow(obj.as_dict)

            return csv_file.getvalue()


class FavStar(Model):
    __tablename__ = 'favstar'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('ab_user.id'))
    class_name = Column(String(50))
    obj_id = Column(Integer)
    dttm = Column(DateTime, default=datetime.utcnow)


class DatasourceAccessRequest(Model, AuditMixinNullable):
    """ORM model for the access requests for datasources and dbs."""
    __tablename__ = 'access_request'
    id = Column(Integer, primary_key=True)

    datasource_id = Column(Integer)
    datasource_type = Column(String(200))

    ROLES_BLACKLIST = set(config.get('ROBOT_PERMISSION_ROLES', []))

    @property
    def cls_model(self):
        return ConnectorRegistry.sources[self.datasource_type]

    @property
    def username(self):
        return self.creator()

    @property
    def datasource(self):
        return self.get_datasource

    @datasource.getter
    @utils.memoized
    def get_datasource(self):
        # pylint: disable=no-member
        ds = db.session.query(self.cls_model).filter_by(
            id=self.datasource_id).first()
        return ds

    @property
    def datasource_link(self):
        return self.datasource.link  # pylint: disable=no-member

    @property
    def roles_with_datasource(self):
        action_list = ''
        perm = self.datasource.perm  # pylint: disable=no-member
        pv = security_manager.find_permission_view_menu('datasource_access', perm)
        for r in pv.role:
            if r.name in self.ROLES_BLACKLIST:
                continue
            url = (
                '/superset/approve?datasource_type={self.datasource_type}&'
                'datasource_id={self.datasource_id}&'
                'created_by={self.created_by.username}&role_to_grant={r.name}'
                    .format(**locals())
            )
            href = '<a href="{}">Grant {} Role</a>'.format(url, r.name)
            action_list = action_list + '<li>' + href + '</li>'
        return '<ul>' + action_list + '</ul>'

    @property
    def user_roles(self):
        action_list = ''
        for r in self.created_by.roles:  # pylint: disable=no-member
            url = (
                '/superset/approve?datasource_type={self.datasource_type}&'
                'datasource_id={self.datasource_id}&'
                'created_by={self.created_by.username}&role_to_extend={r.name}'
                    .format(**locals())
            )
            href = '<a href="{}">Extend {} Role</a>'.format(url, r.name)
            if r.name in self.ROLES_BLACKLIST:
                href = '{} Role'.format(r.name)
            action_list = action_list + '<li>' + href + '</li>'
        return '<ul>' + action_list + '</ul>'


class SliceFolders(Model, BaseNestedSets):
    __tablename__ = 'slice_folders'
    id = Column(Integer, primary_key=True)
    name = Column(db.String(100))
    objects = relationship(Slice, back_populates="folder")

    def __repr__(self):
        return self.name


class DashboardFolders(Model, BaseNestedSets):
    __tablename__ = 'dashboard_folders'
    id = Column(Integer, primary_key=True)
    name = Column(db.String(100))
    objects = relationship(Dashboard, back_populates="folder")

    def __repr__(self):
        return self.name


class GeoPoligons(Model):
    __tablename__ = 'geo_poligons'

    id = Column(Integer, nullable=False, primary_key=True)
    name = Column(Text, nullable=False)
    content = Column(JSON, nullable=False)

    def __repr__(self):
        return self.name
