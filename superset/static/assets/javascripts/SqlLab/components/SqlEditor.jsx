import React from 'react';
import PropTypes from 'prop-types';
import throttle from 'lodash.throttle';
import {
  Col,
  FormGroup,
  InputGroup,
  Form,
  FormControl,
  Label,
  OverlayTrigger,
  Row,
  Tooltip,
  Collapse,
  Tab,
  Tabs,
} from 'react-bootstrap';
import { Resizable } from 're-resizable';

import JoinEditor from './JoinEditor';
import Button from '../../components/Button';
import CollapseButton from './CollapseButton';
import TemplateParamsEditor from './TemplateParamsEditor';
import SouthPane from './SouthPane';
import SaveQuery from './SaveQuery';
import ShareQuery from './ShareQuery';
import Timer from '../../components/Timer';
import Hotkeys from '../../components/Hotkeys';
import SqlEditorLeftBar from './SqlEditorLeftBar';
import AceEditorWrapper from './AceEditorWrapper';
import { STATE_BSSTYLE_MAP, DEFAULT_LIMIT } from '../constants';
import RunQueryActionButton from './RunQueryActionButton';
import { t } from '../../locales';

import './SqlEditor.css';
import '../../../stylesheets/resizable.less';
import { ResultPanelDeltaSize } from './ResultSet';

export const minHeightEditor = 100;

const propTypes = {
  actions: PropTypes.object.isRequired,
  getHeight: PropTypes.func.isRequired,
  database: PropTypes.object,
  latestQuery: PropTypes.object,
  tables: PropTypes.array.isRequired,
  editorQueries: PropTypes.array.isRequired,
  dataPreviewQueries: PropTypes.array.isRequired,
  queryEditor: PropTypes.object.isRequired,
  hideLeftBar: PropTypes.bool,
  toggleLeftBar: PropTypes.func,
};

const defaultProps = {
  database: null,
  latestQuery: null,
  hideLeftBar: false,
};

class SqlEditor extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      autorun: props.queryEditor.autorun,
      ctas: '',
      sql: props.queryEditor.sql,
    };

    this.onResize = this.onResize.bind(this);
    this.onResizeEditor = this.onResizeEditor.bind(this);
    this.throttledResize = throttle(this.onResize, 250);
    this.runQuery = this.runQuery.bind(this);
    this.stopQuery = this.stopQuery.bind(this);
    this.onSqlChanged = this.onSqlChanged.bind(this);
    this.setQueryEditorSql = this.setQueryEditorSql.bind(this);
    this.saveQuery = this.saveQuery.bind(this);
    this.handleCollapseButton = this.handleCollapseButton.bind(this);
    this.onResizeResultPanel = this.onResizeResultPanel.bind(this);
  }
  componentWillMount() {
    if (this.state.autorun) {
      this.setState({ autorun: false });
      this.props.actions.queryEditorSetAutorun(this.props.queryEditor, false);
      this.startQuery();
    }
  }
  componentDidMount() {
    // TODO: Ресайз сейчас ориентируется на высоту ace-редактора, должен на высоту таб-контейнера
    this.onResize();
    window.addEventListener('resize', this.throttledResize);
  }
  componentWillReceiveProps(nextProps) {
    if (nextProps.queryEditor.sql !== this.props.queryEditor.sql) {
      this.setState({ sql: nextProps.queryEditor.sql });
    }
  }
  componentWillUnmount() {
    window.removeEventListener('resize', this.throttledResize);
  }
  onResize() {
    const height = this.sqlEditorHeight();
    // TODO: Зафиксировано до переделки расчета высоты, чтоб она опиралась на родительский таб
    const editorPaneHeight = 300; // this.props.queryEditor.height || 200;
    // TODO: Отключено до возвращения SplitContainer'а
    // const splitPaneHandlerHeight = 15;
    this.setState({
      // editorPaneHeight,
      southPaneHeight: height - editorPaneHeight, // - splitPaneHandlerHeight,
      height,
    });

    if (this.refs.ace && this.refs.ace.clientHeight) {
      this.props.actions.persistEditorHeight(
        this.props.queryEditor,
        this.refs.ace.clientHeight
      );
    }
  }
  onResizeEditor(e, direction, ref) {
    const { clientHeight } = ref;
    this.setState(
      {
        editorPaneHeight: clientHeight,
      },
      () => {
        if (this.refs.ace && this.refs.ace.clientHeight) {
          this.props.actions.persistEditorHeight(
            this.props.queryEditor,
            this.refs.ace.clientHeight
          );
        }
      }
    );
  }
  onSqlChanged(sql) {
    this.setState({ sql });
  }
  getHotkeyConfig() {
    return [
      {
        name: 'runQuery',
        key: 'ctrl+r',
        descr: t('Run query'),
        func: this.runQuery,
      },
      {
        name: 'newTab',
        key: 'ctrl+t',
        descr: t('New tab'),
        func: () => {
          this.props.actions.addQueryEditor({
            ...this.props.queryEditor,
            title: t('Untitled Query'),
            sql: '',
          });
        },
      },
      {
        name: 'stopQuery',
        key: 'ctrl+x',
        descr: t('Stop query'),
        func: this.stopQuery,
      },
    ];
  }
  onResizeResultPanel(e, direction, ref) {
    const { clientHeight } = ref;
    this.setState({
      southPaneHeight: clientHeight + ResultPanelDeltaSize,
    });
  }
  setQueryEditorSql(sql) {
    this.props.actions.queryEditorSetSql(this.props.queryEditor, sql);
  }
  runQuery() {
    this.startQuery(!this.props.database.allow_run_sync);
  }
  startQuery(runAsync = false, ctas = false) {
    const qe = this.props.queryEditor;
    const query = {
      dbId: qe.dbId,
      sql: qe.selectedText ? qe.selectedText : this.state.sql,
      sqlEditorId: qe.id,
      tab: qe.title,
      schema: qe.schema,
      tempTableName: ctas ? this.state.ctas : '',
      templateParams: qe.templateParams,
      runAsync,
      ctas,
    };

    this.props.actions.runQuery({
      ...query,
      sql: this.addLimit(query.sql),
    });
    this.props.actions.setActiveSouthPaneTab('Results');
  }
  stopQuery() {
    if (this.props.latestQuery && this.props.latestQuery.state === 'running') {
      this.props.actions.postStopQuery(this.props.latestQuery);
    }
  }
  addLimit(sql) {
    const is_select = /^select/i;
    const run_as_written = /\/\*raw_sql\*\//;
    const block_comments_re = /\/\*.*?\*\//g;
    const string_comments_re = /--.*/g;
    const clean_sql = sql
      .replaceAll(block_comments_re, '')
      .replaceAll(string_comments_re, '')
      .trim();

    if (run_as_written.test(sql)) return sql;
    if (is_select.test(clean_sql) === false) return sql;
    if (sql.toLowerCase().indexOf('limit') > -1) return sql;

    const str = `${sql} LIMIT ${DEFAULT_LIMIT}`;
    this.onSqlChanged(str);
    return str;
  }
  saveQuery(query) {
    this.props.actions.saveQuery({
      ...query,
      sql: this.addLimit(query.sql),
    });
  }
  createTableAs() {
    this.startQuery(true, true);
  }
  ctasChanged(event) {
    this.setState({ ctas: event.target.value });
  }
  sqlEditorHeight() {
    const horizontalScrollbarHeight = 25;
    return parseInt(this.props.getHeight(), 10) - horizontalScrollbarHeight;
  }
  renderEditorBottomBar(hotkeys) {
    let ctasControls;
    if (this.props.database && this.props.database.allow_ctas) {
      const ctasToolTip = t('Create table as with query results');
      ctasControls = (
        <FormGroup>
          <InputGroup>
            <FormControl
              type='text'
              bsSize='small'
              className='input-sm'
              placeholder={t('new table name')}
              onChange={this.ctasChanged.bind(this)}
            />
            <InputGroup.Button>
              <Button
                bsSize='small'
                disabled={this.state.ctas.length === 0}
                onClick={this.createTableAs.bind(this)}
                tooltip={ctasToolTip}>
                <i className='fa fa-table' /> CTAS
              </Button>
            </InputGroup.Button>
          </InputGroup>
        </FormGroup>
      );
    }
    const qe = this.props.queryEditor;
    let limitWarning = null;
    if (this.props.latestQuery && this.props.latestQuery.limit_reached) {
      const tooltip = (
        <Tooltip id='tooltip'>
          {t(
            'Query results limited to %s rows by server [%s]',
            this.props.latestQuery.rows
          )}
        </Tooltip>
      );
      limitWarning = (
        <OverlayTrigger placement='left' overlay={tooltip}>
          <Label bsStyle='warning' className='m-r-5'>
            LIMIT
          </Label>
        </OverlayTrigger>
      );
    }
    return (
      <div className='sql-toolbar clearfix flex' id='js-sql-toolbar'>
        <div className='column-left'>
          <Form inline>
            <span className='m-r-5'>
              <RunQueryActionButton
                allowAsync={
                  this.props.database
                    ? this.props.database.allow_run_async
                    : false
                }
                dbId={qe.dbId}
                queryState={
                  this.props.latestQuery && this.props.latestQuery.state
                }
                runQuery={this.runQuery}
                selectedText={qe.selectedText}
                stopQuery={this.stopQuery}
                sql={this.state.sql}
              />
            </span>
            <span className='m-r-5'>
              <SaveQuery
                defaultLabel={qe.title}
                sql={qe.sql}
                className='m-r-5'
                onSave={this.saveQuery}
                schema={qe.schema}
                dbId={qe.dbId}
              />
            </span>
            <span className='m-r-5'>
              <ShareQuery queryEditor={qe} />
            </span>
            {ctasControls}
            <span className='m-l-5'>
              <Hotkeys header={t('Hotkeys')} hotkeys={hotkeys} />
            </span>
          </Form>
        </div>
        <div className='column-right'>
          <TemplateParamsEditor
            language='json'
            onChange={(params) => {
              this.props.actions.queryEditorSetTemplateParams(qe, params);
            }}
            code={qe.templateParams}
          />
          {limitWarning}
          {this.props.latestQuery && (
            <Timer
              startTime={this.props.latestQuery.startDttm}
              endTime={this.props.latestQuery.endDttm}
              state={STATE_BSSTYLE_MAP[this.props.latestQuery.state]}
              isRunning={this.props.latestQuery.state === 'running'}
            />
          )}
        </div>
      </div>
    );
  }

  handleCollapseButton() {
    const { state, props } = this.resizableLeftBar;
    const { width } = state || {};
    const { defaultSize } = props || {};
    const { width: defaultWidth } = defaultSize || {};
    if (parseInt(defaultWidth, 10) < parseInt(width, 10)) {
      this.resizableLeftBar.updateSize({ width: defaultWidth });
    } else {
      this.props.toggleLeftBar();
      if (this.props.hideLeftBar) {
        this.resizableLeftBar.updateSize({ width: defaultWidth });
      }
    }
  }

  render() {
    const height = this.sqlEditorHeight();
    const defaultNorthHeight = this.props.queryEditor.height || 200;
    const hotkeys = this.getHotkeyConfig();
    return (
      <div
        className='SqlEditor'
        style={{
          height: height + 'px',
        }}>
        <Row style={{ display: 'flex', position: 'relative' }}>
          <Collapse in={!this.props.hideLeftBar}>
            <Resizable
              ref={(ref) => {
                this.resizableLeftBar = ref;
              }}
              className={'col-lg-3 col-md-4 col-sm-5 col-xs-6 re-resize'}
              handleClasses={{ right: 'draggable-handle right' }}
              enable={{ right: true }}
              maxWidth={'50%'}
              defaultSize={{
                width: '25%',
              }}>
              <SqlEditorLeftBar
                height={height}
                database={this.props.database}
                queryEditor={this.props.queryEditor}
                tables={this.props.tables}
                actions={this.props.actions}
              />
            </Resizable>
          </Collapse>
          <CollapseButton
            style={{ top: height / 2 }}
            collapsed={this.props.hideLeftBar}
            onClick={this.handleCollapseButton}
          />
          <Col
            xs={this.props.hideLeftBar ? 12 : 6}
            sm={this.props.hideLeftBar ? 12 : 7}
            md={this.props.hideLeftBar ? 12 : 8}
            lg={this.props.hideLeftBar ? 12 : 9}
            className='sql-editor__container'
            style={{ height: this.state.height }}>
            <div ref='ace' style={{ width: '100%' }}>
              <Tabs
                defaultActiveKey='sql-editor-tab'
                id='sql-editor-tabs'
                bsStyle='tabs'
                unmountOnExit // drop Ace Editor virtual enderer cache
              >
                <Tab eventKey='sql-editor-tab' title={t('SQL Editor')}>
                  <Resizable
                    handleClasses={{ bottom: 'draggable-handle bottom' }}
                    enable={{ bottom: true }}
                    onResizeStop={this.onResizeEditor}
                    onResize={this.onResizeEditor}
                    minHeight={minHeightEditor}>
                    <AceEditorWrapper
                      actions={this.props.actions}
                      onBlur={this.setQueryEditorSql}
                      onChange={this.onSqlChanged}
                      queryEditor={this.props.queryEditor}
                      sql={this.state.sql}
                      tables={this.props.tables}
                      height={
                        (this.state.editorPaneHeight || defaultNorthHeight) -
                        50 +
                        'px'
                      }
                      hotkeys={hotkeys}
                    />
                    {this.renderEditorBottomBar(hotkeys)}
                  </Resizable>
                </Tab>
                <Tab eventKey='join-editor-tab' title={t('JOIN Editor')}>
                  <JoinEditor
                    actions={this.props.actions}
                    tables={this.props.tables}
                    queryEditor={this.props.queryEditor}
                    onChange={this.props.actions.queryEditorSetSql}
                  />
                </Tab>
              </Tabs>
            </div>
            <div ref='south'>
              <SouthPane
                onResizeResultPanel={this.onResizeResultPanel}
                editorQueries={this.props.editorQueries}
                dataPreviewQueries={this.props.dataPreviewQueries}
                actions={this.props.actions}
                height={this.state.southPaneHeight || 0}
                tables={this.props.tables}
                queryEditor={this.props.queryEditor}
              />
            </div>
          </Col>
        </Row>
      </div>
    );
  }
}
SqlEditor.defaultProps = defaultProps;
SqlEditor.propTypes = propTypes;

export default SqlEditor;
