# -*- coding: utf-8 -*-
"""Unit tests for Superset with caching"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import json

import sqlalchemy as sqla
from mock import patch

from superset import cache, db, utils
import superset.models.core as models
from tests.base_tests import SupersetTestCase


class CacheTests(SupersetTestCase):

    def __init__(self, *args, **kwargs):
        super(CacheTests, self).__init__(*args, **kwargs)

    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    @patch('superset.models.core.Database.get_sqla_engine')
    def test_cache_value(self, _mock):
        database = db.session.query(models.Database).first()
        _mock.return_value = sqla.create_engine(database.sqlalchemy_uri_decrypted)
        self.login(username='test_user')
        slc = self.get_slice('Girls', db.session)

        json_endpoint = (
            '/superset/explore_json/{}/{}/'
            .format(slc.datasource_type, slc.datasource_id)
        )
        resp = self.get_json_resp(
            json_endpoint, {'form_data': json.dumps(slc.viz.form_data)})
        resp_from_cache = self.get_json_resp(
            json_endpoint, {'form_data': json.dumps(slc.viz.form_data)})
        self.assertFalse(resp['is_cached'])
        self.assertTrue(resp_from_cache['is_cached'])
        self.assertEqual(resp_from_cache['status'], utils.QueryStatus.SUCCESS)
        self.assertEqual(resp['data'], resp_from_cache['data'])
        self.assertEqual(resp['query'], resp_from_cache['query'])
