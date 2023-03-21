import React from 'react';
import PropTypes from 'prop-types';
import Button from '../../components/Button';

const propTypes = {
    onClick: PropTypes.func,
    collapsed: PropTypes.bool,
    style: PropTypes.object,
};

export default function CollapseButton({
                                           onClick,
                                           collapsed,
                                           style,
                                       }) {
    return (
        <Button onClick={onClick} className={`btn-collapse${collapsed ? ' btn-collapsed' : ''}`} style={style}>
            {collapsed ? <i className="fa fa-angle-double-right"/> : <i className="fa fa-angle-double-left"/>}
        </Button>
    );
}

CollapseButton.propTypes = propTypes;
