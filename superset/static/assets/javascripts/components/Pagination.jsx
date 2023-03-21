import React from 'react';
import PropTypes from 'prop-types';

const styleList = {
  display: 'inline-block',
  paddingLeft: 0,
  margin: '25px 0 20px 0',
  borderRadius: '2px',
  float: 'right',
};

const styleListItem = {
  display: 'inline-block',
};

const styleButton = {
  position: 'relative',
  float: 'left',
  background: 'transparent',
  outline: 'none',
  color: '#00A699',
  border: '1px solid #DDD',
  marginBottom: '10px',
  minWidth: '38px',
  height: '40px',
  paddingLeft: '6px',
  paddingRight: '6px',
};

const styleActiveButton = {
  fontWeight: 'bold',
  color: 'black',
};

const styleRestButton = {
  cursor: 'auto',
};

const Page = ({ index, selected, onClick }) => {
  const isRest = index === 'left' || index === 'right';
  return (
    <li style={styleListItem}>
      <button
        className='btn-pagination'
        style={{
          ...styleButton,
          ...(selected ? styleActiveButton : {}),
          ...(isRest ? styleRestButton : {}),
        }}
        onClick={isRest ? () => {} : () => onClick(index)}
      >
        {isRest && '...'}
        {!isRest && index}
      </button>
    </li>
  );
};

const SimplePaging = ({ pages, selectedPage, showNext, onClick }) => {
  return (
    <ul style={styleList}>
      {new Array(pages).fill(0).map((page, index) => (
        <Page
          key={index + 1}
          index={index + 1}
          selected={index + 1 === selectedPage}
          onClick={onClick}
        />
      ))}
      {showNext && (
        <Page key='>' index='>' onClick={() => onClick(selectedPage + 1)} />
      )}
    </ul>
  );
};

const LargePaging = ({ pages, selectedPage, onClick }) => {
  const showPages = 5;
  const range = [];
  // (1) 2 3 4 5 ... 1000;
  if (selectedPage < 4) {
    range.push(1, 2, 3, 4, 5, 'left', pages);
  }
  // 1 2 3 (4) 5 6 ... 1000
  if (selectedPage === 4) {
    range.push(1, 2, 3, 4, 5, 6, 'left', pages);
  }
  // 1 ... 10 11 (12) 13 14 ... 1000
  if (selectedPage > 4 && selectedPage < pages - Math.ceil(showPages / 2)) {
    range.push(1, 'left');
    for (let i = 0; i < showPages; i++) {
      range.push(selectedPage - Math.floor(showPages / 2) + i);
    }
    range.push('right', pages);
  }
  // 1 ... 995 996 (997) 998 999 1000
  if (selectedPage >= pages - Math.ceil(showPages / 2)) {
    range.push(1, 'left');
    for (let i = 0; i < showPages; i++) {
      range.push(pages - showPages + i);
    }
    range.push(pages);
  }
  return (
    <ul style={styleList}>
      {range.map((page) => (
        <Page
          key={page}
          index={page}
          selected={page === selectedPage}
          onClick={onClick}
        />
      ))}
    </ul>
  );
};

export default class Pagination extends React.Component {
  constructor(props) {
    super(props);
    this.handlePageClick = this.handlePageClick.bind(this);
  }

  /**
   * Пагинация встраивается в оригинальную цепочку компонентов суперсета:
   * Реактовсий узел -> джейкверька-html -> Реактовский узел пагинатора
   * Т.к. реактовские узлы разделены между собой обычным html, вся логика по
   * контролю высоты которая есть в верхнем узле не принимает во внимание
   * высоту пагинатора, содержимое которого рендерится после того как отрендерится
   * джейкверька-html.
   * Поэтому пагинатор считает свою высоту и на ее изменение/при монтировании
   * дергает протянутый в него коллбэк, вызывающий пересчет высоты в Chart.jsx
   * с учетом получившейся высоты пагинатора.
   */
  componentDidMount() {
    if (this.container && !!this.container.firstChild) {
      const height = this.getHeight(this.container.firstChild);
      this.props.onHeightChange(height);
    }
  }

  componentDidUpdate(prevProps) {
    const pageChanged =
      prevProps.pageLength !== this.props.pageLength ||
      prevProps.pageOffset !== this.props.pageOffset;
    if (this.container && pageChanged && !!this.container.firstChild) {
      const height = this.getHeight(this.container.firstChild);
      this.props.onHeightChange(height);
    }
  }

  getHeight(ul) {
    const height =
      Number.parseInt(window.getComputedStyle(ul).height, 10) || 50;
    const marginTop =
      Number.parseInt(window.getComputedStyle(ul)['margin-top'], 10) || 20;
    const marginBottom =
      Number.parseInt(window.getComputedStyle(ul)['margin-bottom'], 10) || 20;
    return height + marginTop + marginBottom;
  }

  handlePageClick(page) {
    this.props.onChange((page - 1) * this.props.pageLength);
  }

  render() {
    if (!this.props.pageLength) {
      return <div />;
    }
    const totalCount =
      !this.props.rowLimit || this.props.rowLimit > this.props.total
        ? this.props.total
        : this.props.rowLimit;

    const pages = Math.ceil(totalCount / this.props.pageLength);
    const selectedPage =
      Math.floor((this.props.pageOffset || 0) / this.props.pageLength) + 1;
    if (this.props.total === null) {
      return (
        <SimplePaging
          pages={selectedPage}
          selectedPage={selectedPage}
          showNext
          onClick={this.handlePageClick}
        />
      );
    }
    if (pages === 1) {
      return <div />;
    }
    return (
      <div
        ref={(container) => {
          this.container = container;
        }}
      >
        {pages <= 10 && (
          <SimplePaging
            pages={pages}
            selectedPage={selectedPage}
            onClick={this.handlePageClick}
          />
        )}
        {pages > 10 && (
          <LargePaging
            pages={pages}
            selectedPage={selectedPage}
            onClick={this.handlePageClick}
          />
        )}
      </div>
    );
  }
}
Pagination.propTypes = {
  total: PropTypes.number,
  pageLength: PropTypes.number,
  rowLimit: PropTypes.number,
  pageOffset: PropTypes.number,
  onChange: PropTypes.func,
  onHeightChange: PropTypes.func,
};
Pagination.defaultProps = {
  total: 0,
  pageOffset: 0,
  pageLength: null,
  rowLimit: null,
  onChange: () => {}, // returns offset
  onHeightChange: () => {},
};
