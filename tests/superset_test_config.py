# -*- coding: utf-8 -*-
# flake8: noqa
from superset.config import *
import os

# AUTH_USER_REGISTRATION_ROLE = 'alpha'
# SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(DATA_DIR, 'unittests.db')
# DEBUG = True
# SUPERSET_WEBSERVER_PORT = 8081
#
# # Allowing SQLALCHEMY_DATABASE_URI to be defined as an env var for
# # continuous integration
# if 'SUPERSET__SQLALCHEMY_DATABASE_URI' in os.environ:
#     SQLALCHEMY_DATABASE_URI = os.environ.get('SUPERSET__SQLALCHEMY_DATABASE_URI')
#
# SQL_CELERY_RESULTS_DB_FILE_PATH = os.path.join(DATA_DIR, 'celery_results.sqlite')
# SQL_SELECT_AS_CTA = True
# SQL_MAX_ROW = 666
#
TESTING = True
SECRET_KEY = 'thisismyscretkey'
# WTF_CSRF_ENABLED = False
# PUBLIC_ROLE_LIKE_GAMMA = True
# AUTH_ROLE_PUBLIC = 'Public'
# EMAIL_NOTIFICATIONS = False

CACHE_CONFIG = {'CACHE_TYPE': 'simple'}

SUPERSET_DATABASE_HOST = os.environ['POSTGRES_HOST']
SUPERSET_DATABASE_USER = os.environ['POSTGRES_USER']
SUPERSET_DATABASE_PASSWORD = os.environ['POSTGRES_PASSWORD']
SUPERSET_DATABASE_DB = os.environ['POSTGRES_DB']

SQLALCHEMY_DATABASE_URI = 'postgresql+psycopg2://{username}:{userpassword}@{dbhost}/{dbname}'.format(
    username=SUPERSET_DATABASE_USER,
    userpassword=SUPERSET_DATABASE_PASSWORD,
    dbhost=SUPERSET_DATABASE_HOST,
    dbname=SUPERSET_DATABASE_DB
)

# class CeleryConfig(object):
#     BROKER_URL = 'redis://localhost'
#     CELERY_IMPORTS = ('superset.sql_lab', )
#     CELERY_RESULT_BACKEND = 'db+sqlite:///' + SQL_CELERY_RESULTS_DB_FILE_PATH
#     CELERY_ANNOTATIONS = {'sql_lab.add': {'rate_limit': '10/s'}}
#     CONCURRENCY = 1
#
#
# CELERY_CONFIG = CeleryConfig
