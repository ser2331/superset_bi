from flask_appbuilder.fields import QuerySelectMultipleField
from flask_appbuilder.fieldwidgets import Select2ManyWidget
from flask_appbuilder.security.views import UserDBModelView, RoleModelView, \
    UserStatsChartView
from flask_appbuilder.widgets import ShowWidget
from flask_babel import lazy_gettext

from superset.sec_models import CustomUser
from superset.utils import set_available_default_obj_perms, get_scope_table, \
    log_this

from flask_appbuilder import expose, has_access


class LoggerMixin:
    """Примесь, добавляющаяя логгирование основных действий с моделью."""

    @expose('/show/<pk>', methods=['GET'])
    @has_access
    @log_this
    def show(self, pk):
        return super().show(pk)

    @expose('/add', methods=['GET', 'POST'])
    @has_access
    @log_this
    def add(self):
        return super().add()

    @log_this
    @expose('/edit/<pk>', methods=['GET', 'POST'])
    @has_access
    def edit(self, pk):
        return super().edit(pk)

    @expose('/delete/<pk>')
    @has_access
    @log_this
    def delete(self, pk):
        return super().delete(pk)

scope_fld_name = CustomUser.scope.key


def get_scope_field_query():
    """
    Возвращает записи из таблицы МО для поля Область видимости
    """
    from superset import db, conf
    scope_table = get_scope_table()
    id_column = label_column = None
    for column in scope_table.columns:
        if column.name == conf.get('MO_ID_COLUMN'):
            id_column = column
        elif column.name == conf.get('MO_LABEL_COLUMN'):
            label_column = column
    cols = (id_column, label_column)

    if id_column is None or label_column is None:
        return db.session.query(scope_table).filter(False)
    return db.session.query(*cols).all()


class SupersetShowWidget(ShowWidget):
    template = 'superset/fab_overrides/show.html'


class SupersetUserDBModelView(LoggerMixin, UserDBModelView):
    show_widget = SupersetShowWidget

    def __init__(self, **kwargs):
        from superset import conf
        if not conf.get('MO_TABLE'):
            self.add_exclude_columns = [scope_fld_name]
            self.edit_exclude_columns = [scope_fld_name]
            self.search_exclude_columns = [scope_fld_name]
            super().__init__(**kwargs)
            return
        self.add_columns.append(scope_fld_name)
        self.edit_columns.append(scope_fld_name)
        self.search_exclude_columns = [scope_fld_name]
        self.label_columns.update({
            scope_fld_name: lazy_gettext(scope_fld_name.capitalize())})
        scope_field = QuerySelectMultipleField(
                label=lazy_gettext(scope_fld_name.capitalize()),
                description=lazy_gettext(
                    'The list of specified values will be applied to '
                    'all queries (in tables that have a filter key defined), '
                    'limiting the data scope to the user. '
                    'Does not apply to users with the Admin role'
                ),
                allow_blank=True,
                query_func=get_scope_field_query,
                get_pk_func=lambda res: res[0],
                get_label=lambda res: res[1],
                widget=Select2ManyWidget(),
        )
        scope_fld = {scope_fld_name: scope_field}
        if self.add_form_extra_fields:
            self.add_form_extra_fields.update(scope_fld)
        else:
            self.add_form_extra_fields = scope_fld
        if self.edit_form_extra_fields:
            self.edit_form_extra_fields.update(scope_fld)
        else:
            self.edit_form_extra_fields = scope_fld
        super().__init__(**kwargs)

    def _get_edit_widget(self, form, exclude_cols=None, widgets=None):
        from superset import conf
        if not conf.get('MO_TABLE'):
            return super()._get_edit_widget(form, exclude_cols, widgets)
        scope_ids = [s[0] for s in form.scope.data] if form.scope.data else []
        scopes = [s for s in get_scope_field_query() if s[0] in scope_ids]
        form.scope.data = scopes
        widgets = super()._get_edit_widget(form, exclude_cols, widgets)
        return widgets


class CustomRoleModelView(LoggerMixin, RoleModelView):
    add_exclude_columns = edit_exclude_columns = ('user',)
    label_columns = {'name': lazy_gettext('Name'), 'permissions': lazy_gettext('Permissions'), 'custom_user': lazy_gettext('User')}

    """Переопределяем методы, чтобы добавить в поля дефолтных прав объекта, доступные для этого объекта права.
    """
    def prefill_form(self, form, pk, obj_type=None, obj_id=None):
        set_available_default_obj_perms(form)

    def _add(self):
        widget = super()._add()
        if widget:
            form = widget['add'].template_args['form']
            set_available_default_obj_perms(form)
        return widget


class CustomUserStatsChartView(UserStatsChartView):
    search_exclude_columns = [scope_fld_name]
