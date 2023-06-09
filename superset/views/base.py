# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import functools
import json
import logging
import traceback
from datetime import datetime

import humanize
import yaml
from flask import abort, flash, g, get_flashed_messages, redirect, Response, \
    send_file
from flask_appbuilder import BaseView, ModelView, expose
from flask_appbuilder.actions import action
from flask_appbuilder.filemanager import uuid_originalname
from flask_appbuilder.models.sqla.filters import BaseFilter
from flask_appbuilder.widgets import ListWidget
from flask_babel import get_locale
from flask_babel import gettext as __
from flask_babel import lazy_gettext as _
from markupsafe import Markup

import superset.models.core as models
from superset import conf, security_manager, utils, app
from superset.exceptions import SupersetException
from superset.translations.utils import get_language_pack
from superset.utils import has_access

log_this = models.Log.log_this

FRONTEND_CONF_KEYS = (
    'SUPERSET_WEBSERVER_TIMEOUT',
    'ENABLE_JAVASCRIPT_CONTROLS',
)


@app.before_request
def activate_humanize_locale():
    """Устанавливает локаль для humanize"""
    locale = str(get_locale())
    try:
        humanize.activate(locale)
    except FileNotFoundError:
        humanize.deactivate()


def get_error_msg():
    if conf.get('SHOW_STACKTRACE'):
        error_msg = traceback.format_exc()
    else:
        error_msg = 'FATAL ERROR \n'
        error_msg += (
            'Stacktrace is hidden. Change the SHOW_STACKTRACE '
            'configuration setting to enable it')
    return error_msg


def json_error_response(msg=None, status=500, stacktrace=None, payload=None):
    if not payload:
        payload = {'error': str(msg)}
        if stacktrace:
            payload['stacktrace'] = stacktrace
    return Response(
        json.dumps(payload, default=utils.json_iso_dttm_ser),
        status=status, mimetype='application/json')


def generate_download_headers(extension, filename=None):
    filename = filename if filename else datetime.now().strftime('%Y%m%d_%H%M%S')
    content_disp = 'attachment; filename={}.{}'.format(filename, extension)
    headers = {
        'Content-Disposition': content_disp,
    }
    return headers


def api(f):
    """
    A decorator to label an endpoint as an API. Catches uncaught exceptions and
    return the response in the JSON format
    """
    def wraps(self, *args, **kwargs):
        try:
            return f(self, *args, **kwargs)
        except Exception as e:
            logging.exception(e)
            return json_error_response(get_error_msg())

    return functools.update_wrapper(wraps, f)


def get_datasource_exist_error_mgs(full_name):
    return __('Datasource %(name)s already exists', name=full_name)


def get_user_roles():
    if g.user.is_anonymous():
        public_role = conf.get('AUTH_ROLE_PUBLIC')
        return [security_manager.find_role(public_role)] if public_role else []
    return g.user.roles


class BaseSupersetView(BaseView):
    def common_bootsrap_payload(self):
        """Common data always sent to the client"""
        messages = get_flashed_messages(with_categories=True)
        locale = str(get_locale())
        return {
            'flash_messages': messages,
            'conf': {k: conf.get(k) for k in FRONTEND_CONF_KEYS},
            'locale': locale,
            'language_pack': get_language_pack(locale),
        }


class SupersetListWidget(ListWidget):
    template = 'superset/fab_overrides/list.html'


class SupersetModelView(ModelView):
    page_size = 100
    list_widget = SupersetListWidget

    """
    --------------------------------
            LIST
    --------------------------------
    """

    @expose('/list/')
    @has_access
    def list(self):

        widgets = self._list()
        return self.render_template(self.list_template,
                                    title=self.list_title,
                                    widgets=widgets)

    """
    --------------------------------
            SHOW
    --------------------------------
    """
    
    @log_this
    @expose('/show/<pk>', methods=['GET'])
    @has_access
    def show(self, pk):
        pk = self._deserialize_pk_if_composite(pk)
        widgets = self._show(pk)
        return self.render_template(self.show_template,
                                    pk=pk,
                                    title=self.show_title,
                                    widgets=widgets,
                                    related_views=self._related_views)

    """
    ---------------------------
            ADD
    ---------------------------
    """

    @log_this
    @expose('/add', methods=['GET', 'POST'])
    @has_access
    def add(self):
        widget = self._add()
        if not widget:
            return self.post_add_redirect()
        else:
            return self.render_template(self.add_template,
                                        title=self.add_title,
                                        widgets=widget)

    """
    ---------------------------
            EDIT
    ---------------------------
    """

    @log_this
    @expose('/edit/<pk>', methods=['GET', 'POST'])
    @has_access
    def edit(self, pk):
        pk = self._deserialize_pk_if_composite(pk)
        widgets = self._edit(pk)
        if not widgets:
            return self.post_edit_redirect()
        else:
            return self.render_template(self.edit_template,
                                        title=self.edit_title,
                                        widgets=widgets,
                                        related_views=self._related_views)

    """
    ---------------------------
            DELETE
    ---------------------------
    """
    @log_this
    @expose('/delete/<pk>')
    @has_access
    def delete(self, pk):
        pk = self._deserialize_pk_if_composite(pk)
        self._delete(pk)
        return self.post_delete_redirect()

    @expose('/download/<string:filename>')
    @has_access
    def download(self, filename):
        return send_file(self.appbuilder.app.config['UPLOAD_FOLDER'] + filename,
                         attachment_filename=uuid_originalname(filename),
                         as_attachment=True)

    @log_this
    @expose('/action_post', methods=['POST'])
    def action_post(self):
        return super().action_post()

class ListWidgetWithCheckboxes(ListWidget):
    """An alternative to list view that renders Boolean fields as checkboxes

    Works in conjunction with the `checkbox` view."""
    template = 'superset/fab_overrides/list_with_checkboxes.html'

class ListWidgetWithCheckboxesAndPerms(ListWidget):
    """An alternative to list view that renders Boolean fields as checkboxes
    and check perms for actions in template

    Works in conjunction with the `checkbox` view."""
    template = 'superset/fab_overrides/list_with_checkboxes_and_perms.html'

class ListWidgetWithPerms(ListWidget):
    """
    Add checking perms for actions in template
    """
    template = 'superset/fab_overrides/list_with_perms.html'

def validate_json(form, field):  # noqa
    try:
        json.loads(field.data)
    except Exception as e:
        logging.exception(e)
        raise Exception(_("json isn't valid"))


class YamlExportMixin(object):
    @action('yaml_export', __('Export to YAML'), __('Export to YAML?'), 'fa-download')
    @has_access
    def yaml_export(self, items):
        if not isinstance(items, list):
            items = [items]

        data = [t.export_to_dict() for t in items]
        return Response(
            yaml.safe_dump(data),
            headers=generate_download_headers('yaml'),
            mimetype='application/text')


class DeleteMixin(object):
    def _delete(self, pk):
        """
            Delete function logic, override to implement diferent logic
            deletes the record with primary_key = pk

            :param pk:
                record primary key to delete
        """
        item = self.datamodel.get(pk, self._base_filters)
        if not item:
            abort(404)
        try:
            self.pre_delete(item)
        except Exception as e:
            flash(str(e), 'danger')
        else:
            view_menu = security_manager.find_view_menu(item.get_perm())
            pvs = security_manager.get_session.query(
                security_manager.permissionview_model).filter_by(
                view_menu=view_menu).all()

            schema_view_menu = None
            if hasattr(item, 'schema_perm'):
                schema_view_menu = security_manager.find_view_menu(item.schema_perm)

                pvs.extend(security_manager.get_session.query(
                    security_manager.permissionview_model).filter_by(
                    view_menu=schema_view_menu).all())

            if self.datamodel.delete(item):
                self.post_delete(item)

                for pv in pvs:
                    security_manager.get_session.delete(pv)

                if view_menu:
                    security_manager.get_session.delete(view_menu)

                if schema_view_menu:
                    security_manager.get_session.delete(schema_view_menu)

                security_manager.get_session.commit()

            flash(*self.datamodel.message)
            self.update_redirect()

    @action(
        'muldelete',
        __('Delete'),
        __('Delete all Really?'),
        'fa-trash',
        single=False,
    )
    def muldelete(self, items):
        if not items:
            abort(404)
        for item in items:
            try:
                self.pre_delete(item)
            except Exception as e:
                flash(str(e), 'danger')
            else:
                self._delete(item.id)
        self.update_redirect()
        return redirect(self.get_redirect())


class SupersetFilter(BaseFilter):

    """Add utility function to make BaseFilter easy and fast

    These utility function exist in the SecurityManager, but would do
    a database round trip at every check. Here we cache the role objects
    to be able to make multiple checks but query the db only once
    """

    def get_user_roles(self):
        return get_user_roles()

    def get_all_permissions(self):
        """Returns a set of tuples with the perm name and view menu name"""
        perms = set()
        for role in self.get_user_roles():
            for perm_view in role.permissions:
                t = (perm_view.permission.name, perm_view.view_menu.name)
                perms.add(t)
        return perms

    def has_role(self, role_name_or_list):
        """Whether the user has this role name"""
        if not isinstance(role_name_or_list, list):
            role_name_or_list = [role_name_or_list]
        return any(
            [r.name in role_name_or_list for r in self.get_user_roles()])

    def has_perm(self, permission_name, view_menu_name):
        """Whether the user has this perm"""
        return (permission_name, view_menu_name) in self.get_all_permissions()

    def get_view_menus(self, permission_name):
        """Returns the details of view_menus for a perm name"""
        vm = set()
        for perm_name, vm_name in self.get_all_permissions():
            if perm_name == permission_name:
                vm.add(vm_name)
        return vm

    def has_all_datasource_access(self):
        return (
            self.has_role(['Admin', 'Alpha']) or
            self.has_perm('all_datasource_access', 'all_datasource_access'))


class DatasourceFilter(SupersetFilter):
    def apply(self, query, func):  # noqa
        if self.has_all_datasource_access():
            return query
        perms = self.get_view_menus('datasource_access')
        # TODO(bogdan): add `schema_access` support here
        return query.filter(self.model.perm.in_(perms))


class CsvResponse(Response):
    """
    Override Response to take into account csv encoding from config.py
    """
    charset = conf.get('CSV_EXPORT').get('encoding', 'utf-8')


class UsedInSliceObjectMixin(object):
    """ Для объектов, используемых в отчетах """
    def pre_delete(self, item):
        if hasattr(item, 'pre_delete') and callable(item.pre_delete):
            item.pre_delete()


class UsedInTableObjectMixin(object):
    """ Для объектов, используемых в витринах """
    def pre_delete(self, item):
        tables = set(item.get_tables() + [m.table for m in item.get_metrics()])
        if tables:
            charts_anchors = [f'<li>{x.link}</li>' for x in tables]

            raise SupersetException(Markup(
                _('Cannot delete an object that has tables attached to it.')
                + ' '
                + _("Here's the list of associated tables:")
                + "<ul>%s</ul>" % ''.join(charts_anchors)
            ))
