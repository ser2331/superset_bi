# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import json
import os
import subprocess

from setuptools import find_packages, setup

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
PACKAGE_DIR = os.path.join(BASE_DIR, 'superset', 'static', 'assets')
PACKAGE_FILE = os.path.join(PACKAGE_DIR, 'package.json')
GIT_INFO = os.path.join(PACKAGE_DIR, 'git_info')
GIT_SHA = ''
version_string = ''

try:
    with open(PACKAGE_FILE) as package_file:
        version_string = json.load(package_file)['version']
except FileNotFoundError:
    version_string = 'package.json not found'

try:
    with open(GIT_INFO) as git_info_file:
        GIT_SHA = git_info_file.readline()
except FileNotFoundError:
    try:
        s = str(subprocess.check_output(['git', 'rev-parse', 'HEAD']).strip())
        GIT_SHA = s.strip('b').strip("'")
    except:
        GIT_SHA = 'git info not found'

version_info = {
    'GIT_SHA': GIT_SHA,
    'version': version_string,
}
print('-==-' * 15)
print('VERSION: ' + version_string)
print('GIT SHA: ' + GIT_SHA)
print('-==-' * 15)

with open(os.path.join(PACKAGE_DIR, 'version_info.json'), 'w') as version_file:
    json.dump(version_info, version_file)


setup(
    name='superset',
    description=(
        'A interactive data visualization platform build on SqlAlchemy '
        'and druid.io'),
    version=version_string,
    packages=find_packages(),
    include_package_data=True,
    zip_safe=False,
    scripts=['superset/bin/superset'],
    install_requires=[
        'bleach',
        'boto3>=1.4.6',
        'celery',
        'colorama',
        'cryptography',
        'flask',
        'flask-appbuilder',
        'flask-cache',
        'flask-compress',
        'flask-migrate',
        'flask-script',
        'flask-sqlalchemy',
        'flask-testing',
        'flask-wtf',
        'flower',  # deprecated
        'future>=0.16.0, <0.17',
        'geopy',
        'gunicorn',  # deprecated
        'humanize',
        'idna',
        'markdown',
        'pandas',
        'parsedatetime',
        'pathlib2',
        'polyline',
        'pydruid',
        'pyhive>=0.4.0',
        'python-dateutil',
        'python-geohash',
        'pyyaml>=3.11',
        'requests',
        'simplejson',
        'six',
        'sqlalchemy',
        'sqlalchemy-utils',
        'sqlparse',
        'thrift>=0.9.3',
        'thrift-sasl>=0.2.1',
        'unicodecsv',
        'unidecode>=0.04.21',
    ],
    extras_require={
        'cors': ['flask-cors>=2.0.0'],
    },
    author='Maxime Beauchemin',
    author_email='maximebeauchemin@gmail.com',
    url='https://github.com/apache/incubator-superset',
    download_url=(
        'https://github.com'
        '/apache/incubator-superset/tarball/' + version_string
    ),
    classifiers=[
        'Programming Language :: Python :: 2.7',
        'Programming Language :: Python :: 3.4',
        'Programming Language :: Python :: 3.5',
    ],
)
