#!/bin/bash                                                                                                                                                                                                                                                                                                                                                                                                         

set -eo pipefail
                                                                                                                                                                                                           
if [ "$SUPERSET_HOME" != "/home/superset" ]; then                                                                                                                                                          
    sed -i "s#FILENAME = '/home/superset/logs/superset.log'#FILENAME = '$SUPERSET_HOME/logs/superset.log'#" "$SUPERSET_HOME"/superset_config.py                                                            
fi                                                                                                                                                                                                         
                                                                                                                                                                                                           
if [ -n "$SUPERSET_ROW_LIMIT" ]; then                                                                                                                                                                      
    sed -i "s#ROW_LIMIT = 5000#ROW_LIMIT = $SUPERSET_ROW_LIMIT#" "$SUPERSET_HOME"/superset_config.py                                                                                                       
fi                                                                                                                                                                                                         
                                                                                                                                                                                                           
if [ -n "$SUPERSET_WORKERS" ]; then                                                                                                                                                                        
    sed -i "s#SUPERSET_WORKERS = 4#SUPERSET_WORKERS = $SUPERSET_WORKERS#" "$SUPERSET_HOME"/superset_config.py                                                                                              
fi                                                                                                                                                                                                         
                                                                                                                                                                                                           
if [ -n "$SUPERSET_WEB_THREADS" ]; then                                                                                                                                                                    
    sed -i "s#WEBSERVER_THREADS = 8#WEBSERVER_THREADS = $SUPERSET_WEB_THREADS#" "$SUPERSET_HOME"/superset_config.py                                                                                        
fi                                                                                                                                                                                                         
                                                                                                                                                                                                           
if [ -n "$SUPERSET_WEB_PORT" ]; then                                                                                                                                                                       
    sed -i "s#SUPERSET_WEBSERVER_PORT = 8888#SUPERSET_WEBSERVER_PORT = $SUPERSET_WEB_PORT#" "$SUPERSET_HOME"/superset_config.py                                                                            
fi                                                                                                                                                                                                         
                                                                                                                                                                                                           
if [ -n "$REDIS_URL" ]; then                                                                                                                                                                               
    sed -i "s#redis://localhost:6379/2#$REDIS_URL#"  "$SUPERSET_HOME"/superset_config.py                                                                                                                   
fi                                                                                                                                                                                                         
                                                                                                                                                                                                           
if [ -n "$CACHE_TIMEOUT" ]; then                                                                                                                                                                           
    sed -i "s#'CACHE_DEFAULT_TIMEOUT': 86400#'CACHE_DEFAULT_TIMEOUT': $CACHE_TIMEOUT#"  "$SUPERSET_HOME"/superset_config.py                                                                                
fi                                                                                                                                                                                                         
                                                                                                                                                                                                           
if [ -n "$CACHE_KEY_PREFIX" ]; then                                                                                                                                                                        
    sed -i "s#superset_results#$CACHE_KEY_PREFIX#"  "$SUPERSET_HOME"/superset_config.py                                                                                                                    
fi                                                                                                                                                                                                         
                                                                                                                                                                                                           
if [ -n "$SUPERSET_SECRET_KEY" ]; then
    sed -i "s#SECRET_KEY = 'thisismyscretkey'#SECRET_KEY = '$SUPERSET_SECRET_KEY'#"  "$SUPERSET_HOME"/superset_config.py
fi

if [ -n "$SUPERSET_CSRF_ENABLED" ]; then
    sed -i "s#CSRF_ENABLED = True#CSRF_ENABLED = $SUPERSET_CSRF_ENABLED#"  "$SUPERSET_HOME"/superset_config.py
    sed -i "s#WTF_CSRF_ENABLED = True#WTF_CSRF_ENABLED = $SUPERSET_CSRF_ENABLED#"  "$SUPERSET_HOME"/superset_config.py
fi

if [ -n "$SUPERSET_SENTRY_DSN" ]; then
    sed -i "s#http://5ad725d589364052bd298ad35a48df60@sentry.zdrav.netrika.ru/3#$SUPERSET_SENTRY_DSN#" "$SUPERSET_HOME"/superset_config.py
fi

if [ -n "$SUPERSET_REDIS_RESULTS_BACKEND" ]; then
    sed -i "s#host='localhost', port=6379, key_prefix='superset_results', db=2#$SUPERSET_REDIS_RESULTS_BACKEND#" "$SUPERSET_HOME"/superset_config.py
fi

if [ -n "$SUPERSET_ELASTIC_APM_URL" ]; then
    echo "ELASTIC_APM = {'ELASTIC_APM_TRANSACTION_MAX_SPANS': '$SUPERSET_ELASTIC_APM_TRANSACTION_MAX_SPANS', 'SERVICE_NAME': '$SUPERSET_PUBLICATION_HOST','SERVER_URL': '$SUPERSET_ELASTIC_APM_URL', 'SPAN_FRAMES_MIN_DURATION': '$SUPERSET_APM_SPAN_FRAMES_MIN_DURATION'}" >> "$SUPERSET_HOME"/superset_config.py
fi

sed -i "s#SQLALCHEMY_DATABASE_URI = 'postgresql+psycopg2://superset:superset@localhost/superset'#SQLALCHEMY_DATABASE_URI = 'postgresql+psycopg2://$SUPERSET_POSTGRES_USER:$SUPERSET_POSTGRES_PASSWORD@$SUPERSET_POSTGRES_HOST:$SUPERSET_POSTGRES_PORT/$SUPERSET_POSTGRES_DB'#" "$SUPERSET_HOME"/superset_config.py


printenv
# Wait for Postresql
TRY_LOOP="10"
i=0
while ! nc -z $SUPERSET_POSTGRES_HOST $SUPERSET_POSTGRES_PORT >/dev/null 2>&1 < /dev/null; do
  i=$((i+1))
  echo "$(date) - waiting for ${SUPERSET_POSTGRES_HOST}:${SUPERSET_POSTGRES_PORT}... $i/$TRY_LOOP"
  if [ $i -ge $TRY_LOOP ]; then
    echo "$(date) - ${SUPERSET_POSTGRES_HOST}:${SUPERSET_POSTGRES_PORT} still not reachable, giving up"
    exit 1
  fi
  sleep 10
done

# check for existence of /docker-entrypoint.sh & run it if it does
echo "Checking for docker-entrypoint"
if [ -f /docker-entrypoint.sh ]; then
  echo "docker-entrypoint found, running"
  chmod +x /docker-entrypoint.sh
  . docker-entrypoint.sh
fi

#superset runserver
if [[ $# -eq 0 ]];
    then
        if [ ! -f $SUPERSET_HOME/logs/.setup-complete ]; then
                echo "Running first time setup for Caravel"
                echo "Creating admin user ${SUPERSET_ADMIN_USERNAME}"
                cat > $SUPERSET_HOME/admin.config <<EOF
${SUPERSET_ADMIN_USERNAME}
${SUPERSET_ADMIN_USERNAME}
${SUPERSET_ADMIN_USERNAME}
${SUPERSET_ADMIN_EMAIL}
${SUPERSET_ADMIN_PASSWORD}
${SUPERSET_ADMIN_PASSWORD}

EOF

                echo "Initializing database"
                superset db upgrade
                echo "Creating default roles and permissions"
                superset init
                /bin/sh -c '/usr/local/bin/fabmanager create-admin --app superset < $SUPERSET_HOME/admin.config'
                rm $SUPERSET_HOME/admin.config
                touch $SUPERSET_HOME/logs/.setup-complete
        else
        # always upgrade the database, running any pending migrations
                superset db upgrade
                superset init
        fi

        echo "Starting up Caravel"
        gunicorn \
              -w $SUPERSET_WEB_THREADS \
              -k gevent \
              --timeout $SUPERSET_GUNICORN_TIMEOUT \
              -b  0.0.0.0:$SUPERSET_WEB_PORT \
              --limit-request-line 0 \
              --limit-request-field_size 0 \
              --statsd-host $SUPERSET_STATSD_HOST:$SUPERSET_STATSD_PORT \
              --statsd-prefix $SUPERSET_IDENTIFIER \
              superset:app
   else
    if [[ $1 -eq 'celery' ]];
     then
        echo "Starting up Celery"
        celery worker  --app=superset.sql_lab:celery_app -l $SUPERSET_CELERY_LOG_LEVEL --pool=prefork -O fair -c $SUPERSET_CELERY_CONCURRENCY -E
    else
        echo "Starting up beat"
        celery beat  --app=superset.sql_lab:celery_app -l $SUPERSET_CELERY_LOG_LEVEL
    fi
fi
