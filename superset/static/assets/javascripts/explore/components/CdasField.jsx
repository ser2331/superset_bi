import React from 'react';
import PropTypes from 'prop-types';
import { FormControl, InputGroup } from 'react-bootstrap';

import Button from '../../components/Button';
import { t } from '../../locales';

const propTypes = {
  actions: PropTypes.object.isRequired,
  formData: PropTypes.object,
};

class CdasField extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      cdas: '',
      isLoading: false,
    };
  }

  cdasChanged(event) {
    this.setState({ cdas: event.target.value });
  }

  createChartAs() {
    const { cdas } = this.state;
    const { saveAsDatasource } = this.props.actions;
    const { formData } = this.props;
    if (formData && saveAsDatasource) {
      this.setState({ isLoading: true });
      saveAsDatasource({ form_data: formData, table_name: cdas }).then(() => {
        this.setState({ cdas: '', isLoading: false });
      }).catch(() => {
        this.setState({ isLoading: false });
      });
    }
  }

  render() {
    const { cdas, isLoading } = this.state;
    return (
      <InputGroup>
        <FormControl
          type="text"
          bsSize="small"
          className="input-sm"
          placeholder={t('new chart name')}
          onChange={this.cdasChanged.bind(this)}
          value={cdas}
          disabled={isLoading}
        />
        <InputGroup.Button>
          <Button
            bsSize="small"
            disabled={!cdas || isLoading}
            onClick={this.createChartAs.bind(this)}
            tooltip={t('Create new Chart based on the current')}
          >
            <i className="fa fa-plus" /> {t('create a ')}
          </Button>
        </InputGroup.Button>
      </InputGroup>
    );
  }
}

CdasField.propTypes = propTypes;

export default CdasField;
