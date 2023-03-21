import React from 'react';
import * as shortid from 'shortid';
import Join from './JoinEditor/Join';
import Button from '../../components/Button';
import * as sqlParser from './JoinEditor/sqlParser';
import './JoinEditor.css';
import { t } from '../../locales';

const operations = {
  LEFT_JOIN: 'LEFT JOIN',
  RIGHT_JOIN: 'RIGHT JOIN',
  FULL_OUTER_JOIN: 'FULL OUTER JOIN',
  FULL_JOIN: 'FULL JOIN',
  LEFT_OUTER_JOIN: 'LEFT OUTER JOIN',
  RIGHT_OUTER_JOIN: 'RIGHT OUTER JOIN',
  INNER_JOIN: 'INNER JOIN',
};

class JoinEditor extends React.Component {

  constructor(props) {
    super(props);
    const { joins, aliases, missing } = sqlParser.parseSql(props.queryEditor.sql, props.tables, []);
    this.state = { joins, aliases, missing };
    this.handleNew = this.handleNew.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.handleDelete = this.handleDelete.bind(this);
    this.updateSql = this.updateSql.bind(this);
  }

  componentWillMount() {
    const { actions, queryEditor } = this.props;
    if (this.state.missing.length) {
      this.state.missing.map(tableName => actions.addTable(queryEditor, tableName, queryEditor.schema));
    }
  }

  componentWillReceiveProps(nextProps) {
    const tablesChanged = nextProps.tables.find((item) => {
      const exist = this.props.tables.find(table => table.name === item.name);
      const columnsAppeared = exist && !exist.columns && !!item.columns;
      const columnsChanged = exist && exist.columns && item.columns.length !== exist.columns.length;
      return !exist || columnsAppeared || columnsChanged;
    });

    if (nextProps.queryEditor.sql !== this.props.queryEditor.sql || tablesChanged) {
      const nextAliases = this.state.aliases.map((alias) => {
        const matchingTable = nextProps.tables.find(table => table.name === alias.name);
        return matchingTable ? { ...alias, columns: matchingTable.columns } : alias;
      });
      const { joins, aliases } = sqlParser.parseSql(nextProps.queryEditor.sql, nextProps.tables, nextAliases);
      this.setState({ joins, aliases });
    }
  }

  /** Drop alias if we no longer use it */
  filterUnused(aliases, joins) {
    return aliases.filter(table => joins.find(item =>
        (item.from && item.from.alias === table.alias) ||
        (item.target && item.target.alias === table.alias)
    ));
  }

  updateSql() {
    const { joins, aliases } = this.state;
    this.props.onChange(this.props.queryEditor, sqlParser.getSql(joins, aliases));
  }

  handleNew() {
    const lastJoin = this.state.joins[this.state.joins.length - 1];
    this.setState({
      joins: [
        ...this.state.joins,
        {
          id: shortid.generate(),
          from: lastJoin ? lastJoin.target : null,
          target: null,
          operation: operations.LEFT_JOIN,
          fields: [{
            id: shortid.generate(),
            leftTable: lastJoin && lastJoin.target && lastJoin.target.alias || null,
            leftValue: '',
            rightTable: null,
            rightValue: '',
          }],
        },
      ],
    }, this.updateSql);
  }

  handleChange(join, changedProp) {
    const { aliases, joins } = this.state;
    if (changedProp === 'from' || changedProp === 'target') {
      const newAliasRequired = join[changedProp] && !join[changedProp].alias;
      const alias = newAliasRequired
        ? {
          ...join[changedProp],
          id: shortid.generate(),
          alias: sqlParser.getAliasIndex(aliases),
        } : null;
      const fields = [{
        id: shortid.generate(),
        leftTable: changedProp === 'from'
          ? alias && alias.alias || join[changedProp].alias
          : (join.from && join.from.alias || null),
        leftValue: '',
        rightTable: changedProp === 'target'
          ? alias && alias.alias || join[changedProp].alias
          : (join.target && join.target.alias || null),
        rightValue: '',
      }];
      const newAliases = alias ? [...aliases, alias] : aliases;
      const newJoins = joins.map(item => item.id === join.id
        ? {
          ...join,
          [changedProp]: alias || join[changedProp],
          fields,
        } : item
      );
      this.setState({
        aliases: this.filterUnused(newAliases, newJoins),
        joins: newJoins,
      }, this.updateSql);
      return;
    }
    this.setState({
      joins: joins.map(item => item.id === join.id ? join : item),
    }, this.updateSql);
  }

  handleDelete(join) {
    const joins = this.state.joins.filter(item => item.id !== join.id);
    const aliases = this.filterUnused(this.state.aliases, joins);
    this.setState({ joins, aliases }, this.updateSql);
  }

  render() {
    const isAddDisabled = this.state.joins.some(join => !join.from || !join.target);
    return (
      <div className="join-editor__container">
        {this.state.joins.map((join, index) => (
          <Join
            primary={index === 0}
            key={join.id}
            join={join}
            tables={this.props.tables}
            aliases={this.state.aliases}
            operations={Object.keys(operations).map(key => operations[key])}
            onChange={this.handleChange}
            onDelete={this.handleDelete}
          />
        ))}
        <Button
          bsStyle="primary"
          disabled={isAddDisabled}
          onClick={this.handleNew}
        >
          <i className="fa fa-plus" /> &nbsp; {t('ADD NEW JOIN')}
        </Button>
      </div>
    );
  }
}

export default JoinEditor;
