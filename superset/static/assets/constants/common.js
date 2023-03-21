export const SOURCE = 1; // Источник
export const TARGET = 2; // Назначение
export const COMMON = 3; // Если вершина - источник и назначение

export const dateTypes = {
    DATE: 'DATE',
    TIME: 'TIME',
    DATETIME: 'DATETIME',
    NULLABLEDATETIME: 'Nullable(DateTime)',
    NULLABLEDATE: 'Nullable(Date)',
    VARCHAR: 'VARCHAR',
};

export const dateFormats = { // Форматы даты
    [dateTypes.DATE]: 'DD-MM-YYYY', // Формат даты
    [dateTypes.TIME]: 'HH:mm:ss', // Формат даты
    [dateTypes.DATETIME]: 'DD-MM-YYYY HH:mm:ss', // Формат даты и времени
};

export const dateFormatsFilter = { // Форматы даты
    [dateTypes.DATE]: 'YYYY-MM-DD', // Формат даты
    [dateTypes.TIME]: 'HH:mm:ss', // Формат даты
    [dateTypes.DATETIME]: 'YYYY-MM-DD HH:mm:ss', // Формат даты и времени
};

export const sqlDateFormats = { // Форматы даты для sql
    [dateTypes.DATE]: 'YYYY-MM-DD',
    [dateTypes.DATETIME]: '', // формат в moment по умолчанию ISO8601
};
