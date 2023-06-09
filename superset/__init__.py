# -*- coding: utf-8 -*-
"""Package's main module!"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import json
import logging
from logging.handlers import TimedRotatingFileHandler
import os

from flask import Flask, redirect
from flask_appbuilder import AppBuilder as FABAppBuilder
from flask_appbuilder import IndexView, SQLA
from flask_appbuilder.baseviews import expose
from flask_compress import Compress
from flask_migrate import Migrate
from flask_wtf.csrf import CSRFProtect
from werkzeug.contrib.fixers import ProxyFix

from superset import config, utils
from superset.connectors.connector_registry import ConnectorRegistry
from superset.security import SupersetSecurityManager

APP_DIR = os.path.dirname(__file__)
CONFIG_MODULE = os.environ.get('SUPERSET_CONFIG', 'superset.config')

if not os.path.exists(config.DATA_DIR):
    os.makedirs(config.DATA_DIR)

with open(APP_DIR + '/static/assets/backendSync.json', 'r') as f:
    frontend_config = json.load(f)

if hasattr(config, 'SENTRY_DSN'):
    import sentry_sdk
    from sentry_sdk.integrations.flask import FlaskIntegration

    sentry_sdk.init(
        dsn=config.SENTRY_DSN,
        integrations=[FlaskIntegration()]
    )

app = Flask(__name__)
app.config.from_object(CONFIG_MODULE)
conf = app.config

if hasattr(config, 'ELASTIC_APM'):
    from elasticapm.contrib.flask import ElasticAPM
    apm = ElasticAPM(app)


#################################################################
# Handling manifest file logic at app start
#################################################################
MANIFEST_FILE = APP_DIR + '/static/assets/dist/manifest.json'
manifest = {}


def parse_manifest_json():
    global manifest
    try:
        with open(MANIFEST_FILE, "r") as f:
            # the manifest includes non-entry files
            # we only need entries in templates
            full_manifest = json.load(f)
            manifest = full_manifest.get("entrypoints", {})
    except Exception:  # pylint: disable=broad-except
        pass


def get_manifest_file(filename):
    if app.debug:
        parse_manifest_json()
    return manifest.get(filename, '')


def get_unloaded_chunks(files, loaded_chunks):
    filtered_files = [f for f in files if f not in loaded_chunks]
    for f in filtered_files:
        loaded_chunks.add(f)

    # print(filtered_files)
    return filtered_files


def get_js_manifest_files(filename):
    if app.debug:
        parse_manifest_json()
    entry_files = manifest.get(filename, {})
    return entry_files.get("js", [])


def get_css_manifest_files(filename):
    if app.debug:
        parse_manifest_json()
    entry_files = manifest.get(filename, {})
    return entry_files.get("css", [])


@app.context_processor
def get_manifest():  # pylint: disable=unused-variable
    return dict(
        loaded_chunks=set(),
        get_unloaded_chunks=get_unloaded_chunks,
        js_manifest=get_js_manifest_files,
        css_manifest=get_css_manifest_files,
    )


parse_manifest_json()

#################################################################

for bp in conf.get('BLUEPRINTS'):
    try:
        print("Registering blueprint: '{}'".format(bp.name))
        app.register_blueprint(bp)
    except Exception as e:
        print('blueprint registration failed')
        logging.exception(e)

if conf.get('SILENCE_FAB'):
    logging.getLogger('flask_appbuilder').setLevel(logging.ERROR)

if not app.debug:
    # In production mode, add log handler to sys.stderr.
    app.logger.addHandler(logging.StreamHandler())
    app.logger.setLevel(logging.INFO)
logging.getLogger('pyhive.presto').setLevel(logging.INFO)

db = SQLA(app)

if conf.get('WTF_CSRF_ENABLED'):
    csrf = CSRFProtect(app)
    csrf_exempt_list = conf.get('WTF_CSRF_EXEMPT_LIST', [])
    for ex in csrf_exempt_list:
        csrf.exempt(ex)

utils.pessimistic_connection_handling(db.engine)

cache = utils.setup_cache(app, conf.get('CACHE_CONFIG'))
tables_cache = utils.setup_cache(app, conf.get('TABLE_NAMES_CACHE_CONFIG'))

migrate = Migrate(app, db, directory=APP_DIR + '/migrations')

# Logging configuration
logging.basicConfig(format=app.config.get('LOG_FORMAT'))
logging.getLogger().setLevel(app.config.get('LOG_LEVEL'))

if app.config.get('ENABLE_TIME_ROTATE'):
    logging.getLogger().setLevel(app.config.get('TIME_ROTATE_LOG_LEVEL'))
    handler = TimedRotatingFileHandler(
        app.config.get('FILENAME'),
        when=app.config.get('ROLLOVER'),
        interval=app.config.get('INTERVAL'),
        backupCount=app.config.get('BACKUP_COUNT'))
    logging.getLogger().addHandler(handler)

if app.config.get('ENABLE_CORS'):
    from flask_cors import CORS

    CORS(app, **app.config.get('CORS_OPTIONS'))

if app.config.get('ENABLE_PROXY_FIX'):
    app.wsgi_app = ProxyFix(app.wsgi_app)

if app.config.get('ENABLE_CHUNK_ENCODING'):

    class ChunkedEncodingFix(object):
        def __init__(self, app):
            self.app = app

        def __call__(self, environ, start_response):
            # Setting wsgi.input_terminated tells werkzeug.wsgi to ignore
            # content-length and read the stream till the end.
            if environ.get('HTTP_TRANSFER_ENCODING', '').lower() == u'chunked':
                environ['wsgi.input_terminated'] = True
            return self.app(environ, start_response)


    app.wsgi_app = ChunkedEncodingFix(app.wsgi_app)

if app.config.get('UPLOAD_FOLDER'):
    try:
        os.makedirs(app.config.get('UPLOAD_FOLDER'))
    except OSError:
        pass

for middleware in app.config.get('ADDITIONAL_MIDDLEWARE'):
    app.wsgi_app = middleware(app.wsgi_app)


class MyIndexView(IndexView):
    @expose('/')
    def index(self):
        return redirect('/superset/welcome')


custom_sm = app.config.get('CUSTOM_SECURITY_MANAGER') or SupersetSecurityManager
if not issubclass(custom_sm, SupersetSecurityManager):
    raise Exception(
        """Your CUSTOM_SECURITY_MANAGER must now extend SupersetSecurityManager,
         not FAB's security manager.
         See [4565] in UPDATING.md""")


class AppBuilder(FABAppBuilder):
    """Переопределяем класс для добавления кастомного TemplateFilters."""

    def _add_global_filters(self):
        from flask_appbuilder.filters import TemplateFilters as FABTemplateFilters

        class TemplateFilters(FABTemplateFilters):
            """Переопределяем метод проверки видимости управляющих элементов
            с учетом индивидуальных разрешений объекта.
            """
            from flask_appbuilder.filters import app_template_filter
            @app_template_filter('is_item_visible')
            def is_item_visible(self, permission, item, pk=None):
                from superset.views.permissions import PermissionMixin

                if not pk:
                    return super().is_item_visible(permission, item)
                if self.security_manager.has_access(permission, item):
                    return True

                item_view_name_rel = {view.__name__: view for view in PermissionMixin.__subclasses__()}
                view = item_view_name_rel.get(item)
                if not view:
                    return self.security_manager.has_access(permission, item)
                obj = db.session.query(view.datamodel.obj).filter_by(id=pk).first()
                return self.security_manager.item_has_access(obj, permission, view_name=view.__name__)

            @app_template_filter('is_can_do_action')
            def is_can_do_action(self, permission, modelview_name, pk, request):
                from superset.connectors.sqla.views import TableColumnInlineView, SqlMetricInlineView
                from superset.connectors.sqla.models import SqlaTable

                table_id = int(''.join(c for c in request.full_path.split('/')[-1] if c.isdigit()))

                if modelview_name == TableColumnInlineView.__name__:
                    real_columns_ids = [column.id for column in SqlaTable.get_real_columns(table_id)]
                    return pk in real_columns_ids

                if modelview_name == SqlMetricInlineView.__name__:
                    real_metrics_ids = [metric.id for metric in SqlaTable.get_real_metrics(table_id)]
                    return pk in real_metrics_ids

                return True

        self.template_filters = TemplateFilters(self.get_app, self.sm)

appbuilder = AppBuilder(
    app,
    db.session,
    base_template='superset/base.html',
    indexview=MyIndexView,
    security_manager_class=custom_sm,
    update_perms=utils.get_update_perms_flag(),
)

security_manager = appbuilder.sm

results_backend = app.config.get('RESULTS_BACKEND')

# Registering sources
module_datasource_map = app.config.get('DEFAULT_MODULE_DS_MAP')
module_datasource_map.update(app.config.get('ADDITIONAL_MODULE_DS_MAP'))
ConnectorRegistry.register_sources(module_datasource_map)

# Flask-Compress
if conf.get('ENABLE_FLASK_COMPRESS'):
    Compress(app)

# Hook that provides administrators a handle on the Flask APP
# after initialization
flask_app_mutator = app.config.get('FLASK_APP_MUTATOR')
if flask_app_mutator:
    flask_app_mutator(app)

from superset import views  # noqa
