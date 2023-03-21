from flask_appbuilder import Model
from flask_appbuilder.security.sqla.models import Role, assoc_user_role, User
from sqlalchemy import Table, Column, Integer, ForeignKey, Sequence, \
    UniqueConstraint
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship


assoc_def_permission_slice_role = Table(
    'ab_def_pv_slice_role', Model.metadata,
    Column('id', Integer, Sequence('ab_def_pv_slice_role_id_seq'), primary_key=True),
    Column('permission_id', Integer, ForeignKey('ab_permission.id')),
    Column('role_id', Integer, ForeignKey('ab_role.id')),
    UniqueConstraint('permission_id', 'role_id')
)

assoc_def_permission_dashboard_role = Table(
    'ab_def_pv_dashboard_role', Model.metadata,
    Column('id', Integer, Sequence('ab_def_pv_dashboard_role_id_seq'), primary_key=True),
    Column('permission_id', Integer, ForeignKey('ab_permission.id')),
    Column('role_id', Integer, ForeignKey('ab_role.id')),
    UniqueConstraint('permission_id', 'role_id')
)

assoc_def_permission_table_role = Table(
    'ab_def_pv_table_role', Model.metadata,
    Column('id', Integer, Sequence('ab_def_pv_table_role_id_seq'), primary_key=True),
    Column('permission_id', Integer, ForeignKey('ab_permission.id')),
    Column('role_id', Integer, ForeignKey('ab_role.id')),
    UniqueConstraint('permission_id', 'role_id')
)

assoc_def_permission_database_role = Table(
    'ab_def_pv_database_role', Model.metadata,
    Column('id', Integer, Sequence('ab_def_pv_database_role_id_seq'), primary_key=True),
    Column('permission_id', Integer, ForeignKey('ab_permission.id')),
    Column('role_id', Integer, ForeignKey('ab_role.id')),
    UniqueConstraint('permission_id', 'role_id')
)


class CustomRole(Role):
    __tablename__ = 'ab_role'
    slice_default_permissions = relationship('Permission',
                               secondary=assoc_def_permission_slice_role,
                               backref='role_slice_default_perm')
    dashboard_default_permissions = relationship('Permission',
                               secondary=assoc_def_permission_dashboard_role,
                               backref='role_dashboard_default_perm')
    sqlatable_default_permissions = relationship('Permission',
                               secondary=assoc_def_permission_table_role,
                               backref='role_table_default_perm')
    database_default_permissions = relationship('Permission',
                               secondary=assoc_def_permission_database_role,
                               backref='role_database_default_perm')

    def get_default_permissions(self, obj):
        """Возвращает дефолтные права для объектов"""
        obj_name = obj.__class__.__name__.lower()
        return getattr(self, '{}_default_permissions'.format(obj_name), [])


class CustomUser(User):
    roles = relationship('CustomRole', secondary=assoc_user_role, backref='custom_user')
    scope = Column(JSON)

    @property
    def repr_roles(self) -> str:
        """ Возвращает перечень ролей пользователя """
        return ', '.join([f'<{role.id}|{role.name}>' for role in self.roles])

    @property
    def scope_guids(self) -> list:
        """ Возвращает GUID ограничивающих область видимости данных"""
        return [s[0] for s in self.scope] if self.scope else []
