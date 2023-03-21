import * as shortid from 'shortid';
import { keywords } from '../AceEditorWrapper';

// Колхозный парсер SQL-запросов для визуального редактора JOIN'ов

// TODO: Проверить разные формы написания (с дефолтными модификаторами)
const joinTypes = [
  'LEFT INNER JOIN',
  'LEFT OUTER JOIN',
  'RIGHT INNER JOIN',
  'RIGHT OUTER JOIN',
  'FULL OUTER JOIN',
  'LEFT JOIN',
  'RIGHT JOIN',
  'FULL JOIN',
  'INNER JOIN',
].join('|');

// Массив ключевых слов SQL как они представлены в подсветке текстового редактора
const sqlKeywords = keywords.split('|');

const joinTypesRegex = new RegExp(`(${joinTypes})`, 'gi');
const newLinesRegex = /(?:\r\n|\r|\n|↵)/g;


/**
 * Возвращает новый алиас для таблицы, номер берется как количество уже назначенных алиасов + 1
 * (если занят, то увеличивает на 1 пока не найдет свободный)
 *
 * @param {array} aliases Список уже назначенных алиасов
 * @returns {string} Алиас вида "tN"
 */
export function getAliasIndex(aliases) {
  let index = aliases.length + 1;
  const indexInUse = () => aliases.find(item => item.alias === `t${index}`);
  while (indexInUse()) {
    index++;
  }
  return `t${index}`;
}

/* Преобразование SQL-запросов в модель для JOIN-редактора */

/**
 * Разбивает строку с джойнами полей двух таблиц, выявляя участвующие таблицы и назначаемые значения.
 * (назначаемым значением может быть поле таблицы либо просто значение)
 *
 * @param {string} expression 't1.field1 = t2.field1 AND t1.field2 = t2.field2 AND ...'
 */
export function parseFields(expression) {
  const fields = expression.split(/\s+AND\s+/gi);
  const result = fields.map((field) => {
    const [leftExpression = '', rightExpression = ''] = field.split(/\s+=\s+/);
    let [leftFirst = '', leftSecond = ''] = leftExpression.split('.');
    let [rightFirst = '', rightSecond = ''] = rightExpression.split('.');
    leftFirst = leftFirst.trim().toLowerCase();
    leftSecond = leftSecond.trim().toLowerCase();
    rightFirst = rightFirst.trim().toLowerCase();
    rightSecond = rightSecond.trim().toLowerCase();
    // Expression is either 'table.field' or 'value'
    const hasLeftTable = leftExpression.indexOf('.') !== -1;
    const hasRightTable = rightExpression.indexOf('.') !== -1;
    return {
      id: (leftExpression || rightExpression) ? shortid.generate() : null,
      leftTable: hasLeftTable ? leftFirst : null,
      leftValue: hasLeftTable ? leftSecond : leftFirst,
      rightTable: hasRightTable ? rightFirst : null,
      rightValue: hasRightTable ? rightSecond : rightFirst,
    };
  })
  .filter(field => field.id);
  return result;
}

/**
 * Parse table expression as alias declaration, table or alias
 * Update aliases array when alias declaration or table without provided alias
 *
 * @param {string} expression 'table as t1' OR 'table' OR 't1'
 * @param {object[]} tables Available tables
 * @param {object[]} aliases Existing aliases
 * @returns {table} aliased table
 */
function parseTableExpression(expression, tables, aliases, missing) {
  let [firstTargetPart = '', secondTargetPart = ''] = expression.split(' ');
  firstTargetPart = firstTargetPart.trim().toLowerCase();
  secondTargetPart = secondTargetPart.trim().toLowerCase();
  let name;
  let alias;
  let result;
  // alias declaration
  if (secondTargetPart && !sqlKeywords.includes(secondTargetPart.toUpperCase())) {
    name = firstTargetPart;
    alias = secondTargetPart;
    const table = tables.find(item => item.name === name);
    if (table) {
      result = { ...table, alias, id: shortid.generate() };
      if (!aliases.find(item => item.alias === alias)) {
        aliases.push(result);
      }
    } else {
      missing.push(name);
    }
    return result;
  }
  // alias
  result = aliases.find(item => item.alias === firstTargetPart);
  // table without alias (or unknown table)
  if (!result) {
    result = tables.find(item => item.name === firstTargetPart);
    alias = `t${aliases.length + 1}`; // TODO: incorrect when query has non-sequential alias declaractions
    result = result ? { ...result, alias, id: shortid.generate() } : result;
  }
  return result;
}

export function parseJoinExpression(expression, tables, aliases, basicFromTable, missing) {
  const { target: rawTarget, operation, fields: rawFields } = expression;
  const target = parseTableExpression(rawTarget, tables, aliases, missing);
  const fields = parseFields(rawFields);
  // in case we fail to detect 'from' table on field-basis,
  // let it be the table from 'SELECT * FROM basicFromTable' clause
  let from = basicFromTable;
  // table 'from' detected on field-basis: "t1.field = t2.field"
  // if 'target' table is t2 then let t1 to be a 'from' table
  // (probably not cover all cases)
  let magicField;
  if (target) {
    magicField = fields.find(field =>
      field.leftTable === target.alias || field.rightTable === target.alias);
  }
  if (magicField) {
    const fromAlias = magicField.leftTable === target.alias
      ? magicField.rightTable
      : magicField.leftTable;
    from = aliases.find(table => table.alias === fromAlias);
  }
  // When no target provided at all try to get what field left as from table
  if (!magicField && !rawTarget) {
    magicField = fields.find(field => field.leftTable);
    const fromAlias = aliases.find(table => table.alias === magicField.leftTable);
    from = fromAlias || from;
  }
  return {
    id: shortid.generate(),
    from,
    target,
    operation,
    fields,
  };
}

/**
 * Extract from/target table names, join operation type and fields expression
 *
 * @param {string} joinsQueryPart Right part of 'SELECT * FROM ...' query
 * @returns {{ from: string, target: string, fields: string, operation: string }}
 */
export function parseJoinsQueryPart(joinsQueryPart) {
  const result = [];
  const tokens = joinsQueryPart || [];
  for (let i = 0; i < tokens.length - 1; i += 2) {
    const [target = '', fields = ''] = tokens[i + 1].split(/\s+ON\s+/gi);
    result.push({
      operation: tokens[i],
      fields: fields.trim(),
      target: target.trim().toLowerCase(),
    });
  }
  return result;
}

/**
 * Parse sql query string into joins and aliases arrays for building visual join editor state
 *
 * @param {string} sql SELECT query
 * @param {Array} tables Superset tables
 * @returns {{ joins: any[], aliases: string[] }}
 */
export function parseSql(rawSql, prevTables, prevAliases) {
  try {
    const sql = rawSql.toUpperCase().replace(newLinesRegex, ' ');
    const [selectPart, ...joinsPart] = sql.split(joinTypesRegex);
    const [_, fromPart = ''] = selectPart.split(/\s+FROM\s+/gi);
    const tables = [...prevTables];
    const aliases = [...prevAliases];
    const missing = [];
    const fromTable = parseTableExpression(fromPart, tables, aliases, missing);
    const joinsExpressions = parseJoinsQueryPart(joinsPart);
    const joins = joinsExpressions.map(expression => parseJoinExpression(expression, tables, aliases, fromTable, missing));
    return { joins, aliases, missing };
  } catch (err) {
    console.warn(err);
    return { joins: [], aliases: [], missing: [] };
  }
}

/* Преобразование модели визуального JOIN-редактора в SQL-запрос */

function getJoinClauseSql(join, usedAliases, first) {
  if (!join) {
    return '';
  }

  const fromAlias = join.from && join.from.alias ? join.from.alias : `t${usedAliases.length + 1}`;
  const targetAlias = join.target && join.target.alias ? join.target.alias : `t${usedAliases.length + 1}`;

  if (usedAliases.indexOf(fromAlias) === -1) {
    usedAliases.push(fromAlias);
  }
  const aliasFirstUsed = usedAliases.indexOf(targetAlias) === -1;
  const targetClause = join.target
    ? aliasFirstUsed
      ? `${join.target.name} ${targetAlias}`
      : targetAlias
    : '';
  if (usedAliases.indexOf(targetAlias) === -1) {
    usedAliases.push(targetAlias);
  }
  const fromClause = join.from
    ? first && `${join.from.name} ${fromAlias}` || ''
    : '';
  const fields = join.fields.map(field => `${field.leftTable}.${field.leftValue} = ${field.rightTable}.${field.rightValue}`)
  .join('\n        AND ');
  return `${fromClause}\n    ${join.operation} ${targetClause}\n        ON ${fields}`;
}

export function getSql(joins) {
  if (!joins.length) {
    return '';
  }
  const usedAliases = [];
  const sql = `SELECT * FROM ${joins.map((join, index) => getJoinClauseSql(join, usedAliases, index === 0)).join('')}`;
  return sql;
}
