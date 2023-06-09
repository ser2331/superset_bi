# -*- coding: utf-8 -*-
"""A set of constants and methods to manage permissions and security"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import logging

from flask import g
from flask_appbuilder import expose
from flask_appbuilder.security.sqla import models as ab_models
from flask_appbuilder.security.sqla.manager import SecurityManager
from flask_appbuilder.security.views import AuthDBView
from sqlalchemy import or_, not_, and_
from sqlalchemy.orm import lazyload

from superset import sql_parse
from superset.connectors.connector_registry import ConnectorRegistry
from superset.constants import DENIED, SLICE_PERMISSIONS, \
    DASHBOARD_PERMISSIONS, CAN_EXPLORE, CAN_DOWNLOAD, \
    CAN_CONFIG, SQTABLE_PERMISSIONS, DATABASE_PERMISSIONS
from superset.sec_models import CustomRole
from superset.sec_models import CustomUser
from superset.security_views import SupersetUserDBModelView, \
    CustomRoleModelView, CustomUserStatsChartView
from . import constants as const
from .utils import log_this

READ_ONLY_MODEL_VIEWS = {
    'DatabaseAsync',
    'DatabaseView',
    'DruidClusterModelView',
}

GAMMA_READ_ONLY_MODEL_VIEWS = {
    'SqlMetricInlineView',
    'TableColumnInlineView',
    'TableModelView',
    'DruidColumnInlineView',
    'DruidDatasourceModelView',
    'DruidMetricInlineView',
} | READ_ONLY_MODEL_VIEWS

ADMIN_ONLY_VIEW_MENUS = {
    'AccessRequestsModelView',
    'Manage',
    'SQL Lab',
    'Queries',
    'Refresh Druid Metadata',
    'ResetPasswordView',
    'RoleModelView',
    'Security',
    'UserDBModelView',
    'UserLDAPModelView',
    'UserOAuthModelView',
    'UserOIDModelView',
    'UserRemoteUserModelView',
}

ALPHA_ONLY_VIEW_MENUS = {
    'Upload a CSV',
}

ADMIN_ONLY_PERMISSIONS = {
    'all_database_access',
    'can_sql_json',  # TODO: move can_sql_json to sql_lab role
    'can_override_role_permissions',
    'can_sync_druid_source',
    'can_approve',
    'can_update_role',
    const.CAN_DOWNLOAD_CHANGELOG,
}

READ_ONLY_PERMISSION = {
    'can_show',
    'can_list',
}

ALPHA_ONLY_PERMISSIONS = {
    'muldelete',
    'all_datasource_access',
}

OBJECT_SPEC_PERMISSIONS = {
    'database_access',
    'schema_access',
    'datasource_access',
    'metric_access',
}


class CustomAuthDBView(AuthDBView):
    @log_this
    @expose('/login/', methods=['GET', 'POST'])
    def login(self):
        return super().login()


class SupersetSecurityManager(SecurityManager):
    userdbmodelview = SupersetUserDBModelView
    rolemodelview = CustomRoleModelView
    authdbview = CustomAuthDBView
    user_model = CustomUser
    role_model = CustomRole
    userstatschartview = CustomUserStatsChartView

    def get_schema_perm(self, database, schema):
        if schema:
            return '[{}].[{}]'.format(database, schema)

    def can_access(self, permission_name, view_name, user=None):
        """Protecting from has_access failing from missing perms/view"""
        if not user:
            user = g.user
        if user.is_anonymous():
            return self.is_item_public(permission_name, view_name)
        return self._has_view_access(user, permission_name, view_name)

    def all_datasource_access(self, user=None):
        return self.can_access(
            'all_datasource_access', 'all_datasource_access', user=user)

    def database_access(self, database, user=None):
        return (
            self.can_access(
                'all_database_access', 'all_database_access', user=user) or
            self.can_access('database_access', database.perm, user=user)
        )

    def schema_access(self, datasource, user=None):
        return (
            self.database_access(datasource.database, user=user) or
            self.all_datasource_access(user=user) or
            self.can_access('schema_access', datasource.schema_perm, user=user)
        )

    def datasource_access(self, datasource, user=None):
        return (
            self.schema_access(datasource, user=user) or
            self.can_access('datasource_access', datasource.perm, user=user)
        )

    def datasource_access_by_name(
            self, database, datasource_name, schema=None):
        from superset import db

        if self.database_access(database) or self.all_datasource_access():
            return True

        schema_perm = self.get_schema_perm(database, schema)
        if schema and self.can_access('schema_access', schema_perm):
            return True

        datasources = ConnectorRegistry.query_datasources_by_name(
            db.session, database, datasource_name, schema=schema)
        for datasource in datasources:
            if self.can_access('datasource_access', datasource.perm):
                return True
        return False

    def datasource_access_by_fullname(
            self, database, full_table_name, schema):
        table_name_pieces = full_table_name.split('.')
        if len(table_name_pieces) == 2:
            table_schema = table_name_pieces[0]
            table_name = table_name_pieces[1]
        else:
            table_schema = schema
            table_name = table_name_pieces[0]
        return self.datasource_access_by_name(
            database, table_name, schema=table_schema)

    def rejected_datasources(self, sql, database, schema):
        superset_query = sql_parse.SupersetQuery(sql)
        return [
            t for t in superset_query.tables if not
            self.datasource_access_by_fullname(database, t, schema)]

    def user_datasource_perms(self):
        datasource_perms = set()
        for r in g.user.roles:
            for perm in r.permissions:
                if (
                        perm.permission and
                        'datasource_access' == perm.permission.name):
                    datasource_perms.add(perm.view_menu.name)
        return datasource_perms

    def schemas_accessible_by_user(self, database, schemas):
        from superset import db
        from superset.connectors.sqla.models import SqlaTable
        if self.database_access(database) or self.all_datasource_access():
            return schemas

        subset = set()
        for schema in schemas:
            schema_perm = self.get_schema_perm(database, schema)
            if self.can_access('schema_access', schema_perm):
                subset.add(schema)

        perms = self.user_datasource_perms()
        if perms:
            tables = (
                db.session.query(SqlaTable)
                .filter(
                    SqlaTable.perm.in_(perms),
                    SqlaTable.database_id == database.id,
                )
                .all()
            )
            for t in tables:
                if t.schema:
                    subset.add(t.schema)
        return sorted(list(subset))

    def accessible_by_user(self, database, datasource_names, schema=None):
        from superset import db
        if self.database_access(database) or self.all_datasource_access():
            return datasource_names

        if schema:
            schema_perm = self.get_schema_perm(database, schema)
            if self.can_access('schema_access', schema_perm):
                return datasource_names

        user_perms = self.user_datasource_perms()
        user_datasources = ConnectorRegistry.query_datasources_by_permissions(
            db.session, database, user_perms)
        if schema:
            names = {
                d.table_name
                for d in user_datasources if d.schema == schema}
            return [d for d in datasource_names if d in names]
        else:
            full_names = {d.full_name for d in user_datasources}
            return [d for d in datasource_names if d in full_names]

    def merge_perm(self, permission_name, view_menu_name):
        # Implementation copied from sm.find_permission_view_menu.
        # TODO: use sm.find_permission_view_menu once issue
        #       https://github.com/airbnb/superset/issues/1944 is resolved.
        permission = self.find_permission(permission_name)
        view_menu = self.find_view_menu(view_menu_name)
        pv = None
        if permission and view_menu:
            pv = self.get_session.query(self.permissionview_model).filter_by(
                permission=permission, view_menu=view_menu).first()
        if not pv and permission_name and view_menu_name:
            pv = self.add_permission_view_menu(permission_name, view_menu_name)
        return pv

    def is_user_defined_permission(self, perm):
        return perm.permission.name in OBJECT_SPEC_PERMISSIONS

    def add_custom_permissions(self):
        self.merge_perm(CAN_EXPLORE, 'TableModelView')
        self.merge_perm(CAN_DOWNLOAD, 'SliceModelView')
        self.merge_perm(CAN_DOWNLOAD, 'DashboardModelView')
        self.merge_perm(CAN_CONFIG, 'SliceModelView')
        self.merge_perm(CAN_CONFIG, 'DashboardModelView')

    def create_custom_permissions(self):
        # Global perms
        self.merge_perm('all_datasource_access', 'all_datasource_access')
        self.merge_perm('all_database_access', 'all_database_access')
        self.merge_perm('schema_access', 'TableModelView')

        self.add_custom_permissions()

    def create_missing_perms(self):
        """Creates missing perms for datasources, schemas and metrics"""
        from superset import db
        from superset.models import core as models

        logging.info(
            'Fetching a set of all perms to lookup which ones are missing')
        all_pvs = set()
        for pv in self.get_session.query(self.permissionview_model).all():
            if pv.permission and pv.view_menu:
                all_pvs.add((pv.permission.name, pv.view_menu.name))

        def merge_pv(view_menu, perm):
            """Create permission view menu only if it doesn't exist"""
            if view_menu and perm and (view_menu, perm) not in all_pvs:
                self.merge_perm(view_menu, perm)

        logging.info('Creating missing datasource permissions.')
        datasources = ConnectorRegistry.get_all_datasources(db.session)
        for datasource in datasources:
            for perm in SQTABLE_PERMISSIONS:
                merge_pv(perm, datasource.get_perm())

        logging.info('Creating missing database permissions.')
        databases = db.session.query(models.Database).all()
        for database in databases:
            for perm in DATABASE_PERMISSIONS:
                merge_pv(perm, database.get_perm())

        logging.info('Creating missing metrics permissions')
        metrics = []
        for datasource_class in ConnectorRegistry.sources.values():
            metrics += list(db.session.query(datasource_class.metric_class).all())

        for metric in metrics:
            if metric.is_restricted:
                merge_pv('metric_access', metric.perm)

        logging.info('Creating missing slice permissions.')
        slices = self.get_session.query(models.Slice).all()
        for slice in slices:
            name = slice.get_perm()
            for perm in SLICE_PERMISSIONS:
                merge_pv(perm, name)

        logging.info('Creating missing dashboard permissions.')
        dashboards = self.get_session.query(models.Dashboard).all()
        for dashboard in dashboards:
            name = dashboard.get_perm()
            for perm in DASHBOARD_PERMISSIONS:
                merge_pv(perm, name)

    def clean_perms(self):
        """FAB leaves faulty permissions that need to be cleaned up"""
        logging.info('Cleaning faulty perms')
        sesh = self.get_session
        obj_permissions = set(
            DASHBOARD_PERMISSIONS + SLICE_PERMISSIONS
        )
        # убираем ошибочные разрешения недоступные для Отчетов и Витрин
        faulty_obj_permissions_ids = (
            sesh.query(ab_models.PermissionView.id)
                .join(ab_models.Permission)
                .join(ab_models.ViewMenu)
                .filter(
                    and_(
                        ~ab_models.Permission.name.in_(obj_permissions),
                        or_(
                            ab_models.ViewMenu.name.like('[slice]%'),
                            ab_models.ViewMenu.name.like('[dashboard]%'),
                        )
                    )
                ).subquery()
        )
        # убираем ошибочные разрешения у ролей
        perm_view_roles = ab_models.assoc_permissionview_role.delete().where(
            ab_models.assoc_permissionview_role.c.permission_view_id.in_(
                faulty_obj_permissions_ids))
        sesh.execute(perm_view_roles)

        pvms = (
            sesh.query(ab_models.PermissionView).filter(
                or_(
                    or_(
                        ab_models.PermissionView.permission == None,  # NOQA
                        ab_models.PermissionView.view_menu == None,  # NOQA
                    ),
                    ab_models.PermissionView.id.in_(
                        faulty_obj_permissions_ids
                    )
                )
            )
        )
        deleted_count = pvms.delete(synchronize_session='fetch')
        sesh.commit()
        if deleted_count:
            logging.info('Deleted {} faulty permissions'.format(deleted_count))

    def sync_role_definitions(self):
        """Inits the Superset application with security roles and such"""
        from superset import conf
        logging.info('Syncing role definition')

        self.create_custom_permissions()

        # Creating default roles
        self.set_role('Admin', self.is_admin_pvm)
        self.set_role('Alpha', self.is_alpha_pvm)
        self.set_role('Gamma', self.is_gamma_pvm)
        self.set_role('granter', self.is_granter_pvm)
        self.set_role('sql_lab', self.is_sql_lab_pvm)

        if conf.get('PUBLIC_ROLE_LIKE_GAMMA', False):
            self.set_role('Public', self.is_gamma_pvm)

        self.create_missing_perms()

        # commit role and view menu updates
        self.get_session.commit()
        self.clean_perms()

    def set_role(self, role_name, pvm_check):
        logging.info('Syncing {} perms'.format(role_name))
        sesh = self.get_session
        obj_regex = '^.*.\(id\:\d+\)$'
        pvms = sesh.query(ab_models.PermissionView).join(ab_models.Permission, ab_models.ViewMenu).filter(
            ab_models.Permission.name != DENIED).filter(not_(ab_models.ViewMenu.name.op('~')(obj_regex)))
        pvms = [p for p in pvms if p.permission and p.view_menu]
        role = self.add_role(role_name)
        role_pvms = [p for p in pvms if pvm_check(p)]
        role.permissions = role_pvms
        sesh.merge(role)
        sesh.commit()

    def is_admin_only(self, pvm):
        # not readonly operations on read only model views allowed only for admins
        if (pvm.view_menu.name in READ_ONLY_MODEL_VIEWS and
                pvm.permission.name not in READ_ONLY_PERMISSION):
            return True
        return (
            pvm.view_menu.name in ADMIN_ONLY_VIEW_MENUS or
            pvm.permission.name in ADMIN_ONLY_PERMISSIONS
        )

    def is_alpha_only(self, pvm):
        if (pvm.view_menu.name in GAMMA_READ_ONLY_MODEL_VIEWS and
                pvm.permission.name not in READ_ONLY_PERMISSION):
            return True
        return (
            pvm.view_menu.name in ALPHA_ONLY_VIEW_MENUS or
            pvm.permission.name in ALPHA_ONLY_PERMISSIONS
        )

    def is_admin_pvm(self, pvm):
        return not self.is_user_defined_permission(pvm)

    def is_alpha_pvm(self, pvm):
        return not (self.is_user_defined_permission(pvm) or self.is_admin_only(pvm))

    def is_gamma_pvm(self, pvm):
        return not (self.is_user_defined_permission(pvm) or self.is_admin_only(pvm) or
                    self.is_alpha_only(pvm))

    def is_sql_lab_pvm(self, pvm):
        return (
            pvm.view_menu.name in {
                'SQL Lab', 'SQL Editor', 'Query Search', 'Saved Queries',
            } or
            pvm.permission.name in {
                'can_sql_json', 'can_csv', 'can_search_queries', 'can_sqllab_viz',
                'can_sqllab',
            })

    def is_granter_pvm(self, pvm):
        return pvm.permission.name in {
            'can_override_role_permissions', 'can_approve',
        }

    def is_item_public(self, permission_name, view_name, item=None):
        """
            Check if view has public permissions

            :param permission_name:
                the permission: can_show, can_edit...
            :param view_name:
                the name of the class view (child of BaseView)
        """
        result = denied = False
        permissions = self.get_public_permissions()
        item_perm = item.get_perm() if hasattr(item, 'get_perm') else None
        if permissions:
            for permission in permissions:
                if permission.view_menu.name in (view_name, item_perm):
                    if permission.permission.name == DENIED:
                        denied = True
                    elif permission.permission.name == permission_name:
                        result = True
        return result if not denied else False

    def item_has_access(self, item, permission_str=CAN_EXPLORE, user=None, view_name=None):
        result = denied = False
        if not user:
            user = g.user

        if user.is_anonymous():
            return self.is_item_public(permission_str, view_name, item)

        for role in user.roles:
            for permission in role.permissions:
                if permission.view_menu.name in (view_name, item.get_perm()):
                    if permission.permission.name == DENIED:
                        denied = True
                    elif permission.permission.name == permission_str:
                        result = True
        return result if not denied else False

    def _has_view_access(self, user, permission_name, view_name):
        roles = user.roles
        for role in roles:
            for permission in role.permissions:
                if permission.view_menu.name == view_name:
                    if permission.permission.name == DENIED:
                        return False
                    elif permission.permission.name == permission_name:
                        return True
        return False

    def add_permissions_menu(self, view_menu_name):
        super().add_permissions_menu(view_menu_name)
        pv = self.find_permission_view_menu(DENIED, view_menu_name)
        if not pv:
            self.add_permission_view_menu(DENIED, view_menu_name)

    def get_user_by_id(self, pk):
        """
            Override of the get_user_by_id method. Adds lazy roles load
            with eager permissions load, so when roles is accessed, all
            of the permissions loads at once.
        """
        return (
            self.get_session
            .query(self.user_model)
            .options(
                lazyload('roles')
                .joinedload('permissions')
                .subqueryload('view_menu'),
                lazyload('roles')
                .joinedload('permissions')
                .subqueryload('permission'),
            )
            .get(pk)
        )
