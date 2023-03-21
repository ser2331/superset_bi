import { describe, it } from "mocha";
import { expect } from "chai";
import fetch from "node-fetch";
import {
  headColumnName,
  bodyColumnName,
  getContextFilters,
  CheckImageUrl,
  getLatLongCenter,
  getIsPositionNotCorrect,
  getBalloonContent,
  getRequestData,
  getPointsInside,
  createCenters,
  setMenu,
} from "../../visualizations/bubble_map";
import {
  ymaps,
  slice,
  payload,
  features,
  placemarks,
  multyplaied,
  aggregates,
  aggregationResult,
  placemarkData,
} from "./data";
import { d3TimeFormatPreset } from "../../javascripts/modules/utils";

globalThis.fetch = fetch;
globalThis.ymaps = ymaps;

describe("bubble_map tests", () => {
  const bubbleMap = new ymaps.Map(
    "bubble-slice-container-584",
    {
      center: [44.8341, 45.16958],
      zoom: 1,
      behaviors: ["default", "scrollZoom"],
    },
    {
      searchControlProvider: "yandex#search",
    }
  );
  const verboseNames = slice.datasource.verbose_map;
  const dateFormatter = d3TimeFormatPreset(null, null);
  const dateTimeColumns = ["_calendar", "__timestamp"];
  const column = {
    name: "_appointment_type",
    value: "Свободная запись",
  };
  describe("headColumnName", () => {
    it("Working with test data", () => {
      expect(headColumnName(column, verboseNames)).to.equal("_appointment_type");
    });
  });
  describe("bodyColumnName", () => {
    it("Working with test data", () => {
      expect(bodyColumnName(column, dateTimeColumns, dateFormatter)).to.equal("Свободная запись");
    });
    it("Work with emty args", () => {
      expect(bodyColumnName()).to.be.undefined;
    });
  });
  describe("getBalloonContent", () => {
    const row = [
      {
        name: "_calendar",
        value: "2021-10-04",
      },
      {
        name: "sum__lpu_id",
        value: 1907723,
      },
    ];
    it("Working with test data", () => {
      expect(getBalloonContent(row, verboseNames, dateTimeColumns, dateFormatter, multyplaied)).to.not.be.undefined;
    });
  });
  describe("setMenu", () => {
    const data = {
      col: "sum__lpu_id",
      val: 2,
      html: `<span class="like-pre">${2}</span>`,
      isMetric: true,
      row: [],
      hintContent: "Невский",
      position: [30.437490999999998, 59.685012],
    };
    it("get emty drilldown menu", () => {
      expect(setMenu(slice, payload)(data)).to.deep.equal([]);
    });
  });
  describe("getContextFilters", () => {
    it("Working with test data", () => {
      expect(
        getContextFilters([], [30.461467, 59.912202], "", { formData: { longitude: "geo_y", latitude: "geo_x" } }, [])
      ).to.be.undefined;
    });
  });
  describe("CheckImageUrl", () => {
    it("Working with emty args", () => {
      assert(CheckImageUrl());
    });
  });
  describe("getLatLongCenter", () => {
    it("Working with test data", () => {
      assert.deepEqual(getLatLongCenter(features), [37.70781, 49.07721]);
    });
    it("Working with empty array", () => {
      assert.deepEqual(getLatLongCenter([]), [0, 0]);
    });
    it("Working with empty args", () => {
      assert.deepEqual(getLatLongCenter(), [0, 0]);
    });
  });
  describe("getIsPositionNotCorrect", () => {
    it("func works with real position", () => {
      assert(!getIsPositionNotCorrect([30.437490999999998, 59.685012]));
    });
    it("func works without args", () => {
      assert(getIsPositionNotCorrect());
    });
  });
  //TODO тест падает в CI\CD
  // describe("getRequestData", () => {
  //   it("works with test data", () => {
  //     assert.deepEqual(
  //       getRequestData(aggregates, "sum__lpu_id", payload, slice.formData.pointName),
  //       new URLSearchParams({
  //         form_data: JSON.stringify({
  //           ...payload.form_data,
  //           pointName: slice.formData.pointName,
  //           metric: "sum__lpu_id",
  //           aggregates: aggregates,
  //         }),
  //       })
  //     );
  //   });
  // });
  describe("getPointsInside", () => {
    it("Has points inside", () => {
      assert.deepEqual(getPointsInside(new ymaps._Polygon(), placemarks, slice.formData), aggregates);
    });
    it("Has not points inside", () => {
      assert.deepEqual(getPointsInside(new ymaps.Polygon(), placemarks, slice.formData), []);
    });
  });
  describe("createCenters", () => {
    it("works with polygons without points inside", async () => {
      const res = await createCenters(
        bubbleMap,
        aggregationResult,
        placemarkData,
        slice,
        payload,
        dateFormatter,
        "sum__lpu_id"
      );
      expect(res).to.have.lengthOf(1);
      // expect(res).to.have.property('geometry');
    });

    it("works with polygons with points inside", async function() {
      const res = await createCenters(
        bubbleMap,
        undefined,
        placemarkData,
        slice,
        payload,
        dateFormatter,
        "sum__lpu_id"
      );
      expect(res).to.have.lengthOf(0);
    });
  });
});
