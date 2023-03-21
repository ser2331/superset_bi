# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals
from flask_babel import gettext as _

from flask import Markup
from flask_babel import lazy_gettext as _

from superset.exceptions import SupersetException
from superset.views.base import SupersetModelView


class DatasourceModelView(SupersetModelView):
    def pre_delete(self, obj):
        if obj.slices:
            charts_anchors = list(map(lambda x: '<li>%s</li>' % x, [o.slice_link for o in obj.slices]))

            raise SupersetException(Markup(
                _('Cannot delete a datasource that has slices attached to it.') +
                _("Here's the list of associated charts: ") +
                "<ul>%s</ul>" % ''.join(charts_anchors)
            ))
