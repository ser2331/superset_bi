# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import json
from collections import defaultdict

from flask import request
from flask_appbuilder import expose
from flask_babel import lazy_gettext
from sqlalchemy import asc

from superset import db, security_manager
from superset.constants import CAN_ADD
from superset.models.core import Slice, Dashboard, SliceFolders, \
    DashboardFolders
from .base import api, log_this
from ..utils import has_access

SLICE_TYPE = Slice.__name__.lower()
DASHBOARD_TYPE = Dashboard.__name__.lower()
ROOT_FOLDER_ID = '#-#'


class FoldersApiMixin:
    """Класс предоставляющий API для работы с папками."""

    def _get_slices_by_perm(self, query):
        from superset.views.core import SliceFilter, SliceModelView
        column_name = 'id'
        slice_filter = SliceFilter(column_name, SliceModelView.datamodel)
        return slice_filter.apply(query, SliceModelView)

    def _get_dashboards_by_perm(self, query):
        from superset.views.core import DashboardFilter, DashboardModelView
        column_name = 'slice'
        dashboard_filter = DashboardFilter(column_name, DashboardModelView.datamodel)
        return dashboard_filter.apply(query, DashboardModelView)

    @api
    @expose('/get_datasources_folders/<object_type>/', methods=['GET'])
    def get_datasources_folders(self, object_type: str):
        if object_type == SLICE_TYPE:
            slice_filter = self._get_slices_by_perm(db.session.query(Slice))
            objects = slice_filter.values(
                Slice.id,
                Slice.slice_name,
                Slice.datasource_name,
                Slice.datasource_id
            )
        else:
            return self.json_response(None)

        folders = {object_type: defaultdict(list)}
        datasources = {}
        for object_id, object_name, datasource_name, datasource_id in objects:
            folders[object_type][datasource_id].append((object_id, object_name))
            datasources[datasource_id] = datasource_name

        result = []
        for folder_id, slices in folders[object_type].items():
            result.append({
                'id': folder_id,
                'name': datasources[folder_id],
                'parent_id': None,
                'slices': slices,
            })
        result.append({
            'id': ROOT_FOLDER_ID,
            'name': str(lazy_gettext('Slices')),
            'parent_id': None,
            'slices': [],
        })

        return self.json_response(result)


    @api
    @expose('/folders/<object_type>/', methods=['GET'])
    def get_folders(self, object_type: str):
        if object_type == SLICE_TYPE:
            def folder_to_json(folder):
                return {
                    'id': folder.id,
                    'name': folder.name,
                    'parent_id': folder.parent_id,
                    'slices': [
                        (slice.id, slice.slice_name) for slice in folder.objects
                        if slice.id in available_slices
                    ]
                }

            slice_filter = self._get_slices_by_perm(db.session.query(Slice))
            available_slices = [slice_id for (slice_id,) in slice_filter.values(Slice.id)]
            result = db.session.query(SliceFolders).all()

        elif object_type == DASHBOARD_TYPE:
            def folder_to_json(folder):
                return {
                    'id': folder.id,
                    'name': folder.name,
                    'parent_id': folder.parent_id,
                    'dashboards': [
                        (dash.id, dash.dashboard_title) for dash in folder.objects
                        if dash.id in available_dashboards
                    ]
                }

            dashboard_filter = self._get_dashboards_by_perm(db.session.query(Dashboard))
            available_dashboards = [dash_id for (dash_id,) in dashboard_filter.values(Dashboard.id)]
            result = db.session.query(DashboardFolders).all()
        else:
            return self.json_response(None)

        response = []
        for folder in result:
            response.append(folder_to_json(folder))

        # собираем все объекты без папки в одну "виртуальную"
        response.append({
            'id': ROOT_FOLDER_ID,
            'name': str(
                lazy_gettext('Slices') if object_type == SLICE_TYPE else
                lazy_gettext('Dashboards')),
            'parent_id': None,
            f'{object_type}s': [],
        })

        return self.json_response(response)

    @log_this
    @api
    @expose('/folders/<type>/', methods=['POST'])
    @expose('/folders/<type>/<object_id>/', methods=['PUT', 'DELETE'])
    def edit_folders(self, type: str, object_id=None):
        if type == SLICE_TYPE:
            folder_model = SliceFolders
            objects_model = Slice
        elif type == DASHBOARD_TYPE:
            folder_model = DashboardFolders
            objects_model = Dashboard
        else:
            return self.json_response(None)

        if request.method == 'DELETE':
            folder = db.session.query(folder_model).get(object_id)
            db.session.delete(folder)
            db.session.commit()
            return self.json_response(True)

        data = request.get_json()
        if data.get('parent_id') == ROOT_FOLDER_ID:
            data['parent_id'] = None

        if request.method == 'POST':
            objects = db.session.query(objects_model).filter(
                objects_model.id.in_(data.get('object_ids', []))).all()
            db.session.add(
                folder_model(
                    name=data['name'],
                    parent_id=data.get('parent_id', None),
                    objects=objects,
                )
            )
            db.session.commit()
            return self.json_response(True)
        elif request.method == 'PUT':
            folder = db.session.query(folder_model).get(int(object_id))
            if 'object_ids' in data.keys():
                objects = db.session.query(objects_model).filter(
                    objects_model.id.in_(data.get('object_ids', []))).all()
                folder.objects = objects
            if 'name' in data.keys():
                folder.name = data['name']
            if 'parent_id' in data.keys():
                folder.parent_id = data['parent_id']
            db.session.merge(folder)
            db.session.commit()
            return self.json_response(True)

    @log_this
    @api
    @expose('/folders/move/<object_type>/<object_id>/', methods=['PUT'])
    def move_object_to_folder(self, object_type: str, object_id=None):

        if object_type == SLICE_TYPE:
            objects_model = Slice
        elif object_type == DASHBOARD_TYPE:
            objects_model = Dashboard
        else:
            return self.json_response(None)

        data = request.get_json()
        if data.get('folder_id') == ROOT_FOLDER_ID:
            data['folder_id'] = None

        obj = db.session.query(objects_model).get(object_id)
        obj.folder_id = data.get('folder_id') or None

        db.session.commit()

        return self.json_response(True)


class FoldersMixin:
    folder_model = None

    @expose('/list/')
    @has_access
    def list(self):
        widgets = self._list()
        object_type = self.endpoint[:self.endpoint.find('ModelView')].lower()
        bootstrap_data = json.dumps({
            'common': self.common_bootsrap_payload(),
            'has_change_perm': security_manager.can_access(
                CAN_ADD, self.__class__.__name__),
        })
        parent_folders = []
        filters = self._filters.filters
        values = self._filters.values
        for idx, filter in enumerate(filters):
            if filter.column_name == 'folder_id':
                folder_id = values[idx]
                if folder_id == 'null':
                    folder_id = 0
                folder = db.session.query(self.folder_model).get(folder_id)
                if folder:
                    parent_folders = [
                    name for (name,) in folder.path_to_root(order=asc).values(
                        self.folder_model.name)]
                parent_folders.insert(
                    0, lazy_gettext(f'{object_type.capitalize()}s'))
        return self.render_template(self.list_template,
                                    title=self.list_title,
                                    widgets=widgets.copy(),
                                    bootstrap_data=bootstrap_data,
                                    folders=parent_folders,
                                    object_type=object_type,
                                    )

    def _get_edit_widget(self, form, exclude_cols=None, widgets=None):
        form.folder.blank_text = lazy_gettext(' -- Without root folder -- ')
        return super()._get_edit_widget(form, exclude_cols, widgets)

    def _get_add_widget(self, form, exclude_cols=None, widgets=None):
        form.folder.blank_text = lazy_gettext(' -- Without root folder -- ')
        return super()._get_add_widget(form, exclude_cols, widgets)
