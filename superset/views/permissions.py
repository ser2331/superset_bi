from functools import partial

from flask_appbuilder import expose
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.widgets import ListWidget
from flask_babel import lazy_gettext as _

from superset import appbuilder
from superset.sec_models import CustomRole
from superset.utils import has_access
from superset.views.base import SupersetModelView


class PermissionListWidget(ListWidget):
    template = 'superset/fab_overrides/perm_list.html'


class PermissionsInlineView(SupersetModelView):
    datamodel = SQLAInterface(CustomRole)
    list_columns = ['name', 'permissions']
    label_columns = {
        'name': _('Name'),
        'table': _('Table'),
    }
    base_order = ('name', 'desc')

    list_title = _('List object permissions')
    show_title = _('Show object permissions')
    edit_title = _('Edit object permissions')
    edit_columns = ('permissions',)

    list_widget = PermissionListWidget

    def _get_rel_item(self, obj_type, obj_id):
        from .constants import OBJ_TYPE_MODELVIEW_REL
        rel_view = OBJ_TYPE_MODELVIEW_REL[obj_type]
        return rel_view.datamodel.get(obj_id)

    def _get_list_widget(self, filters,
                         actions=None,
                         order_column='',
                         order_direction='',
                         page=None,
                         page_size=None,
                         widgets=None,
                         **args):
        """Передаем в шаблон тип id объекта к которому привязан инлайн.
        В шаблоне эти данные добавляются к ссылке на редактирование.
        """
        self.list_widget = partial(
            self.list_widget,
            rel_item_type=self.rel_item.__class__.__name__.lower(),
            rel_item_id=self.rel_item.id
        )
        widgets = super()._get_list_widget(
            filters, actions, order_column, order_direction,
            page, page_size, widgets, **args
        )
        value_columns = list(widgets['list'].template_args['value_columns'])

        # Фильтруем списки прав роли от разрешений не связанных с данным объектом
        for val in value_columns:
            perms = val['permissions']
            val['permissions'] = [
                perm for perm in perms if perm.view_menu.name == self.rel_item.get_perm()
            ]
        widgets['list'].template_args['value_columns'] = value_columns
        return widgets

    @expose('/edit/<pk>/<obj_type>/<obj_id>', methods=['GET', 'POST'])
    @has_access
    def perm_edit(self, pk, obj_type, obj_id):
        pk = self._deserialize_pk_if_composite(pk)
        widgets = self._edit(pk, obj_type, obj_id)
        if not widgets:
            return self.post_edit_redirect()
        else:
            return self.render_template(self.edit_template,
                                        title=self.edit_title,
                                        widgets=widgets,
                                        related_views=self._related_views)

    def _edit(self, pk, obj_type, obj_id):
        """Добавляем к форме инлайна объект, к которому этот инлайн относится."""
        self.prefill_form = partial(
            self.prefill_form,
            obj_type=obj_type,
            obj_id=obj_id
        )
        self.edit_form.rel_item = dict(obj_type=obj_type, obj_id=obj_id)
        return super()._edit(pk)

    def prefill_form(self, form, pk, obj_type=None, obj_id=None):
        """Фильтруем права оставляя только те, которые принадлежат объекту."""
        rel_item = self._get_rel_item(obj_type, obj_id)
        form.data['permissions'] = list(
            filter(lambda pv: pv.view_menu.name == rel_item.get_perm(),
                   form.data['permissions']))
        form.permissions._object_list = [(pv.id, pv) for pv in
            filter(lambda pv: pv.view_menu.name == rel_item.get_perm(),
                   form.permissions.query_func())]

    def process_form(self, form, is_created):
        """Добавляем недостающие пермишен-вью для роли."""
        role = self.datamodel.get(form._id)
        rel_item = self._get_rel_item(*form.rel_item.values())
        role_pv = [perm for perm in role.permissions if perm.view_menu.name != rel_item.get_perm()]
        pv_list = list(set(role_pv + form.data['permissions']))
        form.data['permissions'] = pv_list
        form._fields['permissions'].data = pv_list


appbuilder.add_view_no_menu(PermissionsInlineView)


class PermissionMixin:
    """
    Добавляет в представление модели инлайн с редактированием прав объекта.
    """
    def __init__(self, **kwargs):
        if type(self.related_views) is list:
            self.related_views.append(PermissionsInlineView)
        else:
            self.related_views = [PermissionsInlineView]
        super().__init__(**kwargs)

    def _get_related_view_widget(self, item, related_view,
                                 order_column='', order_direction='',
                                 page=None, page_size=None):
        """Переопределяем метод, чтобы избавится от привязки инлайна к объекту.
        Также добавляем к инстансу PermissionsInlineView объеккт, к которому он относится.
        """
        if isinstance(related_view, PermissionsInlineView):
            related_view.rel_item = item
            filters = related_view.datamodel.get_filters()
            return related_view._get_view_widget(filters=filters,
                                                 order_column=order_column,
                                                 order_direction=order_direction,
                                                 page=page,
                                                 page_size=page_size)
        return super()._get_related_view_widget(item, related_view,
                                                order_column, order_direction,
                                                page, page_size)

