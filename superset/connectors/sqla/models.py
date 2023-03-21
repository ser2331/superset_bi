# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import functools
import itertools as _it
import json
import logging
import re
import os
from collections import namedtuple
from copy import copy
from datetime import datetime
from typing import Union, Sequence, Optional, TYPE_CHECKING, Tuple, Set

import pandas as pd
import six
import sqlalchemy as sa
import sqlparse
from flask import escape, Markup, url_for, render_template, g
from flask_appbuilder import Model
from flask_appbuilder.models.decorators import renders
from flask_babel import lazy_gettext as _
from flask_login import current_user
from past.builtins import basestring
from sqlalchemy import (
    and_, asc, Boolean, Column, DateTime, desc, event, ForeignKey, func,
    Integer, or_, select, String, Text, Float
)
from sqlalchemy.orm import backref, relationship
from sqlalchemy.schema import UniqueConstraint
from sqlalchemy.sql import column, literal_column, table, text
from sqlalchemy.sql.expression import TextAsFrom

from superset import db, import_util, security_manager, utils, config, conf
from superset.connectors.base.models import BaseColumn, BaseDatasource, BaseMetric
from superset.db_engine_specs import ClickHouseEngineSpec
from superset.exceptions import SupersetException
from superset.jinja_context import get_template_processor
from superset.models.annotations import Annotation
from superset.models.core import ChangeLog, Database, LogAction
from superset.models.helpers import QueryResult, SliceRelatedMixin
from superset.models.helpers import set_perm
from superset.sql_parse import SupersetQuery
from superset.utils import DTTM_ALIAS, QueryStatus

ReSearch = namedtuple('ReSearch', 'field_name regex')  # @regex is a string that will be format by searching value
INIT_PROCESS = os.environ.get('INIT_PROCESS')

if TYPE_CHECKING:
    from sqlalchemy.engine import Connection
    from sqlalchemy.orm import Mapper
    from sqlalchemy.orm.attributes import History
    from sqlalchemy.orm.state import AttributeState, InstanceState


class AnnotationDatasource(BaseDatasource):
    """ Dummy object so we can query annotations using 'Viz' objects just like
        regular datasources.
    """

    cache_timeout = 0

    def query(self, query_obj):
        df = None
        error_message = None
        qry = db.session.query(Annotation)
        qry = qry.filter(Annotation.layer_id == query_obj['filter'][0]['val'])
        qry = qry.filter(Annotation.start_dttm >= query_obj['from_dttm'])
        qry = qry.filter(Annotation.end_dttm <= query_obj['to_dttm'])
        status = QueryStatus.SUCCESS
        try:
            df = pd.read_sql_query(qry.statement, db.engine)
        except Exception as e:
            status = QueryStatus.FAILED
            logging.exception(e)
            error_message = (
                utils.error_msg_from_exception(e))
        return QueryResult(
            status=status,
            df=df,
            duration=0,
            query='',
            error_message=error_message)

    def get_query_str(self, query_obj):
        raise NotImplementedError()

    def values_for_column(self, column_name, limit=10000):
        raise NotImplementedError()


class ChangeLogMixin:
    def get_obj_log_type(self) -> str:
        """ Определение типа логгируемого объекта """
        return self.__class__.__name__

    def get_obj_name(self) -> str:
        """ Определение имени логгируемого объекта """
        return getattr(self, 'real_name', None) or str(self)

    @staticmethod
    def save_change_log(change_log: Union[Sequence['ChangeLog'], 'ChangeLog']) -> None:
        """ Сохраняет сформированные лог(и) изменений в БД """
        if not change_log:
            return
        elif not isinstance(change_log, Sequence):
            change_log = [change_log]

        session = db.create_scoped_session()
        session.add_all(change_log)
        session.commit()

    @staticmethod
    def create_change_log(
            target: 'ChangeLogMixin', action: str, obj_field: str, old_value: Optional[str], new_value: Optional[str],
    ) -> 'ChangeLog':
        """ Формирует лог изменений """
        user = current_user
        change_log = None
        if user:
            change_log = ChangeLog(
                action=LogAction.UPD_META if hasattr(target, 'is_meta_update') else action,
                user_id=user.id,
                user_name=user.username,
                user_roles=user.repr_roles,
                table_id=target.table_id,
                table_name=target.table.name if target.table else '',
                obj_type=target.get_obj_log_type(),
                obj_name=target.get_obj_name(),
                obj_field=obj_field,
                old_value=old_value,
                new_value=new_value,
            )
        return change_log

    @staticmethod
    def after_insert(mapper: 'Mapper', connection: 'Connection', target: 'ChangeLogMixin') -> None:
        state = db.inspect(target)
        if not state.modified:
            return

        changes = {
            attr.key: attr.value
            for attr, _ in target.get_update_changes(target, state)
        }
        change_log = target.create_change_log(
            action=LogAction.ADD,
            target=target,
            obj_field='__all__',
            old_value=None,
            new_value=json.dumps(changes, sort_keys=True, default=str, ensure_ascii=False),
        )
        if change_log:
            target.save_change_log(change_log)

    @staticmethod
    def get_update_changes(target: 'ChangeLogMixin', state: 'InstanceState') -> Tuple['AttributeState', 'History']:
        target_relationship_keys = state.mapper.relationships.keys()
        for attr in state.attrs:
            if attr.key in state.unmodified or attr.key in target_relationship_keys:
                continue
            hist = attr.load_history()
            if not hist.has_changes():
                continue
            yield attr, hist

    @staticmethod
    def after_update(mapper: 'Mapper', connection: 'Connection', target: 'ChangeLogMixin') -> None:
        state = db.inspect(target)
        if not state.modified:
            return

        change_logs = []
        for attr, hist in target.get_update_changes(target, state):
            change_log = target.create_change_log(
                action=LogAction.UPD,
                target=target,
                obj_field=attr.key,
                old_value=hist.deleted[0],
                new_value=hist.added[0],
            )
            if change_log:
                change_logs.append(change_log)

        target.save_change_log(change_logs)

    @staticmethod
    def after_delete(mapper: 'Mapper', connection: 'Connection', target: 'ChangeLogMixin') -> None:
        state = db.inspect(target)
        target_relationship_keys = mapper.relationships.keys()
        changes = {
            attr.key: attr.value
            for attr in state.attrs
            if attr.key not in target_relationship_keys
        }
        change_log = target.create_change_log(
            action=LogAction.DEL,
            target=target,
            obj_field='__all__',
            old_value=json.dumps(changes, sort_keys=True, default=str, ensure_ascii=False),
            new_value=None,
        )
        if change_log:
            target.save_change_log(change_log)

    @classmethod
    def __declare_last__(cls) -> None:
        if not INIT_PROCESS:
            event.listen(cls, 'after_insert', cls.after_insert)
            event.listen(cls, 'after_update', cls.after_update)
            event.listen(cls, 'after_delete', cls.after_delete)


class TableColumn(ChangeLogMixin, SliceRelatedMixin, Model, BaseColumn):
    """ORM object for table columns, each table can have multiple columns"""

    __tablename__ = 'table_columns'
    __table_args__ = (UniqueConstraint('table_id', 'column_name'),)
    table_id = Column(Integer, ForeignKey('tables.id'))
    table = relationship(
        'SqlaTable',
        backref=backref('rel_columns', cascade='all, delete-orphan'),
        foreign_keys=[table_id]
    )
    is_dttm = Column(Boolean, default=False)
    auto_upd_verbose_name = Column(Boolean, default=True)
    expression = Column(Text, default='')
    python_date_format = Column(String(255))
    database_expression = Column(String(255))

    group_id = Column(Integer, ForeignKey('table_column_groups.id'), nullable=True)
    group = relationship('TableColumnGroup', foreign_keys=[group_id])
    is_filter_key = Column(Boolean, default=False, server_default='false', )

    export_fields = (
        'table_id', 'column_name', 'verbose_name', 'is_dttm', 'is_active',
        'type', 'groupby', 'count_distinct', 'sum', 'avg', 'max', 'min',
        'filterable', 'expression', 'description', 'python_date_format',
        'database_expression', 'auto_upd_verbose_name',
    )
    export_parent = 'table'
    slice_search_field_names = (
        'column',  # columns | all_columns | show_sqla_time_column | sub_totals_by_columns |
        # all_columns_x | all_columns_y | js_columns | line_column |
        'groupby',
        'granularity_sqla',
        'sub_totals_by',  # sub_totals_by_rows | sub_totals_by_columns
    )
    slice_search_field_names_regex = (
        ReSearch('having', regex=r'(?:^|\W){}\W'),
        ReSearch('where', regex=r'(?:^|\W){}\W'),
        ReSearch('filters', regex="'col': '{}'"),
    )

    base_link = 'tablecolumninlineview'

    def __str__(self):
        return '%s' % self.verbose_name if self.verbose_name else self.column_name

    @property
    def sqla_col(self):
        name = self.column_name
        if not self.expression:
            col = column(self.column_name).label(name)
        else:
            col = literal_column(self.expression).label(name)
        return col

    @property
    def inner_sqla_col(self):
        name = self.column_name
        return column(self.column_name).label(name)

    @property
    def datasource(self):
        return self.table

    @property
    def is_calculated(self):
        """
        Вычисляемый показатель или нет
        """
        return bool(self.expression)

    @renders('auto_upd_verbose_name')
    def fake_auto_upd_verbose_name(self):
        # prefix "fake_" will be removed in the `list_with_checkboxes_and_perms.html`
        # thus the final link to change the rendered field(@auto_upd_verbose_name) value will be generated
        return '' if self.is_calculated else self.auto_upd_verbose_name

    def get_time_filter(self, start_dttm, end_dttm):
        col = self.sqla_col.label('__time')
        l = []  # noqa: E741
        if start_dttm:
            l.append(col >= text(self.dttm_sql_literal(start_dttm)))
        if end_dttm:
            l.append(col <= text(self.dttm_sql_literal(end_dttm)))
        return and_(*l)

    def get_timestamp_expression(self, time_grain):
        """Getting the time component of the query"""
        expr = self.expression or self.column_name
        if not self.expression and not time_grain:
            return column(expr, type_=DateTime).label(DTTM_ALIAS)
        if time_grain:
            pdf = self.python_date_format
            if pdf in ('epoch_s', 'epoch_ms'):
                # if epoch, translate to DATE using db specific conf
                db_spec = self.table.database.db_engine_spec
                if pdf == 'epoch_s':
                    expr = db_spec.epoch_to_dttm().format(col=expr)
                elif pdf == 'epoch_ms':
                    expr = db_spec.epoch_ms_to_dttm().format(col=expr)
            grains_dict = self.table.database.grains_dict()
            grain = grains_dict.get(time_grain, grains_dict.get(None))
            expr = grain.function.format(col=expr)
        return literal_column(expr, type_=DateTime).label(DTTM_ALIAS)

    @classmethod
    def import_obj(cls, i_column):
        def lookup_obj(lookup_column):
            return db.session.query(TableColumn).filter(
                TableColumn.table_id == lookup_column.table_id,
                TableColumn.column_name == lookup_column.column_name).first()

        return import_util.import_simple_obj(db.session, i_column, lookup_obj)

    def dttm_sql_literal(self, dttm):
        """Convert datetime object to a SQL expression string

        If database_expression is empty, the internal dttm
        will be parsed as the string with the pattern that
        the user inputted (python_date_format)
        If database_expression is not empty, the internal dttm
        will be parsed as the sql sentence for the database to convert
        """
        tf = self.python_date_format
        if self.database_expression:
            return self.database_expression.format(dttm.strftime('%Y-%m-%d %H:%M:%S'))
        elif tf:
            if tf == 'epoch_s':
                return str((dttm - datetime(1970, 1, 1)).total_seconds())
            elif tf == 'epoch_ms':
                return str((dttm - datetime(1970, 1, 1)).total_seconds() * 1000.0)
            return "'{}'".format(dttm.strftime(tf))
        else:
            s = self.table.database.db_engine_spec.convert_dttm(
                self.type or '', dttm)
            return s or "'{}'".format(dttm.strftime('%Y-%m-%d %H:%M:%S.%f'))

    def get_metrics(self):
        metrics = []
        M = SqlMetric  # noqa
        quoted = self.column_name
        if self.sum:
            metrics.append(M(
                metric_name='sum__' + self.column_name,
                metric_type='sum',
                expression='SUM({})'.format(quoted),
            ))
        if self.avg:
            metrics.append(M(
                metric_name='avg__' + self.column_name,
                metric_type='avg',
                expression='AVG({})'.format(quoted),
            ))
        if self.max:
            metrics.append(M(
                metric_name='max__' + self.column_name,
                metric_type='max',
                expression='MAX({})'.format(quoted),
            ))
        if self.min:
            metrics.append(M(
                metric_name='min__' + self.column_name,
                metric_type='min',
                expression='MIN({})'.format(quoted),
            ))
        if self.count_distinct:
            metrics.append(M(
                metric_name='count_distinct__' + self.column_name,
                metric_type='count_distinct',
                expression='COUNT(DISTINCT {})'.format(quoted),
            ))
        return {m.metric_name: m for m in metrics}

    @property
    def real_name(self):
        return self.column_name

    @property
    def show_link(self):
        return Markup(f'<a href="/{self.base_link}/show/{self.id}">{escape(self.column_name)}</a>')

    def get_bind_metrics(self):
        return db.session.query(SqlMetric).filter(
            SqlMetric.table_id == self.table_id,
            SqlMetric.expression.contains(self.column_name),
        ).distinct().all()

    def get_bind_calc_cols(self):
        return db.session.query(TableColumn).filter(
            TableColumn.table_id == self.table_id,
            TableColumn.expression.contains(self.column_name),
        ).all()

    def get_bind_hierarchies(self):
        return db.session.query(TableHierarchyColumn).filter(
            TableHierarchyColumn.column_id == self.id,
        ).distinct().all()

    def get_obj_log_type(self) -> str:
        obj_type = super().get_obj_log_type()
        if self.expression:
            obj_type += ' expression'
        return obj_type

    def pre_delete(self):
        slices = set(self.get_slices())  # Отчёты (Показатели, Без агрегации, показатель с временем, фильтры,
        #         подитоги, ограничения SQL и тп. поля)
        metrics = self.get_bind_metrics()  # Метрики
        calc_cols = self.get_bind_calc_cols()  # Вычисляемые показатели витрины
        hierarchies = self.get_bind_hierarchies()  # Иерархии

        if slices or metrics or calc_cols or hierarchies:
            msg = Markup(
                render_template('errors/_delete_param.html', **locals())
            )
            raise SupersetException(msg)


class SqlMetric(ChangeLogMixin, SliceRelatedMixin, Model, BaseMetric):
    """ORM object for metrics, each table can have multiple metrics"""

    __tablename__ = 'sql_metrics'
    __table_args__ = (UniqueConstraint('table_id', 'metric_name'),)
    table_id = Column(Integer, ForeignKey('tables.id'))
    table = relationship(
        'SqlaTable',
        backref=backref('rel_metrics', cascade='all, delete-orphan'),
        foreign_keys=[table_id]
    )
    expression = Column(Text)

    group_id = Column(Integer, ForeignKey('table_column_groups.id'), nullable=True)
    group = relationship('TableColumnGroup', foreign_keys=[group_id])

    export_fields = (
        'metric_name', 'verbose_name', 'metric_type', 'table_id', 'expression',
        'description', 'is_restricted', 'd3format')
    export_parent = 'table'

    slice_search_field_names = ('metric',)

    @property
    def sqla_col(self):
        name = self.metric_name
        return literal_column(self.expression).label(name)

    @property
    def perm(self):
        return (
            '{parent_name}.[{obj.metric_name}](id:{obj.id})'
        ).format(obj=self,
                 parent_name=self.table.full_name) if self.table else None

    @classmethod
    def import_obj(cls, i_metric):
        def lookup_obj(lookup_metric):
            return db.session.query(SqlMetric).filter(
                SqlMetric.table_id == lookup_metric.table_id,
                SqlMetric.metric_name == lookup_metric.metric_name).first()

        return import_util.import_simple_obj(db.session, i_metric, lookup_obj)

    @property
    def table_link(self):
        name = escape(self.metric_name)
        if self.table_id is None:
            logging.error('Неивестная таблица. Игнорирую.')
            out = '{name} <no_tag style="color:red;">[{error}]</no_tag>'.format(name=name, error=_('Unknown table'))
        else:
            out = f'<a href="{self.table.explore_url}">{name}</a>'
        return Markup(out)

    @property
    def real_name(self):
        return self.metric_name

    def pre_delete(self):
        slices = set(self.get_slices())
        if slices:
            msg = Markup(
                render_template('errors/_delete_param.html', slices=slices)
            )
            raise SupersetException(msg)


class SqlaTable(Model, BaseDatasource):
    """An ORM object for SqlAlchemy table references"""

    type = 'table'
    query_language = 'sql'
    metric_class = SqlMetric
    column_class = TableColumn

    __tablename__ = 'tables'
    __table_args__ = (UniqueConstraint('database_id', 'table_name'),)

    table_name = Column(String(250))
    main_dttm_col = Column(String(250))
    database_id = Column(Integer, ForeignKey('dbs.id'), nullable=False)
    fetch_values_predicate = Column(String(1000))
    user_id = Column(Integer, ForeignKey('ab_user.id'))
    # сохраняем ссылку на корневой (реальная таблица в БД)
    parent_id = sa.Column(sa.BigInteger, sa.ForeignKey('tables.id', ondelete='SET NULL'), nullable=True)
    parent = relationship('SqlaTable', lazy='joined', join_depth=2)
    owner = relationship(
        security_manager.user_model,
        backref='tables',
        foreign_keys=[user_id])
    database = relationship(
        'Database',
        backref=backref('tables', cascade='all, delete-orphan'),
        foreign_keys=[database_id])
    schema = Column(String(255))
    sql = Column(Text)
    from_sql_lab = Column(Boolean, default=False)

    baselink = 'tablemodelview'

    export_fields = (
        'table_name', 'main_dttm_col', 'description', 'default_endpoint',
        'database_id', 'offset', 'cache_timeout', 'schema',
        'sql', 'params')
    export_parent = 'database'
    export_children = ['metrics', 'columns']

    def __repr__(self):
        return self.name

    @property
    def metrics(self):
        return self.get_metrics_filter().all()

    @property
    def columns(self):
        return self.get_columns_filter().all()

    @property
    def filter_columns(self):
        return self.get_columns_filter().filter(
            TableColumn.is_filter_key.is_(True)).all()

    @property
    def connection(self):
        return str(self.database)

    @property
    def description_markeddown(self):
        return utils.markdown(self.description)

    @property
    def link(self):
        name = escape(self.name)
        return Markup(
            '<a href="{self.explore_url}">{name}</a>'.format(**locals()))

    @property
    def change_log(self):
        return Markup(
            '<a href="' + url_for('TableModelView.download_changelog', pk=str(self.id)) + '">'
            + _('Download') +
            '</a> '
            + _('tablecolumn change log')
        )

    @property
    def schema_perm(self):
        """Returns schema permission if present, database one otherwise."""
        return security_manager.get_schema_perm(self.database, self.schema)

    def get_perm(self):
        return (
            '[{obj.database}].[{obj.table_name}]'
            '(id:{obj.id})').format(obj=self)

    @property
    def name(self):
        if not self.schema:
            return self.table_name
        return '{}.{}'.format(self.schema, self.table_name)

    @property
    def full_name(self):
        return utils.get_datasource_full_name(
            self.database, self.table_name, schema=self.schema)

    def dttm_cols(self, session=None):
        l = [c.column_name for c in self.get_columns_filter(session=session).all() if c.is_dttm]  # noqa: E741
        if self.main_dttm_col and self.main_dttm_col not in l:
            l.append(self.main_dttm_col)
        return l

    @property
    def num_cols(self):
        return [c.column_name for c in self.columns if c.is_num]

    @property
    def any_dttm_col(self):
        cols = self.dttm_cols()
        if cols:
            return cols[0]

    @property
    def html(self):
        t = ((c.column_name, c.type) for c in self.columns)
        df = pd.DataFrame(t)
        df.columns = ['field', 'type']
        return df.to_html(
            index=False,
            classes=(
                'dataframe table table-striped table-bordered '
                'table-condensed'))

    @property
    def sql_url(self):
        return self.database.sql_url + '?table_name=' + str(self.table_name)

    @property
    def time_column_grains(self):
        return {
            'time_columns': self.dttm_cols(),
            'time_grains': [grain.name for grain in self.database.grains()],
        }

    def get_col(self, col_name, session=None):
        columns = self.get_columns_filter(session=session).all()
        for col in columns:
            if col_name == col.column_name:
                return col

    def data(self, session=None):
        d = super(SqlaTable, self).data(session=session)
        if self.type == 'table':
            grains = self.database.grains() or []
            if grains:
                grains = [(g.duration, g.name) for g in grains]
            d['granularity_sqla'] = utils.choicify(self.dttm_cols(session=session))
            d['time_grain_sqla'] = grains

            groups = dict()
            for col in self.get_columns_filter(session=session).all():
                if not col.group:
                    continue

                if col.group.id not in groups:
                    groups[col.group.id] = {'label': col.group.title, 'columns': []}

                groups[col.group.id]['columns'].append(col.column_name)
            d['column_groups'] = groups

            groups = dict()
            for metric in self.get_metrics_filter(session=session).all():
                if not metric.group:
                    continue

                if metric.group.id not in groups:
                    groups[metric.group.id] = {'label': metric.group.title, 'metrics': []}

                groups[metric.group.id]['metrics'].append(metric.metric_name)
            d['metric_groups'] = groups

        return d

    @classmethod
    def get_real_columns(cls, table_id):
        """
        :return: sqlalchemy.orm.query.Query для TableColumn,
        где возвращаются реальные столбцы (без проксирования)
        """
        return db.session.query(TableColumn).filter(TableColumn.table_id == table_id).all()

    @classmethod
    def get_real_metrics(cls, table_id):
        """
        :return: sqlalchemy.orm.query.Query для SqlMetric,
        где возвращаются реальные метрики (без проксирования)
        """
        return db.session.query(SqlMetric).filter(SqlMetric.table_id == table_id)

    def get_columns_filter(self, query=None, session=None):
        """
        Фильтрация для поля columns, данного экземпляра

        :param экземпляр sqlalchemy.orm.query.Query для TableColumn
        :return: экземпляр sqlalchemy.orm.query.Query для TableColumn
        """
        session = session or db.session
        query = query or session.query(TableColumn)
        base_filter_kwargs = [TableColumn.table_id == self.id]
        if self.parent_id is not None and self.sql is not None:
            filter_kwargs = [TableColumn.table_id == self.parent_id, ]
            superset_query = SupersetQuery(self.sql)
            columns_names = superset_query.columns_names
            if isinstance(columns_names, list):
                filter_kwargs.append(TableColumn.column_name.in_(columns_names))
            return query.filter(or_(*base_filter_kwargs, and_(*filter_kwargs)))
        else:
            return query.filter(*base_filter_kwargs)

    def get_metrics_filter(self, query=None, session=None):
        """
        Фильтрация для поля metrics, данного экземпляра

        :param экземпляр sqlalchemy.orm.query.Query для SqlMetric
        :return: экземпляр sqlalchemy.orm.query.Query для SqlMetric
        """
        session = session or db.session
        query = query or session.query(SqlMetric)
        filter_kwargs = [SqlMetric.table_id == self.id]
        if self.parent_id is not None:
            filter_kwargs.append(SqlMetric.table_id == self.parent_id)
        return query.filter(or_(*filter_kwargs))

    def get_filter_by_scope(self, query):
        """
        Фильтрация по области видимости пользователя
        """
        from superset.views.core import user_is_admin
        filter_kwargs = []
        user = g.user
        mo_table = conf.get('MO_TABLE', '')
        if not (hasattr(user, 'scope_guids')):
            return query
        if not all((user.scope_guids, self.filter_columns, mo_table)) \
                or user_is_admin():
            return query
        if self.database.db_engine_spec is ClickHouseEngineSpec:
            columns = ", ".join(c.column_name for c in self.filter_columns)
            sql = f'hasAny({user.scope_guids}, [{columns}])'
            return query.where(db.text(sql))
        else:
            for column in self.filter_columns:
                c = column.sqla_col
                filter_kwargs.append(c.in_(user.scope_guids))
            return query.where(or_(*filter_kwargs))

    def values_for_column(self, column_name, limit=10000):
        """Runs query against sqla to retrieve some
        sample values for the given column.
        """
        cols = {col.column_name: col for col in self.columns}
        target_col = cols[column_name]
        tp = self.get_template_processor()
        db_engine_spec = self.database.db_engine_spec

        qry = (
            select([target_col.sqla_col])
                .select_from(self.get_from_clause(tp, db_engine_spec))
                .distinct(column_name)
        )
        if limit:
            qry = qry.limit(limit)

        if self.fetch_values_predicate:
            tp = self.get_template_processor()
            qry = qry.where(tp.process_template(self.fetch_values_predicate))

        engine = self.database.get_sqla_engine()
        sql = '{}'.format(
            qry.compile(engine, compile_kwargs={'literal_binds': True}),
        )

        df = pd.read_sql_query(sql=sql, con=engine)
        return [row[0] for row in df.to_records(index=False)]

    def get_template_processor(self, **kwargs):
        return get_template_processor(
            table=self, database=self.database, **kwargs)

    def get_query_str(self, query_obj, session=None):
        engine = self.database.get_sqla_engine()
        qry = self.get_sqla_query(**query_obj, session=session)
        sql = six.text_type(
            qry.compile(
                engine,
                compile_kwargs={'literal_binds': True},
            ),
        )
        logging.info(sql)
        sql = sqlparse.format(sql, reindent=True)
        if query_obj['is_prequery']:
            query_obj['prequeries'].append(sql)
        return sql

    def get_sqla_table(self):
        tbl = table(self.table_name)
        if self.schema:
            tbl.schema = self.schema
        return tbl

    def get_from_clause(self, template_processor=None, db_engine_spec=None):
        # Supporting arbitrary SQL statements in place of tables
        if self.sql:
            from_sql = self.sql
            if template_processor:
                from_sql = template_processor.process_template(from_sql)
            from_sql = sqlparse.format(from_sql, strip_comments=True)
            return TextAsFrom(sa.text(from_sql), []).alias('expr_qry')
        return self.get_sqla_table()

    def adhoc_metric_to_sa(self, metric):
        column_name = metric.get('column').get('column_name')
        sa_metric = self.database.db_engine_spec.sqla_aggregations[metric.get('aggregate')](column(column_name))
        sa_metric = sa_metric.label(metric.get('label'))
        return sa_metric

    def sa_metric_with_cumulative_total(self, metric, groupby_columns, timestamp):
        column_name = metric.get('column').get('column_name')
        new_metric_expr = (
            self.database.db_engine_spec
                .sqla_aggregations_with_cumulative_total[metric.get('aggregate')](column(column_name))
        )
        new_metric_expr = sa.over(new_metric_expr, partition_by=[column(i) for i in groupby_columns], order_by=timestamp)
        new_metric_expr = new_metric_expr.label(metric.get('label'))
        new_metric_expr.key = new_metric_expr.key.replace('%%', ' / 100').replace('%', ' / 100')
        return new_metric_expr

    def get_metrics(self, metrics, session, datasource, with_main_metric=False, with_metric_type=False):
        metrics_exprs = []
        metrics_dict = {m.metric_name: m for m in self.get_metrics_filter(session=session).all()}
        metric_type = None
        for m in metrics[:]:
            if utils.is_adhoc_metric(m):
                metric_expr = self.adhoc_metric_to_sa(m)
                metric_expr.key = metric_expr.key.replace('%%', ' / 100').replace('%', ' / 100')
                metric_type = metric_type or str(m['aggregate']).lower()
            elif m in metrics_dict:
                metric = metrics_dict.get(m)
                metric_type = metric_type or metric.metric_type
                metric_as_text = str(
                    metric.sqla_col.expression
                ).replace('%%', ' / 100').replace('%', ' / 100')
                column_to_replace = [col for col in datasource.columns if str(col) in metric_as_text]
                if column_to_replace:
                    column_to_replace = column_to_replace[0]
                    metric_as_text = metric_as_text.replace(str(column_to_replace), str(column_to_replace.sqla_col))
                metric_expr = literal_column(metric_as_text)
                metric_expr = metric_expr.label(m)
            else:
                # Для сортировки по обычным столбцам (не метрикам) на фронте в список метрик добавили обычные столбцы
                # Т.к. сортировка уже учтена, нужно эти обычные столбцы удалить из списка метрик.
                # TODO: Возможно понадобится добавить сюда какую-то валидацию
                metric_expr = None
                metrics.remove(m)
                # raise Exception(_("Metric '{}' is not valid".format(m)))
            if metric_expr is not None:
                metrics_exprs.append(metric_expr)

        if not with_main_metric:
            return metrics_exprs

        if metrics_exprs:
            main_metric_expr = metrics_exprs[0]
        else:
            main_metric_expr = literal_column('count(*)').label('ccount')
            metric_type = 'count'

        if with_metric_type:
            return metrics_exprs, main_metric_expr, metric_type.upper()

        return metrics_exprs, main_metric_expr

    def get_sqla_query(  # sqla
            self,
            groupby, metrics,
            granularity,
            from_dttm, to_dttm,
            filter=None,  # noqa
            is_timeseries=True,
            is_total=False,
            timeseries_limit=15,
            timeseries_limit_metric=None,
            row_limit=None,
            page_length=None,
            page_offset=None,
            inner_from_dttm=None,
            inner_to_dttm=None,
            orderby=None,
            extras=None,
            columns=None,
            custom_columns=[],
            order_desc=True,
            prequeries=None,
            is_prequery=False,
            session=None,
            text_join=None,
    ):
        """Querying any sqla table from this common interface"""
        template_kwargs = {
            'from_dttm': from_dttm,
            'groupby': groupby,
            'metrics': metrics,
            'row_limit': row_limit,
            'page_length': page_length,
            'page_offset': page_offset,
            'to_dttm': to_dttm,
            'filter': filter,
            'columns': {col.column_name: col for col in self.get_columns_filter(session=session).all()},

        }
        session = session or db.session
        template_processor = self.get_template_processor(**template_kwargs)
        db_engine_spec = self.database.db_engine_spec

        orderby = orderby or []

        # For backward compatibility
        if granularity not in self.dttm_cols(session=session):
            granularity = self.main_dttm_col

        # Database spec supports join-free timeslot grouping
        time_groupby_inline = db_engine_spec.time_groupby_inline

        cols = {col.column_name: col for col in self.get_columns_filter(session=session).all()}
        metrics_dict = {m.metric_name: m for m in self.get_metrics_filter(session=session).all()}

        if not granularity and is_timeseries:
            raise Exception(_(
                'Datetime column not provided as part table configuration '
                'and is required by this type of chart'))
        if not groupby and not metrics and not columns:
            raise Exception(_('Empty query?'))
        metrics_exprs = []
        metrics_exprs_to_metrics = dict()
        for m in metrics[:]:
            if utils.is_adhoc_metric(m):
                metric_expr = self.adhoc_metric_to_sa(m)
                metric_expr.key = metric_expr.key.replace('%%', ' / 100').replace('%', ' / 100')
            elif m in metrics_dict:
                metric_expr = literal_column(
                    str(metrics_dict.get(m).sqla_col.expression).replace('%%', ' / 100').replace('%', ' / 100'))
                metric_expr = metric_expr.label(m)
            else:
                # Для сортировки по обычным столбцам (не метрикам) на фронте в список метрик добавили обычные столбцы
                # Т.к. сортировка уже учтена, нужно эти обычные столбцы удалить из списка метрик.
                # TODO: Возможно понадобится добавить сюда какую-то валидацию
                metric_expr = None
                metrics.remove(m)
                # raise Exception(_("Metric '{}' is not valid".format(m)))
            if metric_expr is not None:
                metrics_exprs.append(metric_expr)
                metrics_exprs_to_metrics[metric_expr] = m

        if metrics_exprs:
            main_metric_expr = metrics_exprs[0]
        else:
            main_metric_expr = literal_column('COUNT(*)').label('ccount')

        time_aggregation = {}
        used_aggregations = []

        # add complex aggregations for metrics
        for metric_name in metrics:
            if utils.is_adhoc_metric(metric_name):
                continue

            # select complex aggregations for metric
            aggregations = session.query(MetricComplexAggregation).filter_by(
                metric=metrics_dict[metric_name]).order_by('order')

            for aggregation in aggregations:
                aggregation_columns = {c.column.column_name for c in aggregation.hier.columns}

                if aggregation.aggregation_function.lower() in ['last', 'first']:
                    # last first aggregation
                    time_aggregation_cols = time_aggregation.get('cols', [])
                    time_aggregation_cols.extend(groupby)
                    time_aggregation = {
                        'cols': time_aggregation_cols,
                        'order_columns': aggregation.order_columns,
                        'type': aggregation.aggregation_function.lower(),
                    }

                else:
                    # other aggregation (SUM, AVG, COUNT...)
                    used_aggregations.append({
                        'metric': metrics_dict.get(metric_name),
                        'complex_aggregation': aggregation,
                        'columns': aggregation_columns,
                    })

        select_exprs = []
        groupby_exprs = []

        if groupby:
            select_exprs = []
            inner_select_exprs = []
            inner_groupby_exprs = []
            for s in groupby:
                col = cols[s]
                outer = col.sqla_col
                inner = col.sqla_col.label(col.column_name + '__')

                groupby_exprs.append(outer)
                select_exprs.append(outer)
                # bubble map case
                # if columns:
                #     columns_groupby = [cols[s].sqla_col for s in columns if cols[s] != col]
                #     select_exprs.extend(columns_groupby)
                #     groupby_exprs.extend(columns_groupby)
                inner_groupby_exprs.append(inner)
                inner_select_exprs.append(inner)
        elif columns:
            for s in columns:
                select_exprs.append(cols[s].sqla_col)
            metrics_exprs = []

        if granularity:
            dttm_col = cols[granularity]
            time_grain = extras.get('time_grain_sqla')
            time_filters = []

            if is_timeseries:
                timestamp = dttm_col.get_timestamp_expression(time_grain)
                select_exprs += [timestamp]
                groupby_exprs += [timestamp]

                for idx, metric_expr in enumerate(metrics_exprs):
                    m = metrics_exprs_to_metrics[metric_expr]
                    if utils.is_adhoc_metric(m) and m.get('cumulativeTotal'):
                        metrics_exprs[idx] = self.sa_metric_with_cumulative_total(m, groupby, timestamp)

            # Use main dttm column to support index with secondary dttm columns
            # if db_engine_spec.time_secondary_columns and \
            #         self.main_dttm_col in self.dttm_cols and \
            #         self.main_dttm_col != dttm_col.column_name:
            #     time_filters.append(cols[self.main_dttm_col].
            #                         get_time_filter(from_dttm, to_dttm))
            time_filters.append(dttm_col.get_time_filter(from_dttm, to_dttm))

        select_exprs += metrics_exprs
        qry = sa.select(select_exprs)

        tbl = self.get_from_clause(template_processor, db_engine_spec)

        # (columns and groupby) clause the bubble map case
        if not columns or (columns and groupby):
            qry = qry.group_by(*[x.name for x in groupby_exprs])

        having_clause_and = []

        # filter = [
        #     {
        #         "col": "gender",
        #         "op": "in",
        #         "val": [
        #             "boy"
        #         ],
        #         "conjuction": "or"
        #     },
        #     {
        #         "conjuction": "and",
        #         "children": [
        #             {
        #                 "col": "gender",
        #                 "op": "in",
        #                 "val": [
        #                     "girl"
        #                 ],
        #                 "conjuction": "and"
        #             },
        #             {
        #                 "conjuction": "and",
        #                 "children": [
        #                     {
        #                         "col": "state",
        #                         "op": "in",
        #                         "val": [
        #                             "NY"
        #                         ],
        #                         "conjuction": "or"
        #                     },
        #                     {
        #                         "col": "state",
        #                         "op": "in",
        #                         "val": [
        #                             "TX",
        #                             "CA"
        #                         ],
        #                         "conjuction": "or"
        #                     }
        #                 ]
        #             }
        #         ]
        #     }
        # ]

        def build_condition(flt):
            if not all([flt.get(s) for s in ['col', 'op', 'val']]):
                return

            col = flt['col']
            op = flt['op']
            eq = flt['val']
            col_obj = cols.get(col)
            if not col_obj:
                return

            type_str = col_obj.type.upper()
            is_str_type = any(str_type in type_str for str_type in BaseColumn.str_types)

            if op in ('in', 'not in'):
                sqla_col = col_obj.sqla_col
                if is_str_type and config.SQL_CASE_INSENSITIVE:
                    engine_name = self.database.get_sqla_engine().name
                    lower_func = 'lowerUTF8' if engine_name == 'clickhouse' else 'lower'
                    # Using `lower()` and `lowerUTF8()` methods change param names in SQL query from
                    # from `... WHERE <column_name> IN (:param_1, :param_2) GROUP BY ...`
                    # to   `... WHERE lowerUTF8(<column_name>) IN (:lowerUTF8_1, :lowerUTF8_2) GROUP BY ...`
                    sqla_col = getattr(sa.func, lower_func)(col_obj.sqla_col)

                values = []
                for v in eq:
                    # For backwards compatibility and edge cases
                    # where a column data type might have changed
                    if isinstance(v, basestring):
                        if not is_str_type:
                            # Quotes in start of string should not be replaced
                            # because string can contain quotes in start of string
                            v = re.sub('^("|\')(.*)("|\')$', '\\2', v)

                        type_str_lower = type_str.lower()
                        if col_obj.is_num:
                            v = utils.string_to_num(v)
                        elif ('date' in type_str_lower or
                              'timestamp' in type_str_lower):
                            datetime_val = utils.parse_human_datetime(v)
                            if 'datetime' in type_str_lower:
                                v = datetime_val.strftime('%Y-%m-%dT%H:%M:%S')
                            else:
                                v = str(datetime_val.date())

                        elif is_str_type and config.SQL_CASE_INSENSITIVE:
                            v = v.lower()

                    # Removing empty strings and non numeric values
                    # targeting numeric columns
                    if v is not None:
                        values.append(v)

                cond = sqla_col.in_(values)
                if op == 'not in':
                    cond = ~cond
            elif op == 'intable':
                table = db.session.query(SqlaTable).filter(SqlaTable.id == eq['value']).first()
                if table:
                    select_sql = sa.select([sa.text(f'{flt["col"]} from ({table.sql}) as subquery')])
                    cond = col_obj.sqla_col.in_(select_sql)
            else:
                if col_obj.is_num:
                    eq = utils.string_to_num(flt['val'])
                elif 'date' in type_str.lower():
                    datetime_val = utils.parse_human_datetime(eq)
                    if 'datetime' in type_str.lower():
                        eq = datetime_val.strftime('%Y-%m-%dT%H:%M:%S')
                    else:
                        eq = str(datetime_val.date())
                if op == '==':
                    cond = col_obj.sqla_col == eq
                elif op == '!=':
                    cond = col_obj.sqla_col != eq
                elif op == '>':
                    cond = col_obj.sqla_col > eq
                elif op == '<':
                    cond = col_obj.sqla_col < eq
                elif op == '>=':
                    cond = col_obj.sqla_col >= eq
                elif op == '<=':
                    cond = col_obj.sqla_col <= eq
                elif op == 'LIKE':
                    cond = col_obj.sqla_col.like(eq)
                else:
                    return

            return cond

        def build_filter(filters):
            prev_operation = None
            where = None

            for flt in filters:
                if flt.get('children'):
                    cond = build_filter(flt.get('children')).self_group()
                else:
                    cond = build_condition(flt)

                    if cond is None:
                        continue

                if where is None:
                    where = cond
                else:
                    if not prev_operation or prev_operation == 'and':
                        where = where & cond
                    else:
                        where = where | (cond)

                prev_operation = flt.get('conjuction')

            return where

        where_clause = build_filter(filter)
        where_extras = []

        if extras:
            where = extras.get('where')
            if where:
                where = template_processor.process_template(where)
                where_extras = [sa.text('({})'.format(where))]

            having = extras.get('having')
            if having:
                having = template_processor.process_template(having)
                having_clause_and += [sa.text('({})'.format(having))]

        if where_extras:
            qry = qry.where(*where_extras)

        if granularity:
            qry = qry.where(*time_filters)

        if where_clause is not None:
            qry = qry.where(where_clause)

        qry = qry.having(and_(*having_clause_and))

        if not orderby and not columns:
            orderby = [(main_metric_expr, not order_desc)]

        for col, ascending in orderby:
            direction = asc if ascending else desc
            qry = qry.order_by(direction(col))

        if is_timeseries and \
                timeseries_limit and groupby and not time_groupby_inline:
            if self.database.db_engine_spec.inner_joins:
                # some sql dialects require for order by expressions
                # to also be in the select clause -- others, e.g. vertica,
                # require a unique inner alias
                inner_main_metric_expr = main_metric_expr.label('mme_inner__')
                inner_select_exprs += [inner_main_metric_expr]
                subq = select(inner_select_exprs)
                subq = subq.select_from(tbl)
                inner_time_filter = dttm_col.get_time_filter(
                    inner_from_dttm or from_dttm,
                    inner_to_dttm or to_dttm,
                )
                subq = subq.where(*[inner_time_filter])

                if where_clause is not None:
                    subq = subq.where(where_clause)

                subq = subq.group_by(*inner_groupby_exprs)
                ob = inner_main_metric_expr
                if timeseries_limit_metric:
                    timeseries_limit_metric = metrics_dict.get(timeseries_limit_metric)
                    ob = timeseries_limit_metric.sqla_col
                direction = desc if order_desc else asc
                subq = subq.order_by(direction(ob))
                subq = subq.limit(timeseries_limit)

                on_clause = []
                for i, gb in enumerate(groupby):
                    on_clause.append(
                        groupby_exprs[i] == column(gb + '__'))

                tbl = tbl.join(subq.alias(), and_(*on_clause))
            else:
                # run subquery to get top groups
                subquery_obj = {
                    'prequeries': prequeries,
                    'is_prequery': True,
                    'is_timeseries': False,
                    'row_limit': timeseries_limit,
                    'groupby': groupby,
                    'metrics': metrics,
                    'granularity': granularity,
                    'from_dttm': inner_from_dttm or from_dttm,
                    'to_dttm': inner_to_dttm or to_dttm,
                    'filter': filter,
                    'orderby': orderby,
                    'extras': extras,
                    'columns': columns,
                    'order_desc': True,
                }
                result = self.query(subquery_obj)
                dimensions = [c for c in result.df.columns if c not in metrics]
                top_groups = self._get_top_groups(result.df, dimensions)
                qry = qry.where(top_groups)

        columns_depends = [set(a['columns']) for a in used_aggregations]
        all_columns_qry = qry.columns._all_columns

        # adding subquery for last/first complex aggregation
        if time_aggregation:
            _cols = time_aggregation['cols']

            if self.database.db_engine_spec.engine == 'clickhouse':
                concat_columns = []
                for i, _col in enumerate(reversed(time_aggregation['order_columns'].split(','))):
                    weight = 10 ** (i * 2)
                    concat_columns.append('{c} * {w}'.format(c=_col, w=weight))

                concat = '+'.join(concat_columns)

                select_exprs.append('{} as moment'.format(concat))
                groupby_exprs.append(literal_column('moment'))
                where_clause = qry._whereclause
                qry = sa.select(select_exprs)

                if not columns:
                    qry = qry.group_by(*groupby_exprs)

                # subquery select
                select_expr = '{function}({concat}) AS moment, {subq_cols}'.format(
                    function='MAX' if time_aggregation['type'] == 'last' else 'MIN',
                    concat=concat,
                    subq_cols=','.join(map(lambda col: '{col}'.format(col=col), _cols))
                )

                subq = select([select_expr])
                subq = subq.select_from(self.get_sqla_table())
                subq = subq.group_by(*_cols)
                subq = subq.where(where_clause)

                tbl = tbl.join(subq.alias(), sa.text(','.join(['moment'] + _cols)))

            else:
                formatted_order_columns = [
                    r"substring(CONCAT('0000', {c}), CHAR_LENGTH(CONCAT('0000', {c})) - 3)".format(c=c) for c in
                    time_aggregation['order_columns'].split(',')]

                concat = 'CONCAT({})'.format(','.join(formatted_order_columns))

                groupby_exprs.append(concat)
                where_clause = qry._whereclause
                qry = sa.select(select_exprs)

                if not columns:
                    qry = qry.group_by(*groupby_exprs)

                select_expr = '{function}({concat}) AS moment__, {subq_cols}'.format(
                    function='MAX' if time_aggregation['type'] == 'last' else 'MIN',
                    concat=concat,
                    subq_cols=','.join(map(lambda col: '{col} AS {col}__'.format(col=col), _cols))
                )

                subq = select([select_expr])
                subq = subq.select_from(self.get_sqla_table())
                subq = subq.group_by(*_cols)
                subq = subq.where(where_clause)

                on_clause = ['{} = moment__'.format(concat)]
                for i, gb in enumerate(groupby):
                    on_clause.append(
                        groupby_exprs[i] == column(gb + '__'))

                tbl = tbl.join(subq.alias(), and_(*on_clause))

        # apply complex aggregation
        for it, aggregation in enumerate(used_aggregations, start=1):
            # initialize variables
            metric_name = aggregation['metric'].metric_name
            measure = 'measure{}'.format(it)
            last_measure = 'measure{}'.format(it - 1)

            # copy qry to inner_query
            inner_query = copy(qry)

            # build set with columns that used in next aggregations
            next_aggregation_columns = functools.reduce(lambda acc, _cols: acc | _cols, columns_depends[it - 1:], set())

            # columns from complex aggregation and from next aggregations
            aggregation_columns = set(aggregation['columns']) | next_aggregation_columns

            # columns from slice settings without aggregation metric
            select_columns = set(map(lambda c: c.name, all_columns_qry))
            select_columns.discard(metric_name)
            if it > 1:
                select_columns.discard(last_measure)

            # creates complex aggregation metric
            if it == 1:
                # add FROM clause for first iteration
                inner_query = inner_query.select_from(tbl)

                # remove default function
                metric_expression = aggregation['metric'].expression
                split = metric_expression.split('(')
                if len(split) > 0:
                    metric_expression = split[1].strip(')')
                expr = literal_column(metric_expression).label(metric_name)

                rc_cols = []
                for c in inner_query._raw_columns:
                    if str(c) != aggregation['metric'].expression:
                        rc_cols.append(c)
                    else:
                        rc_cols.append(expr)
                inner_query._raw_columns = rc_cols
                inner_query.append_group_by(expr)

                # adds columns that not selected in slice, but used by next_aggregations
                for _col in next_aggregation_columns - select_columns:
                    inner_query.append_column(_col)
                    inner_query.append_group_by(_col)

                agr_column_name = metric_name \
                    if self.database.db_engine_spec.engine == 'clickhouse' \
                    else 'innerqs1.{}'.format(metric_name)

                expr_format = '{func}({column_name})'.format(
                    func=aggregation['complex_aggregation'].aggregation_function,
                    column_name=agr_column_name
                )
            else:
                expr_format = '{func}({last_measure})'.format(
                    func=aggregation['complex_aggregation'].aggregation_function,
                    last_measure=last_measure,
                )

            select_metric = literal_column(expr_format).label(measure)
            qry_all_columns = list(select_columns | aggregation_columns)

            if it == len(used_aggregations):
                # build last query
                select_metric = select_metric.label(metric_name)
                _cols = []
                for col in all_columns_qry:
                    if col.name == metric_name:
                        continue
                    _cols.append(col.name)
                qry = sa.select(_cols + [select_metric])
            else:
                # build new query
                qry = sa.select(qry_all_columns + [select_metric])

            qry = qry.group_by(*qry_all_columns)
            if self.database.db_engine_spec.engine == 'clickhouse':
                qry = qry.select_from(inner_query)
            else:
                qry = qry.select_from(inner_query.alias('innerqs{}'.format(it)))

        if used_aggregations:
            if is_total:
                return select([func.count().label('total_found')]).select_from(
                    qry.order_by(None).alias('countqs'))

            if timeseries_limit or page_length:
                if timeseries_limit and page_length:
                    qry_limit = min(timeseries_limit, page_length)
                else:
                    qry_limit = max(timeseries_limit, page_length)
                qry = qry.limit(qry_limit)

            if page_offset:
                qry = qry.offset(page_offset)

            return qry

        qry = self.get_filter_by_scope(qry)

        if is_total:
            return select([func.count().label('total_found')]).select_from(
                qry.select_from(tbl).order_by(None).alias('countqs'))

        if row_limit or page_length:
            if row_limit and page_length:
                qry_limit = min(row_limit, page_length)
            else:
                qry_limit = max(row_limit, page_length)
            qry = qry.limit(qry_limit)

        if page_offset:
            qry = qry.offset(page_offset)

        for custom_column in custom_columns:
            qry.append_column(text(custom_column))

        return qry.select_from(tbl)

    def text_join_table(self, tbl, text_join, cols):
        query_columns = {col: str(cols[col].sqla_col) for col in cols}
        join_with = text_join['join_with'].format(**query_columns)
        on = text_join['on'].format(**query_columns)

        user_table = text(join_with).columns(*[column(c) for c in text_join['columns']])
        user_table = user_table.alias(name='table2')
        joined_table = tbl.outerjoin(user_table, text(on))
        replace_columns = text_join.get('replace_query_columns')

        if replace_columns:
            columns = {query_columns[col]: replace_columns.get(col, query_columns[col]).format(**query_columns) for col in query_columns}
            qry = db.session.query(*[f'{columns[col]} as {col}' for col in columns]).select_from(joined_table)
            return qry.subquery('subq')

        return joined_table

    def get_total_found(self, query_obj, session=None):
        query_obj['is_total'] = True
        total_sql = self.get_query_str(query_obj, session=session)
        eng = self.database.get_sqla_engine()
        try:
            total_df = pd.read_sql_query(total_sql, eng)
            records = total_df.to_dict(orient="records")
            total_found = records[0].get('total_found', 0)
        except:
            total_found = 0
        return total_found

    def _get_top_groups(self, df, dimensions):
        cols = {col.column_name: col for col in self.columns}
        groups = []
        for unused, row in df.iterrows():
            group = []
            for dimension in dimensions:
                col_obj = cols.get(dimension)
                group.append(col_obj.sqla_col == row[dimension])
            groups.append(and_(*group))

        return or_(*groups)

    def query(self, query_obj, session=None):
        qry_start_dttm = datetime.now()
        sql = self.get_query_str(query_obj, session=session)
        status = QueryStatus.SUCCESS
        error_message = None
        df = None
        try:
            df = self.database.get_df(sql, self.schema)
        except Exception as e:
            status = QueryStatus.FAILED
            logging.exception(e)
            error_message = (
                self.database.db_engine_spec.extract_error_message(e))

        # if this is a main query with prequeries, combine them together
        if not query_obj['is_prequery']:
            query_obj['prequeries'].append(sql)
            sql = ';\n\n'.join(query_obj['prequeries'])
        sql += ';'

        return QueryResult(
            status=status,
            df=df,
            total_found=self.get_total_found(query_obj, session=session),
            duration=datetime.now() - qry_start_dttm,
            query=sql,
            error_message=error_message)

    def get_sqla_table_object(self):
        return self.database.get_table(self.table_name, schema=self.schema)

    def fetch_metadata(self) -> Set[Tuple[str, str]]:
        """Fetches the metadata for the table and merges it in"""
        try:
            table = self.get_sqla_table_object()  # таблица в Аналитическом хранилище (далее АХ)
        except Exception as ex:
            print(self.table_name, self.schema, ex)
            raise Exception(_(
                "Table [{}] doesn't seem to exist in the specified database, "
                "couldn't fetch column information").format(self.table_name))

        ui_messages = set()
        M = SqlMetric  # noqa
        metrics = []
        any_date_col = None
        db_dialect = self.database.get_dialect()

        # Подтягивание комментариев к колонкам таблицы, если она в clickhouse
        is_clickhouse = db_dialect.name.lower() == 'clickhouse'
        if is_clickhouse:
            db_engine = self.database.get_sqla_engine()
            # Injection vulnerability but "Multi-statements are not allowed" will be raised upon appearance ";"
            query_str = f'DESCRIBE TABLE {table.fullname}'
            with db_engine.connect() as con:
                res = con.execute(query_str)
            try:
                column_comments = {row['name']: row['comment'] for row in res}
            except KeyError:
                msg = 'Column comments does not support for Clickhouse versions less than v.19.11.8.'
                logging.warning(msg)
                ui_messages.add((_(msg), 'warning'))
                column_comments = {}

        # ДАННЫЕ(лежат в Superset) О КОЛОНКЕ в АХ
        dbcols = (
            db.session.query(TableColumn)
                .filter(TableColumn.table == self)
                .filter(or_(TableColumn.column_name == col.name
                            for col in table.columns)))
        dbcols = {dbcol.column_name: dbcol for dbcol in dbcols}

        columns = []

        for col in table.columns:  # колонка таблицы в АХ
            try:
                datatype = col.type.compile(dialect=db_dialect).upper()
            except Exception as e:
                datatype = 'UNKNOWN'
                logging.error(
                    'Unrecognized data type in {}.{}'.format(table, col.name))
                logging.exception(e)
            dbcol = dbcols.get(col.name, None)  # Данные О КОЛОНКЕ (лежат в Superset)

            if is_clickhouse:
                col.comment = column_comments.get(col.name) or None  # noqa: F832

            # Если комментарий содежит символ процента, то для того,
            # что бы избежать ошибку "ValueError: unsupported format character" в jinja2 шаблоне где используется |safe
            # его необходимо продублировать
            if col.comment and '%' in col.comment:
                col.comment = col.comment.replace('%', '%%')

            # Если данных о колонке нет в Superset
            if not dbcol:
                dbcol = TableColumn(column_name=col.name, type=datatype, table_id=self.id)
                dbcol.groupby = True
                dbcol.filterable = True
                dbcol.auto_upd_verbose_name = True
                dbcol.sum = dbcol.is_num
                dbcol.avg = dbcol.is_num
                dbcol.is_dttm = dbcol.is_time
                dbcol.verbose_name = col.comment

            # Если данные о колонке есть в Superset
            else:
                dbcol.type = datatype
                if dbcol.auto_upd_verbose_name is None:
                    dbcol.auto_upd_verbose_name = True
                if dbcol.auto_upd_verbose_name and col.comment:
                    dbcol.verbose_name = col.comment

            dbcol.is_meta_update = True  # Параметр, используемый только для логгирования изменений в TableColumn
            columns.append(dbcol)
            if not any_date_col and dbcol.is_time:
                any_date_col = col.name
            metrics += dbcol.get_metrics().values()

        # Определяем показатели, которых нет в АХ, но есть в Superset
        dbcols_all = db.session.query(TableColumn).filter(TableColumn.table == self).distinct().all()
        col_names_in_table = {col.name for col in table.columns}
        dbcols_all = {dbcol.column_name: dbcol for dbcol in dbcols_all if dbcol.column_name not in col_names_in_table}
        for col_name, dbcol in dbcols_all.items():
            # Отфильтровываем(игнорируем) вычисляемые показатели
            if not dbcol.is_calculated:
                # Для этих показателей снимаем атрибуты Группируемый, Фильтрующийся
                dbcol.groupby = False
                dbcol.filterable = False
                columns.append(dbcol)

        metrics.append(M(
            metric_name='count',
            verbose_name='COUNT(*)',
            metric_type='count',
            expression='COUNT(*)',
        ))
        if not self.main_dttm_col:
            self.main_dttm_col = any_date_col
        db.session.merge(self)
        db.session.commit()
        db.session.add_all(self.add_missing_metrics(metrics, is_meta_update=True))
        db.session.add_all(columns)
        db.session.commit()
        return ui_messages

    @classmethod
    def import_obj(cls, i_datasource, import_time=None):
        """Imports the datasource from the object to the database.

         Metrics and columns and datasource will be overrided if exists.
         This function can be used to import/export dashboards between multiple
         superset instances. Audit metadata isn't copies over.
        """

        def lookup_sqlatable(table):
            return db.session.query(SqlaTable).join(Database).filter(
                SqlaTable.table_name == table.table_name,
                SqlaTable.schema == table.schema,
                Database.id == table.database_id,
            ).first()

        def lookup_database(table):
            return db.session.query(Database).filter_by(
                database_name=table.params_dict['database_name']).one()

        return import_util.import_datasource(
            db.session, i_datasource, lookup_database, lookup_sqlatable,
            import_time)

    @classmethod
    def query_datasources_by_name(
            cls, session, database, datasource_name, schema=None):
        query = (
            session.query(cls)
                .filter_by(database_id=database.id)
                .filter_by(table_name=datasource_name)
        )
        if schema:
            query = query.filter_by(schema=schema)
        return query.all()


if not INIT_PROCESS:
    sa.event.listen(SqlaTable, 'after_insert', set_perm)
    sa.event.listen(SqlaTable, 'after_update', set_perm)


class TableHierarchy(ChangeLogMixin, Model):
    __tablename__ = 'table_hier'

    id = Column(Integer, primary_key=True)
    hier_name = Column(String(256))

    table_id = Column(Integer, ForeignKey('tables.id'))
    table = relationship('SqlaTable',
                         backref=backref('hierarchies', cascade='all, delete-orphan'), foreign_keys=[table_id])

    created_on = sa.Column(sa.DateTime, default=datetime.now)
    changed_on = sa.Column(sa.DateTime, default=datetime.now, onupdate=datetime.now)

    def __str__(self):
        return self.hier_name

    @property
    def table_link(self):
        name = escape(self.hier_name)
        return Markup(f'<a href="{self.table.explore_url}">{name}</a>')


class TableHierarchyColumn(ChangeLogMixin, Model):
    __tablename__ = 'table_hier_columns'

    id = Column(Integer, primary_key=True)
    hier_id = Column(Integer, ForeignKey('table_hier.id'))
    hier = relationship('TableHierarchy',
                        backref=backref('columns', cascade='all, delete-orphan',
                                        order_by="TableHierarchyColumn.column_order"), foreign_keys=[hier_id])

    column_id = Column(Integer, ForeignKey('table_columns.id'))
    column = relationship('TableColumn',
                          backref=backref('hierarchies', cascade='all, delete-orphan'), foreign_keys=[column_id])

    column_order = Column(Integer)

    def __repr__(self):
        return f'<{self.__class__.__name__} id={self.id} col_id={self.column_id} col_name={self.column.column_name}>'

    @property
    def real_name(self):
        return f'{self.hier.hier_name} [к показателю "{self.column.real_name}"(id={self.column_id})]'

    @staticmethod
    def create_change_log(
            target: 'ChangeLogMixin', action: str, obj_field: str, old_value: Optional[str], new_value: Optional[str],
    ) -> 'ChangeLog':
        target.table_id = target.hier.table_id
        target.table = target.hier.table
        return super().create_change_log(target, action, obj_field, old_value, new_value)


class MetricComplexAggregation(Model):
    __tablename__ = 'metric_complex_aggregations'

    id = Column(Integer, primary_key=True)

    hier_id = Column(Integer, ForeignKey('table_hier.id'))
    hier = relationship('TableHierarchy', foreign_keys=[hier_id])

    metric_id = Column(Integer, ForeignKey('sql_metrics.id'))
    metric = relationship('SqlMetric', foreign_keys=[metric_id])

    aggregation_function = Column(String)
    order_columns = Column(String)

    order = Column(Integer)


class TableColumnGroup(Model):
    __tablename__ = 'table_column_groups'

    id = Column(Integer, primary_key=True)
    title = Column(String(255))

    def __str__(self):
        return self.title

    def get_associated_columns(self):
        return db.session.query(TableColumn).filter(TableColumn.group_id == self.id)

    def get_slices(self):
        slices = list()
        for table_column in self.get_associated_columns():
            slices.append(table_column.get_slices())
        return _it.chain(*slices)

    def get_tables(self):
        return db.session.query(SqlaTable).join(TableColumn).filter(TableColumn.group_id == self.id).distinct().all()

    def get_metrics(self):
        return db.session.query(SqlMetric).filter(SqlMetric.group_id == self.id).distinct().all()
