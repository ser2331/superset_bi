import $ from 'jquery';
import styles from './exportPDFStyles';
import scripts from './exportPDFScripts';
import { convertToFileName, downloadBlobFile } from '../utils/common';
import '../../stylesheets/fonts/arial.css';

export const TYPE_CONVERT_DASHBOARD = 'dashboard';
export const TYPE_CONVERT_SLICE = 'slice';
export const TAG_NAME_CANVAS = 'CANVAS';
export const DEFAULT_IMG_FORMAT = 'image/png';
export const EXPORT_PDF_URL = '/superset/html_to_pdf/';

// для уменьшения веса html и так как не надо печатать все строки таблиц
export const REDUCE_TABLES = true;
export const MAX_COUNT_ROWS = 100;

export const canvasToPNG = (canvas, format = DEFAULT_IMG_FORMAT) => {
    const { tagName } = canvas;
    if (tagName !== TAG_NAME_CANVAS) return null;
    return canvas.toDataURL(format);
};

export const reduceTableRows = (table) => {
    table.find('tr:gt(' + (MAX_COUNT_ROWS - 1) + ')').remove();
}

export const convertForDashboardExport = (element, original) => {
    const slices = [];
    original.find('[data-slice-id]').each((index, slice) => {
        const id = $(slice).attr('id');
        const { top, left } = $(slice).offset();
        slices.push({
            id, top, left,
        });
    });

    // группируем слайсы по строкам, ориентир - одинаковый top
    const rows = {};
    slices.forEach((slice) => {
        const { top } = slice;
        if (rows[top]) {
            rows[top].push(slice);
        } else {
            rows[top] = [slice];
        }
    });

    // формируем строки
    const rowsIndex = Object.keys(rows);
    rowsIndex.sort((a, b) => parseInt(a, 10) < parseInt(b, 10) ? -1 : 1);

    const container = $('<div/>', {
        class: 'slice-grid gridster',
        id: 'grid-container',
    });

    rowsIndex.forEach((index) => {
        // сортируем по местоположению ориентируясь на left
        rows[index].sort((a, b) => a.left < b.left ? -1 : 1);
        rows[index].forEach((slice) => {
            const { id: sliceId } = slice;
            const el = $('<div/>', {
                class: 'print_row',
            }).prepend(element.find(`#${sliceId}`).css({ position: 'relative', transform: 'unset', width: 'unset' }));
            container.append(el);
        });
    });

    element.find('#grid-container').replaceWith(container);

    // удаляем высоту с контейнеров с таблицылицами
    element.find('.slice_container.pivot_table, .slice_container.pivot_table').css({ overflow: 'unset', height: 'unset' });
};

export const convertForSliceExport = (element) => {
    // уберем весь ДОМ
    const domElement = $(document.documentElement).clone();

    // формируем контейнер для слайса
    const container = $('<div/>', {
        class: 'sliceContainer',
        id: 'slice-container',
    });
    // немного откорректируем стили
    container.prepend(element.css({
        position: 'relative',
        transform: 'unset',
        width: 'unset',
        height: 'unset',
        flex: '0.5',
    }));
    // находим dashboard-container и взамен него вставляем container
    $(domElement).find('#dashboard-container, #explore-container').replaceWith(container);
    // удаляем заголовочную панель у слайса
    $(domElement).find('.chart-header').remove();
    // удаляем остальный лишние элементы на странице
    $(domElement).find('#app').nextAll().remove();
    // удаляем фиксированные стили у слайсов
    $(domElement).find('.slice_container').removeAttr('style');
    $(domElement).find('.panel-default').removeAttr('style');
    return domElement;

};

export const processTables = (element) => {
    // некоторые таблицы по разметки разнесены на 2, в одной заголоко в другой тело таблицы. Делаем из этого одну талицу
    element.find('.slice_container').each((index, sliceContainer) => {
        const tables = $(sliceContainer).find('table');
        if (tables.length === 2) {
            $(tables[1]).find('thead').replaceWith($(tables[0]).find('thead'));
            tables[0].remove();
        }
    })

    if (REDUCE_TABLES) {
        reduceTableRows(element.find('tbody'))
    }
}

export const exportHTMLTOPDF = (domElement = null, type) => new Promise((resolve, reject) => {
    if (!domElement || !$(domElement).length) return false;

    // удаляем все канвасы и меняем на img
    $(domElement).find('canvas').each((index, canvas) => {
        const img = canvasToPNG(canvas);
        const style = $(canvas).attr('style');
        const classAttr = $(canvas).attr('class');
        const width = $(canvas).attr('width');
        const height = $(canvas).attr('height');
        if (img) {
            $(canvas).replaceWith('<img src="' + img + '" style="' + style + '" class="' + classAttr + '" width="' + width + '" height="' + height + '" />');
        }
    });

    let clonedElem = $(domElement).clone();

    // преобразовываем элемент в зависимости от типа
    let title = '';
    switch (type) {
        case TYPE_CONVERT_DASHBOARD:
            convertForDashboardExport(clonedElem, $(domElement));
            title = $(clonedElem).find('head title').text();
            break;
        case TYPE_CONVERT_SLICE:
            title = $(clonedElem).find('.header input').val() || $(clonedElem).find('head title').text() || $(clonedElem).find('#slice-header input').val();
            clonedElem = convertForSliceExport(clonedElem);
            $(clonedElem).find('head title').text(title);
            break;
        default:
            break;
    }

    // удаляем скроллы если есть и некоторые стил
    $(clonedElem).find('.scrollbar-container, .dataTables_scrollBody, .dataTables_scrollHeadInner, table, thead th, .chart').removeAttr('style');
    processTables($(clonedElem));

    $(clonedElem).find('script').remove();
    $(clonedElem).find('[data-bootstrap]').removeAttr('data-bootstrap');
    $(clonedElem).find('.react-resizable-handle').remove();
    // вставляем metabase и utf
    if (!$(clonedElem).find('head').length) {
        $(clonedElem).prepend('<head></head>');
    }

    $(clonedElem).find('head').prepend('<base href="' + location.origin + '" />');
    $(clonedElem).find('head').prepend('<meta charset="UTF-8" />');
    // вставляем стили
    $(clonedElem).find('body').append(`<style>${styles}</style>`).append(`<script>${scripts}</script>`);

    // кол-во старниц или по колву .print_row или одна (для слайсов)
    const totalPages = $(clonedElem).find('.print_row').length || 1;

    const pdfParams = {
        displayHeaderFooter: true,
        footerTemplate: '<div style="margin: 0 20px; display: flex; justify-content: flex-end;width: 100%; font-size: 12px;"><span class="pageNumber"></span>/<span>' +  totalPages + '</span></div>',
        headerTemplate: '<h1 style="margin: 0 20px; width: 100%; text-align: center; font-size: 14px;" class="title"></h1>',
        pageRanges: `1-${totalPages}`,
    };
    // TODO для отладки проверка подключения шрифтов, при последкющих MP Удалить
    console.log('<html>' + $(clonedElem).html() + '</html>');
    $.ajax({
        type: 'POST',
        url: EXPORT_PDF_URL,
        data: {
            pdf_params: JSON.stringify(pdfParams),
            html_body: '<html>' + $(clonedElem).html() + '</html>',
        },
        xhrFields: {
            responseType: 'blob',
        },
        success(data, status, request) {
            const contentType = request.getResponseHeader('content-type');
            const filename = `${convertToFileName(title)}.pdf`;
            downloadBlobFile(data, filename, contentType);
            resolve(true);
        },
        error(error) {
            reject(error);
            console.log(error);
        },
    });
});
