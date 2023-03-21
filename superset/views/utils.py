# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from collections import defaultdict

from flask import g
from flask_appbuilder.security.sqla import models as ab_models

from superset import db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.constants import SLICE_PERMISSIONS, DASHBOARD_PERMISSIONS, \
    BASE_PERMISSIONS, CAN_EXPLORE
from superset.models.core import Slice, Dashboard


def bootstrap_user_data(username=None, include_perms=False):
    if username:
        username = username
    else:
        username = g.user.username

    user = (
        db.session.query(ab_models.User)
        .filter_by(username=username)
        .one()
    )

    payload = {
        'username': user.username,
        'firstName': user.first_name,
        'lastName': user.last_name,
        'userId': user.id,
        'isActive': user.is_active(),
        'createdOn': user.created_on.isoformat(),
        'email': user.email,
    }

    if include_perms:
        roles, permissions = get_permissions(user)
        payload['roles'] = roles
        payload['permissions'] = permissions

    return payload


def get_permissions(user):
    if not user.roles:
        raise AttributeError('User object does not have roles')

    roles = {}
    permissions = defaultdict(set)
    for role in user.roles:
        perms = set()
        for perm in role.permissions:
            if perm.permission and perm.view_menu:
                perms.add(
                    (perm.permission.name, perm.view_menu.name),
                )
                if perm.permission.name in ('datasource_access',
                                            'database_access'):
                    permissions[perm.permission.name].add(perm.view_menu.name)
        roles[role.name] = [
            [perm.permission.name, perm.view_menu.name]
            for perm in role.permissions
            if perm.permission and perm.view_menu
        ]

    return roles, permissions


def create_perm(obj):
    """Создает разрешения для вновь созданных объектов."""
    name = obj.get_perm()
    security_manager.get_session.commit()
    # создаем дефолтные permission_view для каждой роли
    for role in security_manager.get_all_roles():
        for perm in role.get_default_permissions(obj):
            pv = security_manager.merge_perm(perm.name, name)
            security_manager.add_permission_role(role, pv)
    # создаем недостающие permission_view из базовых
    if isinstance(obj, Slice):
        permissions = SLICE_PERMISSIONS
    elif isinstance(obj, Dashboard):
        permissions = DASHBOARD_PERMISSIONS
    elif isinstance(obj, SqlaTable):
        permissions = BASE_PERMISSIONS + [CAN_EXPLORE]
    else:
        permissions = BASE_PERMISSIONS
    for perm in permissions:
        security_manager.merge_perm(perm, name)


def get_metric_expr(metric):
    return str(metric)
