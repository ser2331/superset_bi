//@ts-ignore
import React from 'react';
//@ts-ignore
import PropTypes from 'prop-types';
import { Button, Panel, Grid, Row, Col } from 'react-bootstrap';
import Select from 'react-virtualized-select';
import visTypes from '../explore/stores/visTypes';
import { t } from '../locales';

const propTypes = {
    datasources: PropTypes.arrayOf(PropTypes.shape({
        label: PropTypes.string.isRequired,
        value: PropTypes.string.isRequired,
    })).isRequired,
};

export class AddSliceContainer extends React.PureComponent {
  private vizTypeOptions: any;

  constructor(props: any) {
      super(props);
      const visTypeKeys = Object.keys(visTypes);
      this.vizTypeOptions = visTypeKeys.map(vt => ({ label: visTypes[vt].label, value: vt }));
    //@ts-ignore
    this.state = {
          visType: 'table',
      };
  }

  exploreUrl() {
      const loc = new URL(window.location as any);
      const formData = encodeURIComponent(
          JSON.stringify({
              //@ts-ignore
              viz_type: this.state.visType,
              //@ts-ignore
              datasource: this.state.datasourceValue,
              folder_id: loc.searchParams.get('folder_id'),
          }));
      return `/superset/explore/?form_data=${formData}`;
  }

  gotoSlice() {
      window.location.href = this.exploreUrl();
  }

  changeDatasource(e: any) {
    //@ts-ignore
    this.setState({
          datasourceValue: e.value,
          datasourceId: e.value.split('__')[0],
          datasourceType: e.value.split('__')[1],
      });
  }

  changeVisType(e: any) {
    //@ts-ignore
    this.setState({ visType: e.value });
  }

  isBtnDisabled() {
      //@ts-ignore
      return !(this.state.datasourceId && this.state.visType);
  }

  render() {
      return (
          <div className="container">
              <Panel header={<h3>{t('Create a new slice')}</h3>}>
                  <Grid>
                      <Row>
                          <Col xs={12} sm={6}>
                              <div>
                                  <p>{t('Choose a datasource')}</p>
                                  <Select
                                      clearable={false}
                                      name="select-datasource"
                                      onChange={this.changeDatasource.bind(this)}
                                      //@ts-ignore
                                      options={this.props.datasources}
                                      placeholder={t('Choose a datasource')}
                                      //@ts-ignore
                                      value={this.state.datasourceValue}
                                  />
                              </div>
                              <br />
                              <div>
                                  <p>{t('Choose a visualization type')}</p>
                                  <Select
                                      clearable={false}
                                      name="select-vis-type"
                                      onChange={this.changeVisType.bind(this)}
                                      options={this.vizTypeOptions}
                                      placeholder={t('Choose a visualization type')}
                                      //@ts-ignore
                                      value={this.state.visType}
                                  />
                              </div>
                              <br />
                              <Button
                                  bsStyle="primary"
                                  disabled={this.isBtnDisabled()}
                                  onClick={this.gotoSlice.bind(this)}
                              >
                                  {t('Create new slice')}
                              </Button>
                              <br /><br />
                          </Col>
                      </Row>
                  </Grid>
              </Panel>
          </div>
      );
  }
}
//@ts-ignore
AddSliceContainer.propTypes = propTypes;

export default AddSliceContainer;
