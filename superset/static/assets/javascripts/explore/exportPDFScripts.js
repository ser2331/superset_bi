export default `
    const mediaQueryList = window.matchMedia('print');
    mediaQueryList.addListener(function(mql) {
        if (mql.matches) {
            checkSize();
        }
    });
    if (document.querySelector('.speedometer span')) {
        document.querySelector('.speedometer span').remove();
    }
    function checkSize () {

        const reduceTabler = (parent, table) => {
            const { top: parentOffsetTop, height: parentHeight } = parent.getBoundingClientRect();
            const tableRows = table.querySelectorAll('tr');
            let outBoundIndex = null;
            let i = 0;
            while (!outBoundIndex && i < tableRows.length) {
                const { height: elemHeight, top: elemOffsetTop } = tableRows[i].getBoundingClientRect();
                if (elemHeight + elemOffsetTop > parentOffsetTop + parentHeight) {
                    outBoundIndex = i;
                }
                i++;
            }
            if (outBoundIndex) {
                for (let i = --outBoundIndex; i < tableRows.length; i++) {
                    tableRows[i].style.display = 'none';
                }
            }
        }

        document.querySelectorAll('.print_row').forEach(elem => {
            const { height: parentHeight, width: parentWidth} = elem.getBoundingClientRect();
            const child = elem.querySelector('[data-slice-id] .slice-cell');
            const svgElem = child.querySelector('.slice_container > svg');
            let {height: childHeight, width: childWidth} = svgElem ? svgElem.getBoundingClientRect() : child.getBoundingClientRect();
            
            // заголовок слайса
            const header = child.querySelector('.chart-header');
            const { height: headerHeight } = header.getBoundingClientRect();
            childHeight += headerHeight;
            
            if (!elem.querySelector('table')) {
                const kHiegth = Math.floor((parentHeight / childHeight) * 100) / 100;
                const kWidth = Math.floor((parentWidth / childWidth) * 100) / 100;
                child.style.zoom = kHiegth < kWidth ? kHiegth * 0.9 : kWidth * 0.9;
            } else {
                reduceTabler(elem, elem.querySelector('table'));
                reduceTabler(elem, elem.querySelector('table'));
            }
        })

        // для слайсов
        if (document.getElementById('slice-container')) {
            const parent = document.getElementById('slice-container');
            const { height: parentHeight, width: parentWidth} = parent.getBoundingClientRect();
            const child = parent.querySelector('.chart-container');
            if (child && !parent.querySelector('table')) {
                const svgElem = (!child.querySelector('.Pane') && child.querySelectorAll('svg').length == 1) && child.querySelector('svg');
                const {height: childHeight, width: childWidth} = svgElem ? svgElem.getBoundingClientRect() : child.getBoundingClientRect();
                const kHiegth = Math.floor((parentHeight / childHeight) * 100) / 100;
                const kWidth = Math.floor((parentWidth / childWidth) * 100) / 100;
                parent.style.zoom = kHiegth < kWidth ? kHiegth * 0.9 : kWidth * 0.9;
            }

        }
    }
`;
