export default `
    @page {
        size: A4 landscape;
        margin: 15mm;
    }
    
    @media print {
        .print_row {
            display: flex;
            page-break-inside: avoid;
            height: 100%;
        }
        .print_row > * {
            margin: 0 auto;
        }
        /*    скрываем элементы*/
        .chart-controls,
        #dashboard-header .favstar,
        #dashboard-header .pull-right,
        .align-button-container,
        .react-resizable-handle,
        [data-reactroot] ul,
        [role=tooltip],
        .panel-heading,
        /*.title:not(text), */
        #app ~ *,
        header,
        #dashboard-header
        {
            display: none !important;
        }
        /*  кастомные стили  */
        #slice-container {
            text-align: center;
            height: 100%;
        }
        .slice_container > * {
            margin: 0 auto;
        }
        .slice_container {
            overflow: unset!important;
        } 
        svg {
            width: unset!important;
            height: unset!important;
        }
        img {
            max-width: unset!important;
        }

        /* custom chart style */
        .parcoords {
            transform: translateX(-50%);
        }

        #slice-container .parcoords {
            transform: translateX(-33%);
        }
        
        #slice-container .widget.heatmap .token, #slice-container .widget.horizon .token {
            display: flex;
            justify-content: center;
        }
        
        #slice-container .heatmap, #slice-container .horizon {
            width: fit-content;
            text-align: left;
        }
        
        #slice-container  .widget.horizon .chart-container, #slice-container  .widget.event_flow .chart-container {
           margin: 0 auto;
           width: fit-content;
        }
        #slice-container .horizon {
            position: relative;
        }
        #slice-container .horizon .title {
            margin: 0;
            left: 0;
        }
        /* сбрасываем высоту графиков если они ограничены */
        .slice-cell {
            height: unset;
        }
        
        /* у слайса типа фильтр не центруем ничего*/
        .filter_box {
            text-align: initial;
        }
        
    }
`;
