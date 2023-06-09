# -*- coding: utf-8 -*-
"""Unit tests for Superset"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import csv
import datetime
import doctest
import io
import json
import logging
import os
import random
import string
import unittest

import mock
import pandas as pd
import psycopg2
from six import text_type
import sqlalchemy as sqla

from superset import dataframe, db, jinja_context, security_manager, sql_lab, utils
from superset.connectors.sqla.models import SqlaTable
from superset.models import core as models
from superset.models.sql_lab import Query
from superset.views.core import DatabaseView
from tests.base_tests import SupersetTestCase


class CoreTests(SupersetTestCase):
    requires_examples = True

    def __init__(self, *args, **kwargs):
        super(CoreTests, self).__init__(*args, **kwargs)

    @classmethod
    def setUpClass(cls):
        cls.table_ids = {tbl.table_name: tbl.id for tbl in (
            db.session
                .query(SqlaTable)
                .all()
        )}

    def setUp(self):
        db.session.query(Query).delete()
        db.session.query(models.DatasourceAccessRequest).delete()
        db.session.query(models.Log).delete()

    def tearDown(self):
        db.session.query(Query).delete()

    def test_login(self):
        resp = self.get_resp(
            '/login/',
            data=dict(username='test_user', password='superset'))
        self.assertIn('Welcome', resp)

        resp = self.get_resp('/logout/', follow_redirects=True)
        self.assertIn('User confirmation needed', resp)

        resp = self.get_resp(
            '/login/',
            data=dict(username='test_user', password='wrongPassword'))
        self.assertNotIn('Welcome', resp)
        self.assertIn('User confirmation needed', resp)

    def test_welcome(self):
        self.login()
        resp = self.client.get('/superset/welcome')
        assert 'Welcome' in resp.data.decode('utf-8')

    @unittest.skip("TEMP")
    def test_slice_endpoint(self, _mock):
        self.login(username='test_user')
        slc = self.get_slice('Girls', db.session)
        resp = self.get_resp('/superset/slice/{}/'.format(slc.id))
        assert 'Time Column' in resp
        assert 'List Roles' in resp

        # Testing overrides
        resp = self.get_resp(
            '/superset/slice/{}/?standalone=true'.format(slc.id))
        assert 'List Roles' not in resp

    @unittest.skip("Wrong")
    def test_cache_key(self, _mock):
        self.login(username='test_user')
        slc = self.get_slice('Girls', db.session)

        viz = slc.viz
        qobj = viz.query_obj()
        cache_key = viz.cache_key(qobj)
        self.assertEqual(cache_key, viz.cache_key(qobj))

        qobj['groupby'] = []
        self.assertNotEqual(cache_key, viz.cache_key(qobj))

    @mock.patch('superset.models.core.Database.get_sqla_engine')
    def test_old_slice_json_endpoint(self, _mock):
        database = db.session.query(models.Database).first()
        _mock.return_value = sqla.create_engine(database.sqlalchemy_uri_decrypted)
        self.login(username='test_user')
        slc = self.get_slice('Girls', db.session)

        json_endpoint = (
            '/superset/explore_json/{}/{}/'
                .format(slc.datasource_type, slc.datasource_id)
        )
        resp = self.get_resp(json_endpoint, {'form_data': json.dumps(slc.viz.form_data)})
        assert '"Jennifer"' in resp

    @mock.patch('superset.models.core.Database.get_sqla_engine')
    def test_slice_json_endpoint(self, _mock):
        database = db.session.query(models.Database).first()
        _mock.return_value = sqla.create_engine(database.sqlalchemy_uri_decrypted)
        self.login(username='test_user')
        slc = self.get_slice('Girls', db.session)
        resp = self.get_resp(slc.explore_json_url)
        assert '"Jennifer"' in resp

    @mock.patch('superset.models.core.Database.get_sqla_engine')
    def test_old_slice_csv_endpoint(self, _mock):
        self.login(username='test_user')
        database = db.session.query(models.Database).first()
        _mock.return_value = sqla.create_engine(database.sqlalchemy_uri_decrypted)
        slc = self.get_slice('Girls', db.session)

        csv_endpoint = (
            '/superset/explore_json/{}/{}/?csv=true'
                .format(slc.datasource_type, slc.datasource_id)
        )
        resp = self.get_resp(csv_endpoint, {'form_data': json.dumps(slc.viz.form_data)})
        assert 'Jennifer;' in resp

    @unittest.skip("TEMP")
    def test_slice_csv_endpoint(self):
        self.login(username='test_user')
        slc = self.get_slice('Girls', db.session)

        csv_endpoint = '/superset/explore_json/?csv=true'
        resp = self.get_resp(
            csv_endpoint, {'form_data': json.dumps({'slice_id': slc.id})})
        assert 'Jennifer,' in resp

    def test_polygons_in_response(self):
        self.login(username='test_user')
        slc = self.get_slice('Girls', db.session)
        explore_json_endpoint = '/superset/explore/{}/{}/'.format(
            slc.datasource_type, slc.datasource_id
        )
        resp = self.get_resp(
            explore_json_endpoint,
            {'form_data': json.dumps({
                'viz_type': 'bubble_map',
                'latitude': 'LAT',
                'longitude': 'LON',
                'datasource': '5__table'})
            }
        )
        assert 'polygons' in resp

    def test_areas_in_response(self):
        self.login(username='test_user')
        slc = self.get_slice('Girls', db.session)
        explore_json_endpoint = '/superset/explore_json/{}/{}/'.format(
            slc.datasource_type, slc.datasource_id
        )
        resp = self.get_resp(
            explore_json_endpoint,
            {'form_data': json.dumps({
                'viz_type': 'bubble_map',
                'latitude': 'LAT',
                'longitude': 'LON',
                'datasource': '5__table'})
            }
        )
        assert 'areas' in resp

    def test_aggregation_by_area(self):
        self.login(username='test_user')
        slc = self.get_slice('Mapbox Long/Lat', db.session)
        aggregate_endpoint = '/superset/aggregate_by_area/{}/{}/'.format(
            slc.datasource_type, slc.datasource_id
        )
        data = {
            "datasource": "5__table",
            "viz_type": "bubble_map",
            "slice_id": slc.id,
            "latitude": "LAT",
            "longitude": "LON",
            "pointName": "STREET",
            "aggregation_by_area": True,
            "metrics": ["sum__POSTCODE"],
            "aggregates": [
                {
                    "area_name": "Фрунзенский район",
                    "center": [59.8661936, 30.392196166617133],
                    "points": [
                        {
                            "latitude": {"field": "LON", "value": -122.3912672},
                            "longitude": {"field": "LAT", "value": 37.769092799999996},
                            "pointName": {"field": "STREET", "value": "04th Street"}
                        },
                        {
                            "latitude": {"field": "LON", "value": -122.3908502},
                            "longitude": {"field": "LAT", "value": 37.769425899999995},
                            "pointName": {"field": "STREET", "value": "04th Street"}
                        },
                        {
                            "latitude": {"field": "LON", "value": -122.428577},
                            "longitude": {"field": "LAT", "value":  37.780626700000006},
                            "pointName": {"field": "STREET", "value": "Buchanan Street"}
                        }
                    ]
                },
                {
                    "area_name": "Пушкинский район",
                    "center": [59.73183785, 30.424492342066806],
                    "points": [
                        {
                             "latitude": {"field": "LON", "value": -122.42755859999998},
                             "longitude": {"field": "LAT", "value": 37.778689799999995},
                             "pointName": {"field": "STREET", "value": "Buchanan Street"}
                        },
                        {
                            "latitude": {"field": "LON", "value": -122.411202},
                            "longitude": {"field": "LAT", "value": 37.748655299999996},
                            "pointName": {"field": "STREET", "value": "Harrison Street"}
                        }
                    ]
                }
            ]
        }
        metrics = [
            [
                {"column": {"column_name": "POSTCODE"},
                 "aggregate": "SUM",
                 "label": "SUM__postcode"
                 }
            ],
            ['count'],
            [
                {"column": {"column_name": "POSTCODE"},
                 "aggregate": "AVG",
                 "label": "AVG__postcode"
                 }
            ],
            [
                {"column": {"column_name": "occupancy"},
                 "aggregate": "AVG",
                 "label": "AVG__occupancy"
                 }
            ],
            [
                {"column": {"column_name": "REGION"},
                 "aggregate": "SUM",
                 "label": "SUM__region"
                 }
            ],
        ]
        for metric in metrics:
            data['metrics'] = metric
            form_data = {'form_data': json.dumps(data)}
            resp = self.get_resp(
                aggregate_endpoint,
                form_data
            )
            if type(metric[0]) == dict:
                assert metric[0]['label'] in resp
            else:
                assert metric[0] in resp
            assert "value" in resp

    def test_admin_only_permissions(self):
        def assert_admin_permission_in(role_name, assert_func):
            role = security_manager.find_role(role_name)
            permissions = [p.permission.name for p in role.permissions]
            assert_func('can_sync_druid_source', permissions)
            assert_func('can_approve', permissions)

        assert_admin_permission_in('Admin', self.assertIn)
        assert_admin_permission_in('Alpha', self.assertNotIn)
        assert_admin_permission_in('Gamma', self.assertNotIn)

    def test_admin_only_menu_views(self):
        def assert_admin_view_menus_in(role_name, assert_func):
            role = security_manager.find_role(role_name)
            view_menus = [p.view_menu.name for p in role.permissions]
            assert_func('ResetPasswordView', view_menus)
            # assert_func('RoleModelView', view_menus)
            assert_func('Security', view_menus)
            # assert_func('UserDBModelView', view_menus)
            assert_func('SQL Lab',
                        view_menus)

        assert_admin_view_menus_in('Admin', self.assertIn)
        assert_admin_view_menus_in('Alpha', self.assertNotIn)
        assert_admin_view_menus_in('Gamma', self.assertNotIn)

    def test_save_slice(self):
        self.login(username='test_user')
        slice_name = 'Energy Sankey'
        slice_id = self.get_slice(slice_name, db.session).id
        db.session.commit()
        copy_name = 'Test Sankey Save'
        tbl_id = self.table_ids.get('energy_usage')
        new_slice_name = 'Test Sankey Overwirte'

        url = (
            '/superset/explore/table/{}/?slice_name={}&'
            'action={}&datasource_name=energy_usage')

        form_data = {
            'viz_type': 'sankey',
            'groupby': 'target',
            'metric': 'sum__value',
            'row_limit': 5000,
            'slice_id': slice_id,
        }
        # Changing name and save as a new slice
        self.get_resp(
            url.format(
                tbl_id,
                copy_name,
                'saveas',
            ),
            {'form_data': json.dumps(form_data)},
        )
        slices = db.session.query(models.Slice) \
            .filter_by(slice_name=copy_name).all()
        assert len(slices) == 1
        new_slice_id = slices[0].id

        form_data = {
            'viz_type': 'sankey',
            'groupby': 'target',
            'metric': 'sum__value',
            'row_limit': 5000,
            'slice_id': new_slice_id,
        }
        # Setting the name back to its original name by overwriting new slice
        self.get_resp(
            url.format(
                tbl_id,
                new_slice_name,
                'overwrite',
            ),
            {'form_data': json.dumps(form_data)},
        )
        slc = db.session.query(models.Slice).filter_by(id=new_slice_id).first()
        assert slc.slice_name == new_slice_name
        db.session.delete(slc)

    @mock.patch('superset.models.core.Database.get_sqla_engine')
    def test_filter_endpoint(self, _mock):
        database = db.session.query(models.Database).first()
        _mock.return_value = sqla.create_engine(database.sqlalchemy_uri_decrypted)
        self.login(username='test_user')
        slice_name = 'Energy Sankey'
        slice_id = self.get_slice(slice_name, db.session).id
        db.session.commit()
        tbl_id = self.table_ids.get('energy_usage')
        table = db.session.query(SqlaTable).filter(SqlaTable.id == tbl_id)
        table.filter_select_enabled = True
        url = (
            '/superset/filter/table/{}/target/?viz_type=sankey&groupby=source'
            '&metric=sum__value&flt_col_0=source&flt_op_0=in&flt_eq_0=&'
            'slice_id={}&datasource_name=energy_usage&'
            'datasource_id=1&datasource_type=table')

        # Changing name
        resp = self.get_resp(url.format(tbl_id, slice_id))
        assert len(resp) > 0
        assert 'Carbon Dioxide' in resp

    def test_slices(self):
        # Testing by hitting the two supported end points for all slices
        self.login(username='test_user')
        Slc = models.Slice
        urls = []
        for slc in db.session.query(Slc).all():
            urls += [
                (slc.slice_name, 'explore', slc.slice_url),
                (slc.slice_name, 'explore_json', slc.explore_json_url),
            ]
        for name, method, url in urls:
            logging.info('[{name}]/[{method}]: {url}'.format(**locals()))
            self.client.get(url)

    def test_tablemodelview_list(self):
        self.login(username='test_user')

        url = '/tablemodelview/list/'
        resp = self.get_resp(url)

        # assert that a table is listed
        table = db.session.query(SqlaTable).first()
        assert table.name in resp
        assert '/superset/explore/table/{}'.format(table.id) in resp

    def test_add_slice(self):
        self.login(username='test_user')
        url = '/slicemodelview/add'
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)

    def test_get_user_slices(self):
        self.login(username='test_user')
        userid = security_manager.find_user('test_user').id
        url = '/sliceaddview/api/read?_flt_0_created_by={}'.format(userid)
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)

    def test_slices_V2(self):
        # Add explore-v2-beta role to admin user
        # Test all slice urls as user with with explore-v2-beta role
        security_manager.add_role('explore-v2-beta')

        security_manager.add_user(
            'explore_beta', 'explore_beta', ' user', 'explore_beta@airbnb.com',
            security_manager.find_role('explore-v2-beta'),
            password='general')
        self.login(username='explore_beta', password='general')

        Slc = models.Slice
        urls = []
        for slc in db.session.query(Slc).all():
            urls += [
                (slc.slice_name, 'slice_url', slc.slice_url),
            ]
        for name, method, url in urls:
            print('[{name}]/[{method}]: {url}'.format(**locals()))
            response = self.client.get(url)

    def test_doctests(self):
        modules = [utils, models, sql_lab]
        for mod in modules:
            failed, tests = doctest.testmod(mod)
            if failed:
                raise Exception('Failed a doctest')

    def test_misc(self):
        assert self.get_resp('/health') == 'OK'
        assert self.get_resp('/healthcheck') == 'OK'
        assert self.get_resp('/ping') == 'OK'

    def test_testconn(self, username='test_user'):
        self.login(username=username)
        database = self.get_main_database(db.session)

        # validate that the endpoint works with the password-masked sqlalchemy uri
        data = json.dumps({
            'uri': database.safe_sqlalchemy_uri(),
            'name': 'main',
            'impersonate_user': False,
        })
        response = self.client.post(
            '/superset/testconn',
            data=data,
            content_type='application/json')
        assert response.status_code == 200
        assert response.headers['Content-Type'] == 'application/json'

        # validate that the endpoint works with the decrypted sqlalchemy uri
        data = json.dumps({
            'uri': database.sqlalchemy_uri_decrypted,
            'name': 'main',
            'impersonate_user': False,
        })
        response = self.client.post(
            '/superset/testconn',
            data=data,
            content_type='application/json')
        assert response.status_code == 200
        assert response.headers['Content-Type'] == 'application/json'

    def test_custom_password_store(self):
        database = self.get_main_database(db.session)
        conn_pre = sqla.engine.url.make_url(database.sqlalchemy_uri_decrypted)

        def custom_password_store(uri):
            return 'password_store_test'

        models.custom_password_store = custom_password_store
        conn = sqla.engine.url.make_url(database.sqlalchemy_uri_decrypted)
        if conn_pre.password:
            assert conn.password == 'password_store_test'
            assert conn.password != conn_pre.password
        # Disable for password store for later tests
        models.custom_password_store = None

    def test_databaseview_edit(self, username='test_user'):
        # validate that sending a password-masked uri does not over-write the decrypted
        # uri
        self.login(username=username)
        database = self.get_main_database(db.session)
        sqlalchemy_uri_decrypted = database.sqlalchemy_uri_decrypted
        url = 'databaseview/edit/{}'.format(database.id)
        data = {k: database.__getattribute__(k) for k in DatabaseView.add_columns}
        data['sqlalchemy_uri'] = database.safe_sqlalchemy_uri()
        self.client.post(url, data=data)
        database = self.get_main_database(db.session)
        self.assertEqual(sqlalchemy_uri_decrypted, database.sqlalchemy_uri_decrypted)

    @mock.patch('superset.models.core.Database.get_sqla_engine')
    def test_warm_up_cache(self, _mock):
        database = db.session.query(models.Database).first()
        _mock.return_value = sqla.create_engine(database.sqlalchemy_uri_decrypted)
        self.login('test_user')
        slc = self.get_slice('Girls', db.session)
        data = self.get_json_resp(
            '/superset/warm_up_cache?slice_id={}'.format(slc.id))
        assert data == [{'slice_id': slc.id, 'slice_name': slc.slice_name}]

        data = self.get_json_resp(
            '/superset/warm_up_cache?table_name=energy_usage&db_name=main')
        assert len(data) == 3

    def test_shortner(self):
        self.login(username='test_user')
        data = (
            '//superset/explore/table/1/?viz_type=sankey&groupby=source&'
            'groupby=target&metric=sum__value&row_limit=5000&where=&having=&'
            'flt_col_0=source&flt_op_0=in&flt_eq_0=&slice_id=78&slice_name='
            'Energy+Sankey&collapsed_fieldsets=&action=&datasource_name='
            'energy_usage&datasource_id=1&datasource_type=table&'
            'previous_viz_type=sankey'
        )
        resp = self.client.post('/r/shortner/', data=dict(data=data))
        assert '?r=' in resp.data.decode('utf-8')

    def test_kv(self):
        self.logout()
        self.login(username='test_user')

        try:
            resp = self.client.post('/kv/store/', data=dict())
        except Exception:
            self.assertRaises(TypeError)

        value = json.dumps({'data': 'this is a test'})
        resp = self.client.post('/kv/store/', data=dict(data=value))
        self.assertEqual(resp.status_code, 200)
        kv = db.session.query(models.KeyValue).first()
        kv_value = kv.value
        self.assertEqual(json.loads(value), json.loads(kv_value))

        resp = self.client.get('/kv/{}/'.format(kv.id))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(
            json.loads(value),
            json.loads(resp.data.decode('utf-8')))

        try:
            resp = self.client.get('/kv/10001/')
        except Exception:
            self.assertRaises(TypeError)

    @unittest.skip("gamma perms problems")
    def test_gamma(self, _mock):
        self.login(username='gamma')
        assert 'List Charts' in self.get_resp('/slicemodelview/list/')
        assert 'List Dashboard' in self.get_resp('/dashboardmodelview/list/')

    @mock.patch('superset.models.core.Database.get_sqla_engine')
    def test_csv_endpoint(self, _mock):
        database = db.session.query(models.Database).first()
        _mock.return_value = sqla.create_engine(database.sqlalchemy_uri_decrypted)
        self.login('test_user')
        sql = """
            SELECT first_name, last_name
            FROM ab_user
            WHERE first_name='test_user'
        """
        client_id = '{}'.format(random.getrandbits(64))[:10]
        self.run_sql(sql, client_id, raise_on_error=True)

        resp = self.get_resp('/superset/csv/{}'.format(client_id))
        data = csv.reader(io.StringIO(resp))
        expected_data = csv.reader(
            io.StringIO('\ufefffirst_name;last_name'))
        self.assertEqual(list(expected_data), list(data))
        self.logout()

    def test_extra_table_metadata(self):
        self.login('test_user')
        dbid = self.get_main_database(db.session).id
        self.get_json_resp(
            '/superset/extra_table_metadata/{dbid}/'
            'ab_permission_view/panoramix/'.format(**locals()))

    def test_process_template(self):
        maindb = self.get_main_database(db.session)
        sql = "SELECT '{{ datetime(2017, 1, 1).isoformat() }}'"
        tp = jinja_context.get_template_processor(database=maindb)
        rendered = tp.process_template(sql)
        self.assertEqual("SELECT '2017-01-01T00:00:00'", rendered)

    def test_get_template_kwarg(self):
        maindb = self.get_main_database(db.session)
        s = '{{ foo }}'
        tp = jinja_context.get_template_processor(database=maindb, foo='bar')
        rendered = tp.process_template(s)
        self.assertEqual('bar', rendered)

    def test_template_kwarg(self):
        maindb = self.get_main_database(db.session)
        s = '{{ foo }}'
        tp = jinja_context.get_template_processor(database=maindb)
        rendered = tp.process_template(s, foo='bar')
        self.assertEqual('bar', rendered)

    @mock.patch('superset.models.core.Database.get_sqla_engine')
    def test_templated_sql_json(self, _mock):
        database = db.session.query(models.Database).first()
        _mock.return_value = sqla.create_engine(database.sqlalchemy_uri_decrypted)
        self.login('test_user')
        sql = "SELECT '{{ datetime(2017, 1, 1).isoformat() }}' as test"
        data = self.run_sql(sql, 'fdaklj3ws')
        self.assertEqual(data['data'][0]['test'], '2017-01-01T00:00:00')

    @mock.patch('superset.models.core.Database.get_sqla_engine')
    def test_table_metadata(self, _mock):
        database = db.session.query(models.Database).first()
        _mock.return_value = sqla.create_engine(database.sqlalchemy_uri_decrypted)
        self.login()
        maindb = self.get_main_database(db.session)
        backend = maindb.backend
        data = self.get_json_resp(
            '/superset/table/{}/ab_user/null/'.format(maindb.id))
        self.assertEqual(data['name'], 'ab_user')
        assert len(data['columns']) > 5
        assert data.get('selectStar').startswith('SELECT')

        # Engine specific tests
        if backend in ('mysql', 'postgresql'):
            self.assertEqual(data.get('primaryKey').get('type'), 'pk')
            self.assertEqual(
                data.get('primaryKey').get('column_names')[0], 'id')
            self.assertEqual(len(data.get('foreignKeys')), 2)
            if backend == 'mysql':
                self.assertEqual(len(data.get('indexes')), 7)
            elif backend == 'postgresql':
                self.assertEqual(len(data.get('indexes')), 5)

    def test_fetch_datasource_metadata(self):
        self.login(username='test_user')
        url = (
                '/superset/fetch_datasource_metadata?' +
                'datasourceKey=1__table'
        )
        resp = self.get_json_resp(url)
        keys = [
            'name', 'filterable_cols', 'gb_cols', 'type', 'all_cols',
            'order_by_choices', 'metrics_combo', 'granularity_sqla',
            'time_grain_sqla', 'id',
        ]
        for k in keys:
            self.assertIn(k, resp.keys())

    @unittest.skip("TEMP")
    @mock.patch('superset.models.core.Database.get_sqla_engine')
    def test_user_profile(self, _mock, username='test_user'):
        database = db.session.query(models.Database).first()
        _mock.return_value = sqla.create_engine(database.sqlalchemy_uri_decrypted)
        self.login(username=username)
        slc = self.get_slice('Girls', db.session)

        # Setting some faves
        url = '/superset/favstar/Slice/{}/select/'.format(slc.id)
        resp = self.get_json_resp(url)
        self.assertEqual(resp['count'], 1)

        dash = (
            db.session
                .query(models.Dashboard)
                .filter_by(slug='births')
                .first()
        )
        url = '/superset/favstar/Dashboard/{}/select/'.format(dash.id)
        resp = self.get_json_resp(url)
        self.assertEqual(resp['count'], 1)

        userid = security_manager.find_user('test_user').id
        resp = self.get_resp('/superset/profile/admin/')
        self.assertIn('"app"', resp)
        data = self.get_json_resp('/superset/recent_activity/{}/'.format(userid))
        self.assertNotIn('message', data)
        data = self.get_json_resp('/superset/created_slices/{}/'.format(userid))
        self.assertNotIn('message', data)
        data = self.get_json_resp('/superset/created_dashboards/{}/'.format(userid))
        self.assertNotIn('message', data)
        data = self.get_json_resp('/superset/fave_slices/{}/'.format(userid))
        self.assertNotIn('message', data)
        data = self.get_json_resp('/superset/fave_dashboards/{}/'.format(userid))
        self.assertNotIn('message', data)
        data = self.get_json_resp(
            '/superset/fave_dashboards_by_username/{}/'.format(username))
        self.assertNotIn('message', data)

    def test_slice_id_is_always_logged_correctly_on_web_request(self):
        # superset/explore case
        slc = db.session.query(models.Slice).filter_by(slice_name='Girls').one()
        qry = db.session.query(models.Log).filter_by(slice_id=slc.id)
        self.get_resp(slc.slice_url, {'form_data': json.dumps(slc.viz.form_data)})
        self.assertEqual(1, qry.count())

    def test_slice_id_is_always_logged_correctly_on_ajax_request(self):
        # superset/explore_json case
        self.login(username='test_user')
        slc = db.session.query(models.Slice).filter_by(slice_name='Girls').one()
        qry = db.session.query(models.Log).filter_by(slice_id=slc.id)
        slc_url = slc.slice_url.replace('explore', 'explore_json')
        self.get_json_resp(slc_url, {'form_data': json.dumps(slc.viz.form_data)})
        self.assertEqual(1, qry.count())

    def test_slice_query_endpoint(self):
        # API endpoint for query string
        self.login(username='test_user')
        slc = self.get_slice('Girls', db.session)
        resp = self.get_resp('/superset/slice_query/{}/'.format(slc.id))
        assert 'query' in resp
        assert 'language' in resp
        self.logout()

    @unittest.skip('Wrong')
    def test_viz_get_fillna_for_columns(self):
        slc = self.get_slice('Girls', db.session)
        q = slc.viz.query_obj()
        results = slc.viz.datasource.query(q)
        fillna_columns = slc.viz.get_fillna_for_columns(results.df.columns)
        self.assertDictEqual(
            fillna_columns,
            {'name': ' NULL', 'sum__num': 0},
        )

    @mock.patch('superset.models.core.Database.get_sqla_engine')
    @unittest.skip('Need refactor')
    def test_import_csv(self, _mock):
        self.login(username='test_user')
        database = db.session.query(models.Database).first()
        _mock.return_value = sqla.create_engine(database.sqlalchemy_uri_decrypted)
        # self.login(username='test_user')
        filename = 'testCSV.csv'
        table_name = ''.join(
            random.choice(string.ascii_uppercase) for _ in range(5))

        test_file = open(filename, 'w+')
        test_file.write('a,b\n')
        test_file.write('john,1\n')
        test_file.write('paul,2\n')
        test_file.close()
        main_db_uri = (
            db.session.query(models.Database)
                .filter_by(database_name='main')
                .all()
        )

        test_file = open(filename, 'rb')
        form_data = {
            'csv_file': test_file,
            'sep': ',',
            'name': table_name,
            'con': main_db_uri[0].id,
            'if_exists': 'append',
            'index_label': 'test_label',
            'mangle_dupe_cols': False,
        }
        url = '/databaseview/list/'
        add_datasource_page = self.get_resp(url)
        assert 'Upload a CSV' in add_datasource_page

        url = '/csvtodatabaseview/form'
        form_get = self.get_resp(url)
        assert 'CSV to Database configuration' in form_get

        try:
            # ensure uploaded successfully
            form_post = self.get_resp(url, data=form_data)
            assert 'CSV file \"testCSV.csv\" uploaded to table' in form_post
        finally:
            os.remove(filename)

    def test_dataframe_timezone(self):
        tz = psycopg2.tz.FixedOffsetTimezone(offset=60, name=None)
        data = [
            (datetime.datetime(2017, 11, 18, 21, 53, 0, 219225, tzinfo=tz),),
            (datetime.datetime(2017, 11, 18, 22, 6, 30, 61810, tzinfo=tz),),
        ]
        df = dataframe.SupersetDataFrame(pd.DataFrame(data=list(data),
                                                      columns=['data']))
        data = df.data
        self.assertDictEqual(
            data[0],
            {'data': pd.Timestamp('2017-11-18 21:53:00.219225+0100', tz=tz)},
        )
        self.assertDictEqual(
            data[1],
            {'data': pd.Timestamp('2017-11-18 22:06:30.061810+0100', tz=tz)},
        )

    def test_comments_in_sqlatable_query(self):
        clean_query = "SELECT '/* val 1 */' as c1, '-- val 2' as c2 FROM tbl"
        commented_query = '/* comment 1 */' + clean_query + '-- comment 2'
        table = SqlaTable(sql=commented_query)
        rendered_query = text_type(table.get_from_clause())
        self.assertEqual(clean_query, rendered_query)

    @mock.patch('superset.models.core.Database.get_sqla_engine')
    def test_slice_url_overrides(self, _mock):
        database = db.session.query(models.Database).first()
        _mock.return_value = sqla.create_engine(database.sqlalchemy_uri_decrypted)
        # No override
        self.login(username='test_user')
        slice_name = 'Girls'
        slc = self.get_slice(slice_name, db.session)
        resp = self.get_resp(slc.explore_json_url)
        assert '"Jennifer"' in resp

        # Overriding groupby
        url = slc.get_explore_url(
            base_url='/superset/explore_json',
            overrides={'groupby': ['state']})
        resp = self.get_resp(url)
        assert '"CA"' in resp

    @mock.patch('superset.models.core.Database.get_sqla_engine')
    def test_slice_payload_no_data(self, _mock):
        database = db.session.query(models.Database).first()
        _mock.return_value = sqla.create_engine(database.sqlalchemy_uri_decrypted)
        self.login(username='test_user')
        slc = self.get_slice('Girls', db.session)

        url = slc.get_explore_url(
            base_url='/superset/explore_json',
            overrides={
                'filters': [{'col': 'state', 'op': 'in', 'val': ['N/A']}],
            },
        )

        data = self.get_json_resp(url)
        self.assertEqual(data['status'], utils.QueryStatus.SUCCESS)
        # self.assertEqual(data['error'], 'No data')

    #
    def test_slice_payload_invalid_query(self):
        self.login(username='test_user')
        slc = self.get_slice('Girls', db.session)

        url = slc.get_explore_url(
            base_url='/superset/explore_json',
            overrides={'groupby': ['N/A']},
        )

        data = self.get_json_resp(url)
        self.assertEqual(data['status'], utils.QueryStatus.FAILED)
        assert 'KeyError' in data['stacktrace']

    def test_slice_payload_viz_markdown(self):
        self.login(username='test_user')
        slc = self.get_slice('Title', db.session)

        url = slc.get_explore_url(base_url='/superset/explore_json')
        data = self.get_json_resp(url)
        self.assertEqual(data['status'], None)
        self.assertEqual(data['error'], None)


if __name__ == '__main__':
    unittest.main()
