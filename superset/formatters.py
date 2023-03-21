import html

try:
    from pandas.formats.format import HTMLFormatter
except ImportError:
    from pandas.io.formats.html import HTMLFormatter
from flask_babel import gettext as __


class ExtendedHTMLFormatter(HTMLFormatter):
    indent_delta = 2
    verbose_to_orig_indexes = []
    margins_name_indexes = []

    def __init__(self, *args, **kwargs):
        super(ExtendedHTMLFormatter, self).__init__(*args, **kwargs)
        self.last_index_values = [n for n in self.frame.index.names]
        self.margins_name = f'‹{__("All")}›'
        self.subtotal_name = f'‹{__("Subtotal")}›'

    def write_tr(self, line, indent=0, indent_delta=4, header=False,
                 align=None, tags=None, nindex_levels=0):
        if tags is None:
            tags = {}

        if align is None:
            self.write('<tr>', indent)
        else:
            self.write('<tr style="text-align: %s;">' % align, indent)
        indent += indent_delta

        index = self.fmt.tr_frame.index
        shift = len(index.names) - nindex_levels
        column_names = [self.verbose_to_orig_indexes[column_name] for column_name in self.fmt.tr_frame.index.names]
        # TODO если нужно будет использовать verbose_name использовать self.verbose_to_orig_columns
        series_names = self.fmt.tr_frame.columns.names
        series = list(self.fmt.tr_frame.columns)

        def cycle_series_indexes():
            indexes = list(range(len(series)))
            while True:
                for index in indexes:
                    yield index

        indexes = cycle_series_indexes()

        for i, s in enumerate(line):
            if i < len(index.names) - shift and not header:
                self.last_index_values[i + shift] = s

            val_tag = tags.get(i, "")

            if line[0] == self.margins_name:
                val_tag += ' data-total-row="true"'

            if header or (self.bold_rows and i < nindex_levels):
                val_tag += ' data-columns="%s"' % html.escape(','.join(column_names))
                val_tag += ' data-series-columns="%s"' % html.escape(','.join(filter(lambda v: v, series_names)))

                if s == self.margins_name and i:
                    val_tag += ' data-total="true"'
                if s == self.subtotal_name or line[0] == self.subtotal_name:
                    val_tag += ' data-subtotal="true"'

                if index is not None and i <= len(index.names) - 1:
                    val_tag += ' data-column="%s"' % html.escape(
                        self.verbose_to_orig_indexes[index.names[-nindex_levels:][i]])

                series_intersection = set(series_names).intersection(set(line))
                if series_intersection:
                    val_tag += ' data-series="%s"' % html.escape(series_intersection.pop())

                # settings previous columns values
                for column_name, column_val in zip(index.names[:i + shift], self.last_index_values):
                    val_tag += ' data-column-%s="%s"' % (html.escape(self.verbose_to_orig_indexes[column_name]),
                                                         html.escape(column_val))

                self.write_th(s, indent, tags=val_tag)
            else:
                val_tag += ' data-columns="%s"' % html.escape(','.join(column_names))
                val_tag += ' data-series-columns="%s"' % html.escape(','.join(filter(lambda v: v, series_names)))

                if i <= len(series) + len(index.names) - 1:
                    val = series[next(indexes)]

                    if isinstance(val, tuple):
                        val = val[0]

                    if val == self.margins_name:
                        val_tag += ' data-column="%s"' % html.escape(series[0][0])
                    else:
                        val_tag += ' data-column="%s"' % html.escape(val)

                if line[0] == self.subtotal_name:
                    val_tag += ' data-subtotal="true"'

                self.write_td(s, indent, tags=val_tag)

        indent -= indent_delta
        self.write('</tr>', indent)
