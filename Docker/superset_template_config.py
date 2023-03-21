from werkzeug.contrib.cache import RedisCache
import os

# ---------------------------------------------------------                                                                                                                                                 
# Superset specific config                                                                                                                                                                                 
# ---------------------------------------------------------                                                                                                                                                 
ROW_LIMIT = 5000
SUPERSET_WORKERS = 4
WEBSERVER_THREADS = 8
SUPERSET_WEBSERVER_PORT = 8888
SUPERSET_WEBSERVER_TIMEOUT = 600
SQLLAB_TIMEOUT = 300
URL_TO_RENDER_PDF = os.environ.get('SUPERSET_URL_PDF', '')
SENTRY_DSN = 'http://5ad725d589364052bd298ad35a48df60@sentry.zdrav.netrika.ru/3'
# детали - N3BI-1430                                                                                                                                                                                        
MO_TABLE = 'restriction_keys'
MO_ID_COLUMN = 'id'
MO_LABEL_COLUMN = 'name'
# ---------------------------------------------------------                                                                                                                                                 

# ---------------------------------------------------------                                                                                                                                                 
# Flask App Builder configuration                                                                                                                                                                          
# ---------------------------------------------------------                                                                                                                                                 
# Your App secret key                                                                                                                                                                                      
SECRET_KEY = 'thisismyscretkey'

# The SQLAlchemy connection string to your database backend
# This connection defines the path to the database that stores your
# superset metadata (slices, connections, tables, dashboards, ...).
# Note that the connection information to connect to the datasources
# you want to explore are managed directly in the web UI
SQLALCHEMY_DATABASE_URI = 'postgresql+psycopg2://superset:superset@localhost/superset'

CSRF_ENABLED = True

# Flask-WTF flag for CSRF
WTF_CSRF_ENABLED = True

# Logging
ENABLE_TIME_ROTATE = True
TIME_ROTATE_LOG_LEVEL = 'DEBUG'
FILENAME = '/home/superset/logs/superset.log'
ROLLOVER = 'midnight'
INTERVAL = 1
BACKUP_COUNT = 10

# Translation
BABEL_DEFAULT_LOCALE = 'ru'
BABEL_DEFAULT_FOLDER = '/superset/src/superset/translations'

LANGUAGES = {
    'ru': {'flag': 'ru', 'name': 'Русский'},
    'en': {'flag': 'us', 'name': 'English'},
    'it': {'flag': 'it', 'name': 'Italian'},
}

CACHE_CONFIG = {
    'CACHE_TYPE': 'redis',
    'CACHE_DEFAULT_TIMEOUT': 86400,  # 1 day default (in secs)
    'CACHE_KEY_PREFIX': 'superset_results',
    'CACHE_REDIS_URL': 'redis://localhost:6379/2',
}


class CeleryConfig(object):
    BROKER_URL = 'redis://localhost:6379/2'
    CELERY_IMPORTS = ('superset.sql_lab',)
    CELERY_RESULT_BACKEND = 'redis://localhost:6379/2'
    CELERY_ANNOTATIONS = {'tasks.add': {'rate_limit': '10/s'}}
    CELERYD_CONCURRENCY = 1
    CELERYD_PREFETCH_MULTIPLIER = 1


CELERY_CONFIG = CeleryConfig
ASYNC_DASHBOARD_CACHE_TIMEOUT = 3600

RESULTS_BACKEND = RedisCache(host='localhost', port=6379, key_prefix='superset_results', db=2)
