import React from 'react';
import PropTypes from 'prop-types';
import VirtualizedSelect from 'react-virtualized-select';
import getRenderedSize from 'react-rendered-size';
import shortid from 'shortid';
import Select from 'react-select';

const propTypes = {
    valueKey: PropTypes.string,
    valueRenderer: PropTypes.func,
    optionRenderer: PropTypes.func,
    marginLeftOption: PropTypes.number,
    symbolOptionLength: PropTypes.number,
    rowOptionHeight: PropTypes.number,
    marginRowOption: PropTypes.number,
    defaultHeight: PropTypes.number,
};

const defaultProps = {
    marginLeftOption: 55,
    symbolOptionLength: 7.8,
    rowOptionHeight: 20,
    marginRowOption: 15,
    defaultHeight: 35,
};

export default class VirtualizedSelectDecorator extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            key: shortid.generate(),
        };

        this.optionHeight = this.optionHeight.bind(this);
        this.updateComponent = this.updateComponent.bind(this);
    }

    componentDidMount() {
        window.addEventListener('resize', this.updateComponent);
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.updateComponent);
    }

    updateComponent() {
        this.setState({
            key: shortid.generate(),
        });
    }

    optionHeight({option}) {
        const {
            optionRenderer,
            defaultHeight,
            marginRowOption,
        } = this.props;
        const {width: widthContainer} = (this.container && 'getBoundingClientRect' in this.container) ? this.container.getBoundingClientRect() : {width: 0};
        if (!widthContainer) {
            return defaultHeight;
        }
        const {height} = getRenderedSize(optionRenderer({option}), widthContainer);
        return defaultHeight > height ? defaultHeight : (height + marginRowOption);
    }

    render() {
        const {key} = this.state;
        return (
            <div
                ref={(ref) => {
                    this.container = ref;
                }}
            >
                <VirtualizedSelect
                    {...this.props}
                    optionHeight={this.optionHeight}
                    key={key}
                    selectComponent={Select}
                />
            </div>
        );
    }
}

VirtualizedSelectDecorator.propTypes = propTypes;
VirtualizedSelectDecorator.defaultProps = defaultProps;
