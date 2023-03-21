import datetime
import logging
import traceback
import json

from flask_appbuilder.security.sqla.models import User
from flask.wrappers import Response

from superset import app
from superset.config import UPDATE_PENDING_QUERIES_TIME_SECONDS
from superset.utils import get_celery_app, set_cache, error_msg_from_exception
from superset.views.base import json_error_response
from superset.sql_lab import get_session

config = app.config
celery_app = get_celery_app(config)
stats_logger = app.config.get('STATS_LOGGER')


@celery_app.task
def update_invalid_queries():
    from superset.models.sql_lab import Query, QueryStatus
    expired_changed_on = datetime.datetime.now() - datetime.timedelta(
        seconds=UPDATE_PENDING_QUERIES_TIME_SECONDS
    )
    with app.app_context():
        session = get_session(True)
        queries_updated_count = session.query(Query).filter(
            Query.status == QueryStatus.PENDING,
            Query.changed_on < expired_changed_on
        ).update(
            {Query.status: QueryStatus.FAILED, Query.error_message: 'RUNTIME ERROR'},
            synchronize_session=False
        )
        logging.info(f'UPDATED {queries_updated_count} QUERIES')
        session.commit()


celery_app.add_periodic_task(UPDATE_PENDING_QUERIES_TIME_SECONDS, update_invalid_queries, name='test periodic task')


@celery_app.task()
def async_dashboard(datasource_type, datasource_id, form_data, csv, excel, query, force, user_id, query_identity):
    from superset.views.core import Superset
    try:
        with app.app_context():
            session = get_session(True)
            user = session.query(User).filter_by(id=user_id).one()
            data = Superset().generate_json(datasource_type=datasource_type,
                                                    datasource_id=datasource_id,
                                                    form_data=form_data,
                                                    csv=csv,
                                                    excel=excel,
                                                    query=query,
                                                    force=force,
                                                    user=user,
                                                    session=session,
                                                    async_mode=True)
        if isinstance(data, Response):
            data = data.data
        set_cache(query_identity, data, config.get('ASYNC_DASHBOARD_CACHE_TIMEOUT', 0))
    except Exception as e:
        set_cache(query_identity, json.dumps(dict(error=error_msg_from_exception(e))),
                  config.get('ASYNC_DASHBOARD_CACHE_TIMEOUT', 0))
        logging.exception(e)
        stats_logger.incr('error_async_dashboard')
        raise
