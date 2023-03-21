// инициализация возможности перемещать d'n'd отчетов из списка, необходимо вызывать каждый раз при обновлении / ajax подгрузки страницы отчетов
export default () => {
    const { has_change_perm: hasChangePerm } = bootStarpData;

    function handleDragStart(e) {
        const [element] = $(e.target)
            .closest('tr')
            .find('td:nth-of-type(3) a');
        e.dataTransfer.setDragImage(element, $(element)
            .width() / 2, $(element)
            .height() / 2);
        e.dataTransfer.setData('text', JSON.stringify({
            type: 'slice',
            name: element.innerText,
            id: $(e.target)
                .closest('td')
                .attr('data-id'),
        }));
        e.target.classList.add('draggable');
    }

    function handleDragEnd(e) {
        e.target.classList.remove('draggable');
        e.dataTransfer.clearData('text');
    }

    if (hasChangePerm) {
        $('table tbody > tr')
            .each((index, row) => {
                const id = $(row)
                    .find('input[name=rowid]')
                    .attr('id');
                $(row)
                    .find('td')
                    .each((i, td) => {
                        $(td)
                            .attr('data-id', id);
                        $(td)
                            .attr('draggable', true);

                        td.addEventListener('dragstart', handleDragStart);
                        td.addEventListener('dragend', handleDragEnd, false);
                    });
            });
    }
};
