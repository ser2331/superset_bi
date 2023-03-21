from superset.connectors.sqla.views import TableModelView
from superset.views.core import DashboardModelView, SliceModelView
from superset.views.core import DatabaseView

OBJ_TYPE_MODELVIEW_REL = {
    'slice': SliceModelView,
    'dashboard': DashboardModelView,
    'sqlatable': TableModelView,
    'database':  DatabaseView
}
