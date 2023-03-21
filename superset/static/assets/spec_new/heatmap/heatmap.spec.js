import { describe, it } from 'mocha';
import { getPoints, getLatLongCenter, getIsPositionNotCorrect, getButtonPosition } from '../../visualizations/yandex_heat_map';

describe('heatmap tests', () => {
  const FEATURES = [
    {
      metric: [
        {
          name: 'count',
          value: 25,
        },
      ],
      groupby: [],
      position: [30.437490999999998, 59.685012],
      pointName: 'Калининский',
    },
    {
      metric: [
        {
          name: 'count',
          value: 67,
        },
      ],
      groupby: [],
      position: [30.461467, 59.912202],
      pointName: 'Невский',
    },
    {
      metric: [
        {
          name: 'count',
          value: 19,
        },
      ],
      groupby: [],
      position: [30.279962, 60.00145500000001],
      pointName: 'Приморский',
    },
  ];
  const POINTS = [
    {
      id: `id0`,
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [30.437490999999998, 59.685012],
      },
      properties: {
        weight: 25,
      },
    },
    {
      id: `id1`,
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [30.461467, 59.912202],
      },
      properties: {
        weight: 67,
      },
    },
    {
      id: `id2`,
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [30.279962, 60.00145500000001],
      },
      properties: {
        weight: 19,
      },
    },
  ];
  const PROPS = {
    bubbleContainerId: 'slice-container-1490',
    formData: {
      zoom: 3,
      show_controls: true,
      opacity: 1,
      radius: 4,
      gradient: true,
      heatmapIsShown: true,
      dissipating: true,
      show_legend: true,
      bubble_map_metrics: ['count'],
      legend_number_format: '.3s',
      verbose_names: { count: 'COUNT(*)' },
    },
    features: FEATURES,
    legend: {
      count: {
        max_val: 10820,
        min_val: 1,
        avg_val: 115,
      },
    },
  };

  describe('getLatLongCenter', () => {
    it('Working with test data', () => {
      assert.deepEqual(getLatLongCenter(FEATURES), [30.37071 , 59.84323]);
    });
    it('Working with empty array', () => {
      assert.deepEqual(getLatLongCenter([]), [0, 0]);
    });
    it('Working with empty args', () => {
      assert.deepEqual(getLatLongCenter(), [0, 0]);
    });
  });

  describe('getIsPositionNotCorrect', () => {
    it('func works with real position', () => {
      assert(!getIsPositionNotCorrect([30.437490999999998, 59.685012]));
    });
    it('func works without args', () => {
      assert(getIsPositionNotCorrect());
    });
  });

  describe('getButtonPosition', () => {
    it('get correct position with index 0', () => {
      assert.deepEqual(getButtonPosition(0), {
        top: 60,
        right: 10,
      });
    });
    it('get correct position with index 1', () => {
      assert.deepEqual(getButtonPosition(1), { 
        top: 100,
        right: 10
      });
    });
    it('get default position with undefined args', () => {
      assert.isNotNaN(getButtonPosition());
    });
  });

  describe('getPoints', () => {
    it('Working with test data', () => {
      assert.deepEqual(getPoints(FEATURES), POINTS);
    });
    it('Working with empty array', () => {
      assert.deepEqual(getPoints([]), []);
    });
    it('Handle undefined', () => {
      assert.exists(getPoints());
    });
    it('Handle null', () => {
      assert.exists(getPoints(null));
    });
  });
});
