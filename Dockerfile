FROM python:3.6-slim-stretch

# Caravel setup options
ENV SUPERSET_VERSION=0.23 \
    SUPERSET_HOME=/home/superset \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=$SUPERSET_HOME:$PYTHONPATH

ENV LANGUAGE=en_US.UTF-8 \
    LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8 \
    LC_CTYPE=en_US.UTF-8 \
    LC_MESSAGES=en_US.UTF-8

RUN set -ex \
    && buildDeps=' \
        build-essential \
        libssl-dev \
        libffi-dev \
        libsasl2-dev \
        libldap2-dev \
        libpq-dev \
        unixodbc-dev \
        unzip \
        git \
    ' \

    && apt-get update -yqq \
    && apt-get install -yqq \
        $buildDeps \
        apt-transport-https \
        locales \
                build-essential \
                libpq5 \
                apt-utils \
                curl \
                netcat \
    && sed -i 's/^# en_US.UTF-8 UTF-8$/en_US.UTF-8 UTF-8/g' /etc/locale.gen \
    && locale-gen \
    && update-locale LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

#Install DB Drivers                                                                                                                                                                                 [31/78]
RUN mkdir -p /opt/oracle \
    && cd /opt/oracle \
    && curl https://download.oracle.com/otn_software/linux/instantclient/199000/instantclient-basic-linux.x64-19.9.0.0.0dbru.zip --output instantclient-basic-linux.x64-19.9.0.0.0dbru.zip \
    && unzip instantclient-basic-linux.x64-19.9.0.0.0dbru.zip \
    && echo /opt/oracle/instantclient_19_9 > /etc/ld.so.conf.d/oracle-instantclient.conf \
    && apt-get install -yqq libaio1 \
    && ldconfig \
    && export LD_LIBRARY_PATH=/opt/oracle/instantclient_19_9:$LD_LIBRARY_PATH \
    && curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add - \
    && curl https://packages.microsoft.com/config/debian/9/prod.list > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update -yqq \
    && ACCEPT_EULA=Y apt-get install -yqq msodbcsql17 \
    && pip install \
       pyodbc \
       cx_Oracle \
       elastic-apm[flask]


RUN pip install --no-cache-dir \
        alembic==1.5.8 \
        amqp==2.6.1 \
        asn1crypto==1.4.0 \
        attrs==20.3.0 \
        Babel==2.9.0 \
        billiard==3.5.0.5 \
        bleach==2.1.2 \
        blinker==1.4 \
        boto3==1.4.7 \
        botocore==1.7.48 \
        celery==4.1.0 \
        certifi==2020.12.5 \
        cffi==1.14.5 \
        chardet==3.0.4 \
        click==6.7 \
        colorama==0.3.9 \
        colour==0.1.5 \
        cryptography==2.4.2 \
        cx-Oracle==8.1.0 \
        defusedxml==0.7.1 \
        docutils==0.17.1 \
        elastic-apm==6.1.2 \
        et-xmlfile==1.0.1 \
        Flask==0.12.2 \
        git+https://github.com/JustOnce/Flask-AppBuilder.git@1e661b42fb700a4776afb1ddf8f5bc5f47dec635 \
        git+https://github.com/JustOnce/sqlalchemy-clickhouse.git \
        Flask-Babel==0.11.1 \
        Flask-Cache==0.13.1 \
        Flask-Compress==1.4.0 \
        Flask-Login==0.2.11 \
        Flask-Migrate==2.1.1 \
        Flask-OpenID==1.2.5 \
        Flask-Script==2.0.6 \
        Flask-SQLAlchemy==2.1 \
        Flask-Testing==0.7.1 \
        Flask-WTF==0.14.2 \
        flower==0.9.2 \
        future==0.16.0 \
        geopy==1.11.0 \
        gevent==20.9.0 \
        greenlet==1.0.0 \
        gunicorn==19.7.1 \
        html5lib==1.1 \
        humanize==0.5.1 \
        idna==2.6 \
        importlib-metadata==4.0.1 \
#        infi.clickhouse-orm==1.0.3 \
        iso8601==0.1.14 \
        itsdangerous==1.1.0 \
        jdcal==1.4.1 \
        Jinja2==2.11.3 \
        jmespath==0.10.0 \
        jsonschema==3.2.0 \
        kombu==4.1.0 \
        Mako==1.1.4 \
        Markdown==2.6.11 \
        MarkupSafe==1.1.1 \
        numpy==1.19.5 \
        mock==4.0.3 \
        openpyxl==3.0.4 \
        pandas==0.23.4 \
        parsedatetime==2.0 \
        pathlib2==2.3.0 \
        polyline==1.3.2 \
        psycopg2==2.8.6 \
        pycparser==2.20 \
        pydruid==0.4.1 \
        PyHive==0.5.0 \
        pymssql==2.1.4 \
#        pyodbc==4.0.23 \
        pyrsistent==0.17.3 \
        python-dateutil==2.6.1 \
        python-editor==1.0.4 \
        python-geohash==0.8.5 \
        python3-openid==3.2.0 \
        pytz==2021.1 \
        PyYAML==3.12 \
        redis==2.10.6 \
        requests==2.18.4 \
        s3transfer==0.1.13 \
        sasl==0.2.1 \
        sentry-sdk==0.6.9 \
        simplejson==3.13.2 \
        six==1.11.0 \
        SQLAlchemy==1.3.20 \
        sqlalchemy-mptt==0.2.5 \
        SQLAlchemy-Utils==0.32.21 \
        sqlparse==0.2.4 \
        styleframe==3.0.5 \
        thrift==0.11.0 \
        thrift-sasl==0.3.0 \
        tornado==4.2 \
        typing-extensions==3.7.4.3  \
        unicodecsv==0.14.1 \
        Unidecode==1.0.22 \
        urllib3==1.22 \
        vine==1.3.0 \
        webencodings==0.5.1 \
        Werkzeug==0.14.1 \
        WTForms==2.2.1 \
        xlrd==1.2.0 \
        zipp==3.4.1 \
        zope.event==4.5.0 \
        zope.interface==5.4.0 \
&& apt-get remove -y build-essential libssl-dev libffi-dev libsasl2-dev libldap2-dev

# Cleanup
RUN apt-get purge --auto-remove -yqq $buildDeps \
    && apt-get clean \
    && rm -rf \
        /var/lib/apt/lists/* \
        /tmp/* \
        /var/tmp/* \
        /usr/share/man

# install from local
RUN mkdir -p $SUPERSET_HOME/src

COPY Docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

COPY Docker/superset_template_config.py $SUPERSET_HOME/

#cleanup
RUN \
    apt-get purge --auto-remove -yqq $buildDeps \
    && apt-get clean \
    && rm -rf \
        /var/lib/apt/lists/* \
        /tmp/* \
        /var/tmp/* \
        /usr/share/man \

