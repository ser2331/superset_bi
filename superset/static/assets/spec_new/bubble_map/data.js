export const slice = {
  drilldownData: null,
  selector: "#slice-container-1541",
  containerId: "slice-container-1541",
  state: {
    height: 747,
    drilldownIsOpen: false,
  },
  metrics: [
    {
      metric_name: "avg__lpu_id",
      verbose_name: null,
      description: null,
      expression: "AVG(lpu_id)",
      warning_text: null,
    },
    {
      metric_name: "sum__geo_x",
      verbose_name: null,
      description: null,
      expression: "SUM(geo_x)",
      warning_text: null,
    },
    {
      metric_name: "avg__geo_x",
      verbose_name: null,
      description: null,
      expression: "AVG(geo_x)",
      warning_text: null,
    },
    {
      metric_name: "sum__geo_y",
      verbose_name: null,
      description: null,
      expression: "SUM(geo_y)",
      warning_text: null,
    },
    {
      metric_name: "sum__lpu_id",
      verbose_name: "Полное имя метрики",
      description: "",
      expression: "SUM(lpu_id)",
      warning_text: null,
    },
    {
      metric_name: "avg__geo_y",
      verbose_name: null,
      description: null,
      expression: "AVG(geo_y)",
      warning_text: null,
    },
    {
      metric_name: "sum__speciality_code",
      verbose_name: null,
      description: null,
      expression: "SUM(speciality_code)",
      warning_text: null,
    },
    {
      metric_name: "sum__patient_age",
      verbose_name: null,
      description: null,
      expression: "SUM(patient_age)",
      warning_text: null,
    },
    {
      metric_name: "count",
      verbose_name: "COUNT(*)",
      description: null,
      expression: "COUNT(*)",
      warning_text: null,
    },
    {
      metric_name: "avg__patient_age",
      verbose_name: "",
      description: "",
      expression: "AVG(patient_age)",
      warning_text: null,
    },
    {
      metric_name: "avg__speciality_code",
      verbose_name: "",
      description: "",
      expression: "AVG(speciality_code)",
      warning_text: null,
    },
  ],
  formData: {
    datasource: "16__table",
    viz_type: "bubble_map",
    slice_id: 1541,
    url_drilldowns: [],
    granularity_sqla: "_calendar",
    time_grain_sqla: null,
    since: "",
    until: "now",
    latitude: "geo_x",
    longitude: "geo_y",
    pointName: "district_name",
    iconPointer: "map_icon",
    groupby: ["_appointment_type"],
    bubble_map_metrics: ["sum__lpu_id"],
    row_limit: 50,
    clustering: true,
    autozoom: true,
    zoom: 1,
    polygon_id: "",
    aggregation_by_area: false,
    where: "",
    having: "",
    filters: [],
    isExploreCharts: true,
  },
  datasource: {
    all_cols: [
      ["_appointment_type", "_appointment_type"],
      ["_calendar", "_calendar"],
      ["_event_name", "_event_name"],
      ["_record_hash_key", "_record_hash_key"],
      ["appointment_id", "appointment_id"],
      ["appointment_reg_source_name", "appointment_reg_source_name"],
      ["appointment_visit_date", "appointment_visit_date"],
      ["appointment_visit_time", "appointment_visit_time"],
      ["district_name", "district_name"],
      ["doctor_id", "doctor_id"],
      ["doctor_name", "Имя доктора"],
      ["geo_x", "Гео Х"],
      ["geo_y", "Гео Y"],
      ["lpu_id", "lpu_id"],
      ["lpu_level1_short_name", "lpu_level1_short_name"],
      ["lpu_level2_short_name", "lpu_level2_short_name"],
      ["lpu_level3_short_name", "lpu_level3_short_name"],
      ["map_icon", "map_icon"],
      ["patient_age", "patient_age"],
      ["patient_id", "patient_id"],
      ["patient_name", "patient_name"],
      ["speciality_code", "Имя точки"],
      ["speciality_name", "Специальное имя"],
    ],
    column_formats: {
      sum__lpu_id: "",
      avg__patient_age: ".0f",
      avg__speciality_code: "$.2f",
    },
    database: {
      name: "main",
      backend: "postgresql",
      allow_multi_schema_metadata_fetch: true,
    },
    edit_url: "/tablemodelview/edit/16",
    filter_select: false,
    filterable_cols: [
      ["_appointment_type", "_appointment_type"],
      ["_calendar", "_calendar"],
      ["_event_name", "_event_name"],
      ["_record_hash_key", "_record_hash_key"],
      ["appointment_id", "appointment_id"],
      ["appointment_reg_source_name", "appointment_reg_source_name"],
      ["appointment_visit_date", "appointment_visit_date"],
      ["appointment_visit_time", "appointment_visit_time"],
      ["district_name", "district_name"],
      ["doctor_id", "doctor_id"],
      ["doctor_name", "doctor_name"],
      ["geo_x", "geo_x"],
      ["geo_y", "geo_y"],
      ["lpu_id", "lpu_id"],
      ["lpu_level1_short_name", "lpu_level1_short_name"],
      ["lpu_level2_short_name", "lpu_level2_short_name"],
      ["lpu_level3_short_name", "lpu_level3_short_name"],
      ["patient_age", "patient_age"],
      ["patient_id", "patient_id"],
      ["patient_name", "patient_name"],
      ["speciality_code", "speciality_code"],
      ["speciality_name", "speciality_name"],
    ],
    gb_cols: [
      ["_appointment_type", "_appointment_type"],
      ["_calendar", "_calendar"],
      ["_event_name", "_event_name"],
      ["_record_hash_key", "_record_hash_key"],
      ["appointment_id", "appointment_id"],
      ["appointment_reg_source_name", "appointment_reg_source_name"],
      ["appointment_visit_date", "appointment_visit_date"],
      ["appointment_visit_time", "appointment_visit_time"],
      ["district_name", "district_name"],
      ["doctor_id", "doctor_id"],
      ["doctor_name", "doctor_name"],
      ["geo_x", "geo_x"],
      ["geo_y", "geo_y"],
      ["lpu_id", "lpu_id"],
      ["lpu_level1_short_name", "lpu_level1_short_name"],
      ["lpu_level2_short_name", "lpu_level2_short_name"],
      ["lpu_level3_short_name", "lpu_level3_short_name"],
      ["patient_age", "patient_age"],
      ["patient_id", "patient_id"],
      ["patient_name", "patient_name"],
      ["speciality_code", "speciality_code"],
      ["speciality_name", "speciality_name"],
    ],
    id: 16,
    metrics_combo: [
      ["count", "COUNT(*)"],
      ["avg__geo_x", "avg__geo_x"],
      ["avg__geo_y", "avg__geo_y"],
      ["avg__lpu_id", "avg__lpu_id"],
      ["avg__patient_age", "avg__patient_age"],
      ["avg__speciality_code", "avg__speciality_code"],
      ["sum__geo_x", "sum__geo_x"],
      ["sum__geo_y", "sum__geo_y"],
      ["sum__patient_age", "sum__patient_age"],
      ["sum__speciality_code", "sum__speciality_code"],
      ["sum__lpu_id", "Полное имя метрики"],
    ],
    name: "for_babble",
    order_by_choices: [
      ['["_appointment_type", true]', "_appointment_type [asc]"],
      ['["_appointment_type", false]', "_appointment_type [desc]"],
      ['["_calendar", true]', "_calendar [asc]"],
      ['["_calendar", false]', "_calendar [desc]"],
      ['["_event_name", true]', "_event_name [asc]"],
      ['["_event_name", false]', "_event_name [desc]"],
      ['["_record_hash_key", true]', "_record_hash_key [asc]"],
      ['["_record_hash_key", false]', "_record_hash_key [desc]"],
      ['["appointment_id", true]', "appointment_id [asc]"],
      ['["appointment_id", false]', "appointment_id [desc]"],
      ['["appointment_reg_source_name", true]', "appointment_reg_source_name [asc]"],
      ['["appointment_reg_source_name", false]', "appointment_reg_source_name [desc]"],
      ['["appointment_visit_date", true]', "appointment_visit_date [asc]"],
      ['["appointment_visit_date", false]', "appointment_visit_date [desc]"],
      ['["appointment_visit_time", true]', "appointment_visit_time [asc]"],
      ['["appointment_visit_time", false]', "appointment_visit_time [desc]"],
      ['["district_name", true]', "district_name [asc]"],
      ['["district_name", false]', "district_name [desc]"],
      ['["doctor_id", true]', "doctor_id [asc]"],
      ['["doctor_id", false]', "doctor_id [desc]"],
      ['["doctor_name", true]', "doctor_name [asc]"],
      ['["doctor_name", false]', "doctor_name [desc]"],
      ['["geo_x", true]', "geo_x [asc]"],
      ['["geo_x", false]', "geo_x [desc]"],
      ['["geo_y", true]', "geo_y [asc]"],
      ['["geo_y", false]', "geo_y [desc]"],
      ['["lpu_id", true]', "lpu_id [asc]"],
      ['["lpu_id", false]', "lpu_id [desc]"],
      ['["lpu_level1_short_name", true]', "lpu_level1_short_name [asc]"],
      ['["lpu_level1_short_name", false]', "lpu_level1_short_name [desc]"],
      ['["lpu_level2_short_name", true]', "lpu_level2_short_name [asc]"],
      ['["lpu_level2_short_name", false]', "lpu_level2_short_name [desc]"],
      ['["lpu_level3_short_name", true]', "lpu_level3_short_name [asc]"],
      ['["lpu_level3_short_name", false]', "lpu_level3_short_name [desc]"],
      ['["map_icon", true]', "map_icon [asc]"],
      ['["map_icon", false]', "map_icon [desc]"],
      ['["patient_age", true]', "patient_age [asc]"],
      ['["patient_age", false]', "patient_age [desc]"],
      ['["patient_id", true]', "patient_id [asc]"],
      ['["patient_id", false]', "patient_id [desc]"],
      ['["patient_name", true]', "patient_name [asc]"],
      ['["patient_name", false]', "patient_name [desc]"],
      ['["speciality_code", true]', "speciality_code [asc]"],
      ['["speciality_code", false]', "speciality_code [desc]"],
      ['["speciality_name", true]', "speciality_name [asc]"],
      ['["speciality_name", false]', "speciality_name [desc]"],
    ],
    type: "table",
    metrics: [
      {
        metric_name: "avg__lpu_id",
        verbose_name: null,
        description: null,
        expression: "AVG(lpu_id)",
        warning_text: null,
      },
      {
        metric_name: "sum__geo_x",
        verbose_name: null,
        description: null,
        expression: "SUM(geo_x)",
        warning_text: null,
      },
      {
        metric_name: "avg__geo_x",
        verbose_name: null,
        description: null,
        expression: "AVG(geo_x)",
        warning_text: null,
      },
      {
        metric_name: "sum__geo_y",
        verbose_name: null,
        description: null,
        expression: "SUM(geo_y)",
        warning_text: null,
      },
      {
        metric_name: "sum__lpu_id",
        verbose_name: "Полное имя метрики",
        description: "",
        expression: "SUM(lpu_id)",
        warning_text: null,
      },
      {
        metric_name: "avg__geo_y",
        verbose_name: null,
        description: null,
        expression: "AVG(geo_y)",
        warning_text: null,
      },
      {
        metric_name: "sum__speciality_code",
        verbose_name: null,
        description: null,
        expression: "SUM(speciality_code)",
        warning_text: null,
      },
      {
        metric_name: "sum__patient_age",
        verbose_name: null,
        description: null,
        expression: "SUM(patient_age)",
        warning_text: null,
      },
      {
        metric_name: "count",
        verbose_name: "COUNT(*)",
        description: null,
        expression: "COUNT(*)",
        warning_text: null,
      },
      {
        metric_name: "avg__patient_age",
        verbose_name: "",
        description: "",
        expression: "AVG(patient_age)",
        warning_text: null,
      },
      {
        metric_name: "avg__speciality_code",
        verbose_name: "",
        description: "",
        expression: "AVG(speciality_code)",
        warning_text: null,
      },
    ],
    columns: [
      {
        column_name: "_record_hash_key",
        verbose_name: null,
        description: null,
        expression: "",
        filterable: true,
        groupby: true,
        is_dttm: false,
        type: "TEXT",
      },
      {
        column_name: "_appointment_type",
        verbose_name: null,
        description: null,
        expression: "",
        filterable: true,
        groupby: true,
        is_dttm: false,
        type: "TEXT",
      },
      {
        column_name: "_event_name",
        verbose_name: null,
        description: null,
        expression: "",
        filterable: true,
        groupby: true,
        is_dttm: false,
        type: "TEXT",
      },
      {
        column_name: "appointment_reg_source_name",
        verbose_name: null,
        description: null,
        expression: "",
        filterable: true,
        groupby: true,
        is_dttm: false,
        type: "TEXT",
      },
      {
        column_name: "lpu_id",
        verbose_name: null,
        description: null,
        expression: "",
        filterable: true,
        groupby: true,
        is_dttm: false,
        type: "BIGINT",
      },
      {
        column_name: "district_name",
        verbose_name: null,
        description: null,
        expression: "",
        filterable: true,
        groupby: true,
        is_dttm: false,
        type: "TEXT",
      },
      {
        column_name: "lpu_level1_short_name",
        verbose_name: null,
        description: null,
        expression: "",
        filterable: true,
        groupby: true,
        is_dttm: false,
        type: "TEXT",
      },
      {
        column_name: "lpu_level2_short_name",
        verbose_name: null,
        description: null,
        expression: "",
        filterable: true,
        groupby: true,
        is_dttm: false,
        type: "TEXT",
      },
      {
        column_name: "lpu_level3_short_name",
        verbose_name: null,
        description: null,
        expression: "",
        filterable: true,
        groupby: true,
        is_dttm: false,
        type: "TEXT",
      },
      {
        column_name: "doctor_id",
        verbose_name: null,
        description: null,
        expression: "",
        filterable: true,
        groupby: true,
        is_dttm: false,
        type: "TEXT",
      },
      {
        column_name: "appointment_id",
        verbose_name: null,
        description: null,
        expression: "",
        filterable: true,
        groupby: true,
        is_dttm: false,
        type: "TEXT",
      },
      {
        column_name: "appointment_visit_date",
        verbose_name: null,
        description: null,
        expression: "",
        filterable: true,
        groupby: true,
        is_dttm: false,
        type: "TEXT",
      },
      {
        column_name: "appointment_visit_time",
        verbose_name: null,
        description: null,
        expression: "",
        filterable: true,
        groupby: true,
        is_dttm: false,
        type: "TEXT",
      },
      {
        column_name: "patient_id",
        verbose_name: null,
        description: null,
        expression: "",
        filterable: true,
        groupby: true,
        is_dttm: false,
        type: "TEXT",
      },
      {
        column_name: "patient_age",
        verbose_name: null,
        description: null,
        expression: "",
        filterable: true,
        groupby: true,
        is_dttm: false,
        type: "BIGINT",
      },
      {
        column_name: "patient_name",
        verbose_name: null,
        description: null,
        expression: "",
        filterable: true,
        groupby: true,
        is_dttm: false,
        type: "TEXT",
      },
      {
        column_name: "speciality_name",
        verbose_name: "Специальное имя",
        description: "",
        expression: "",
        filterable: true,
        groupby: true,
        is_dttm: false,
        type: "TEXT",
      },
      {
        column_name: "speciality_code",
        verbose_name: "Имя точки",
        description: "",
        expression: "",
        filterable: true,
        groupby: true,
        is_dttm: false,
        type: "BIGINT",
      },
      {
        column_name: "geo_x",
        verbose_name: "Гео Х",
        description: "",
        expression: "",
        filterable: true,
        groupby: true,
        is_dttm: false,
        type: "DOUBLE PRECISION",
      },
      {
        column_name: "doctor_name",
        verbose_name: "Имя доктора",
        description: "",
        expression: "",
        filterable: true,
        groupby: true,
        is_dttm: false,
        type: "TEXT",
      },
      {
        column_name: "geo_y",
        verbose_name: "Гео Y",
        description: "",
        expression: "",
        filterable: true,
        groupby: true,
        is_dttm: false,
        type: "DOUBLE PRECISION",
      },
      {
        column_name: "map_icon",
        verbose_name: "map_icon",
        description: "",
        expression: "",
        filterable: false,
        groupby: false,
        is_dttm: false,
        type: "TEXT",
      },
      {
        column_name: "_calendar",
        verbose_name: "",
        description: "",
        expression: "",
        filterable: true,
        groupby: true,
        is_dttm: true,
        type: "TIMESTAMP WITHOUT TIME ZONE",
      },
    ],
    verbose_map: {
      __timestamp: "Time",
      avg__lpu_id: "avg__lpu_id",
      sum__geo_x: "sum__geo_x",
      avg__geo_x: "avg__geo_x",
      sum__geo_y: "sum__geo_y",
      sum__lpu_id: "Полное имя метрики",
      avg__geo_y: "avg__geo_y",
      sum__speciality_code: "sum__speciality_code",
      sum__patient_age: "sum__patient_age",
      count: "COUNT(*)",
      avg__patient_age: "avg__patient_age",
      avg__speciality_code: "avg__speciality_code",
      _record_hash_key: "_record_hash_key",
      _appointment_type: "_appointment_type",
      _event_name: "_event_name",
      appointment_reg_source_name: "appointment_reg_source_name",
      lpu_id: "lpu_id",
      district_name: "district_name",
      lpu_level1_short_name: "lpu_level1_short_name",
      lpu_level2_short_name: "lpu_level2_short_name",
      lpu_level3_short_name: "lpu_level3_short_name",
      doctor_id: "doctor_id",
      appointment_id: "appointment_id",
      appointment_visit_date: "appointment_visit_date",
      appointment_visit_time: "appointment_visit_time",
      patient_id: "patient_id",
      patient_age: "patient_age",
      patient_name: "patient_name",
      speciality_name: "Специальное имя",
      speciality_code: "Имя точки",
      geo_x: "Гео Х",
      doctor_name: "Имя доктора",
      geo_y: "Гео Y",
      map_icon: "map_icon",
      _calendar: "_calendar",
    },
    granularity_sqla: [["_calendar", "_calendar"]],
    time_grain_sqla: [
      [null, "Time Column"],
      ["PT1S", "second"],
      ["PT1M", "minute"],
      ["PT1H", "hour"],
      ["P1D", "day"],
      ["P1W", "week"],
      ["P1M", "month"],
      ["P0.25Y", "quarter"],
      ["P1Y", "year"],
    ],
    column_groups: {},
    metric_groups: {},
  },
  columns: [
    {
      column_name: "_record_hash_key",
      verbose_name: null,
      description: null,
      expression: "",
      filterable: true,
      groupby: true,
      is_dttm: false,
      type: "TEXT",
    },
    {
      column_name: "_appointment_type",
      verbose_name: null,
      description: null,
      expression: "",
      filterable: true,
      groupby: true,
      is_dttm: false,
      type: "TEXT",
    },
    {
      column_name: "_event_name",
      verbose_name: null,
      description: null,
      expression: "",
      filterable: true,
      groupby: true,
      is_dttm: false,
      type: "TEXT",
    },
    {
      column_name: "appointment_reg_source_name",
      verbose_name: null,
      description: null,
      expression: "",
      filterable: true,
      groupby: true,
      is_dttm: false,
      type: "TEXT",
    },
    {
      column_name: "lpu_id",
      verbose_name: null,
      description: null,
      expression: "",
      filterable: true,
      groupby: true,
      is_dttm: false,
      type: "BIGINT",
    },
    {
      column_name: "district_name",
      verbose_name: null,
      description: null,
      expression: "",
      filterable: true,
      groupby: true,
      is_dttm: false,
      type: "TEXT",
    },
    {
      column_name: "lpu_level1_short_name",
      verbose_name: null,
      description: null,
      expression: "",
      filterable: true,
      groupby: true,
      is_dttm: false,
      type: "TEXT",
    },
    {
      column_name: "lpu_level2_short_name",
      verbose_name: null,
      description: null,
      expression: "",
      filterable: true,
      groupby: true,
      is_dttm: false,
      type: "TEXT",
    },
    {
      column_name: "lpu_level3_short_name",
      verbose_name: null,
      description: null,
      expression: "",
      filterable: true,
      groupby: true,
      is_dttm: false,
      type: "TEXT",
    },
    {
      column_name: "doctor_id",
      verbose_name: null,
      description: null,
      expression: "",
      filterable: true,
      groupby: true,
      is_dttm: false,
      type: "TEXT",
    },
    {
      column_name: "appointment_id",
      verbose_name: null,
      description: null,
      expression: "",
      filterable: true,
      groupby: true,
      is_dttm: false,
      type: "TEXT",
    },
    {
      column_name: "appointment_visit_date",
      verbose_name: null,
      description: null,
      expression: "",
      filterable: true,
      groupby: true,
      is_dttm: false,
      type: "TEXT",
    },
    {
      column_name: "appointment_visit_time",
      verbose_name: null,
      description: null,
      expression: "",
      filterable: true,
      groupby: true,
      is_dttm: false,
      type: "TEXT",
    },
    {
      column_name: "patient_id",
      verbose_name: null,
      description: null,
      expression: "",
      filterable: true,
      groupby: true,
      is_dttm: false,
      type: "TEXT",
    },
    {
      column_name: "patient_age",
      verbose_name: null,
      description: null,
      expression: "",
      filterable: true,
      groupby: true,
      is_dttm: false,
      type: "BIGINT",
    },
    {
      column_name: "patient_name",
      verbose_name: null,
      description: null,
      expression: "",
      filterable: true,
      groupby: true,
      is_dttm: false,
      type: "TEXT",
    },
    {
      column_name: "speciality_name",
      verbose_name: "Специальное имя",
      description: "",
      expression: "",
      filterable: true,
      groupby: true,
      is_dttm: false,
      type: "TEXT",
    },
    {
      column_name: "speciality_code",
      verbose_name: "Имя точки",
      description: "",
      expression: "",
      filterable: true,
      groupby: true,
      is_dttm: false,
      type: "BIGINT",
    },
    {
      column_name: "geo_x",
      verbose_name: "Гео Х",
      description: "",
      expression: "",
      filterable: true,
      groupby: true,
      is_dttm: false,
      type: "DOUBLE PRECISION",
    },
    {
      column_name: "doctor_name",
      verbose_name: "Имя доктора",
      description: "",
      expression: "",
      filterable: true,
      groupby: true,
      is_dttm: false,
      type: "TEXT",
    },
    {
      column_name: "geo_y",
      verbose_name: "Гео Y",
      description: "",
      expression: "",
      filterable: true,
      groupby: true,
      is_dttm: false,
      type: "DOUBLE PRECISION",
    },
    {
      column_name: "map_icon",
      verbose_name: "map_icon",
      description: "",
      expression: "",
      filterable: false,
      groupby: false,
      is_dttm: false,
      type: "TEXT",
    },
    {
      column_name: "_calendar",
      verbose_name: "",
      description: "",
      expression: "",
      filterable: true,
      groupby: true,
      is_dttm: true,
      type: "TIMESTAMP WITHOUT TIME ZONE",
    },
  ],
};
export const payload = {
  cache_key: null,
  cached_dttm: null,
  cache_timeout: 86400,
  total_found: 283,
  hierarchy: [
    {
      name: "тест",
      id: 3,
      columns: [
        {
          name: "lpu_level1_short_name",
          verbose_name: null,
          order: 10,
          id: 470,
          groupby: true,
        },
        {
          name: "lpu_level2_short_name",
          verbose_name: null,
          order: 20,
          id: 471,
          groupby: true,
        },
      ],
    },
  ],
  error: null,
  form_data: {
    datasource: "16__table",
    viz_type: "bubble_map",
    url_drilldowns: [
      {
        title: "на отчет",
        field: "sum__lpu_id",
        type: "slices",
        url: 1485,
        drilldownToInfoPanel: false,
      },
      {
        title: "на панель 2",
        field: "sum__lpu_id",
        type: "dashboards",
        url: 11,
        drilldownToInfoPanel: true,
      },
    ],
    granularity_sqla_single: "_calendar",
    time_grain_sqla: null,
    since: "",
    until: "now",
    longitude: "geo_y",
    latitude: "geo_x",
    pointName: "district_name",
    groupby: ["_appointment_type"],
    bubble_map_metrics: ["sum__lpu_id"],
    row_limit: 50,
    clustering: true,
    autozoom: true,
    zoom: 1,
    isExploreCharts: true,
    folder_id: null,
    allow_run_async: false,
    fields_by_slice: true,
    columns: [],
    iconPointer: "map_icon",
    filters: [],
    having_filters: [],
    where: "",
    having: "",
    granularity_sqla: "_calendar",
    info_panels_drilldown: true,
    slice_id: 1541,
    polygon_id: "",
    aggregation_by_area: false,
    granularity: null,
    metrics: ["sum__lpu_id"],
    icon_field: "map_icon",
    from_dttm: "",
    to_dttm: "2022-09-02 17:03:38",
  },
  is_cached: false,
  query:
    "SELECT geo_x AS geo_x,\n       geo_y AS geo_y,\n       district_name AS district_name,\n       map_icon AS map_icon,\n       _appointment_type AS _appointment_type,\n       SUM(lpu_id) AS sum__lpu_id\nFROM for_babble\nWHERE _calendar <= '2022-09-02 17:03:38'\nGROUP BY geo_x,\n         geo_y,\n         district_name,\n         map_icon,\n         _appointment_type\nORDER BY sum__lpu_id DESC\nLIMIT 50;",
  status: "success",
  stacktrace: null,
  rowcount: 50,
  data: {
    features: [
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 4142145,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.32212, 59.963953000000004],
        pointName: "Петроградский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 1333992,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.308574, 59.925394],
        pointName: "Адмиралтейский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 350170,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.312715, 60.020920999999994],
        pointName: "Выборгский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 283824,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.299375, 59.849428],
        pointName: "Московский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 186048,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.320063, 60.047515000000004],
        pointName: "Выборгский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 138276,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.281588, 60.079122999999996],
        pointName: "Выборгский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 48763,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Заявка ЖОЗ",
          },
        ],
        position: [30.308574, 59.925394],
        pointName: "Адмиралтейский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 44776,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.330987, 60.035805],
        pointName: "Выборгский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 39388,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.347489000000003, 59.998351],
        pointName: "Выборгский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 22306,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.208906, 60.009939],
        pointName: "Приморский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 19902,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.243840999999996, 60.026033],
        pointName: "Приморский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 19684,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.397309000000003, 59.868853],
        pointName: "Фрунзенский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 19276,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.441290999999996, 59.866372999999996],
        pointName: "Невский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 18848,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.462024, 59.911519999999996],
        pointName: "Невский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 17391,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Запись на прием по направлению",
          },
        ],
        position: [30.308574, 59.925394],
        pointName: "Адмиралтейский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 17340,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.386421999999996, 60.024037],
        pointName: "Калининский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 17085,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.461467, 59.912202],
        pointName: "Невский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 17050,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.333484000000002, 59.843222],
        pointName: "Московский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 16856,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.373019, 59.866215000000004],
        pointName: "Фрунзенский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 16335,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.387778000000004, 60.023695],
        pointName: "Калининский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 15351,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.406553000000002, 60.042325],
        pointName: "Калининский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 15067,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.493859999999998, 59.906152],
        pointName: "Невский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 14790,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.425427000000003, 60.004509999999996],
        pointName: "Калининский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 14622,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.024976000000002, 59.843476],
        pointName: "Красногвардейский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 14220,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.088873, 59.741577],
        pointName: "Красносельский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 14210,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.501746999999998, 59.837331999999996],
        pointName: "Невский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 13386,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.378445000000003, 59.997685],
        pointName: "Калининский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 13244,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [29.779709000000004, 59.907],
        pointName: "Петродворцовый",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 12864,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.382981, 59.85012],
        pointName: "Фрунзенский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 12862,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.244640999999998, 60.025552000000005],
        pointName: "Приморский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 12805,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.356346000000002, 60.043282],
        pointName: "Выборгский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 12075,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.430115999999998, 60.032852],
        pointName: "Калининский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 11790,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.408969, 59.831417],
        pointName: "Фрунзенский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 11782,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.588489000000003, 59.746324],
        pointName: "Колпинский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 11622,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.424708000000003, 60.004114],
        pointName: "Калининский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 11398,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.332504999999998, 60.05146800000001],
        pointName: "Калининский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 11359,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [29.873627000000003, 59.876576],
        pointName: "Петродворцовый",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 10952,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.37425, 59.999692],
        pointName: "Калининский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 10944,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.409022999999998, 60.01380699999999],
        pointName: "Калининский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 10716,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.432398, 59.976769],
        pointName: "Красногвардейский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 10520,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.384688, 59.876861],
        pointName: "Фрунзенский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 9741,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.344731, 60.055955000000004],
        pointName: "Выборгский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 9724,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.422588, 60.031877],
        pointName: "Калининский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 9261,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.324582, 60.057101],
        pointName: "Выборгский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 9126,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.420809000000002, 59.960485],
        pointName: "Красногвардейский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 9108,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.267547999999998, 60.01505699999999],
        pointName: "Приморский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 8862,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.481976, 59.927640000000004],
        pointName: "Невский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 8841,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.192233, 59.850747999999996],
        pointName: "Красносельский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 8815,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [30.207890999999996, 60.010321],
        pointName: "Приморский",
        map_icon: null,
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 8784,
          },
        ],
        groupby: [
          {
            name: "_appointment_type",
            value: "Свободная запись",
          },
        ],
        position: [29.864177, 60.17174],
        pointName: "Приморский",
        map_icon: null,
      },
    ],
    mapboxApiKey: "",
    areas: null,
  },
  utc_offset: 3,
};
export const ymaps = {
  Map: (...args) => new Map(...args),
  Polygon: (...args) => new Polygon(...args),
  _Polygon: (...args) => new _Polygon(...args),
  Placemark: (...args) => new Placemark(...args),
};
class Map {
  constructor(bubbleContainerId, props, options) {
    this.geoObjects = {
      add: () => {},
    };
    this.bubbleContainerId = bubbleContainerId;
    this.props = props;
    this.options = options;
  }
  add(obj) {
    this.geoObjects.push(obj);
  }
}
class Polygon {
  constructor(coordinates, props, options) {
    this.coordinates = coordinates;
    this.props = props;
    this.options = options;
    this.bounds = [coordinates];
  }
  events = {
    add() {},
  };
  geometry = {
    getBounds() {
      return this.bounds;
    },
    contains() {
      return false;
    },
  };
}
class _Polygon {
  constructor(coordinates, props, options) {
    this.coordinates = coordinates;
    this.props = props;
    this.options = options;
    this.bounds = [coordinates];
  }
  events = {
    add() {},
  };
  geometry = {
    getBounds() {
      return this.bounds;
    },
    contains() {
      return true;
    },
  };
}
class Placemark {
  constructor(coordinates, props, options) {
    this.coordinates = coordinates;
    this.options = options;
    this.bounds = [coordinates];
    this.properties = {
      ...props,
      get(name) {
        return props[name];
      },
    };
    this.events = {
      add() {},
    };
    this.geometry = {
      getCoordinates() {
        return coordinates;
      },
      getBounds() {
        return bounds;
      },
      contains() {
        return false;
      },
    };
  }
}

export const features = [
  {
    position: [44.885214149999996, 38.28821395083526],
    map_icon: null,
    pointName: "Абинский район",
    metric: [
      {
        name: "sum__lpu_id",
        value: "389.0",
      },
    ],
    items: [
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 341,
          },
        ],
        groupby: [
          {
            name: "lpu_level3_short_name",
            value: "###",
          },
        ],
      },
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 48,
          },
        ],
        groupby: [
          {
            name: "lpu_level3_short_name",
            value: "###",
          },
        ],
      },
    ],
  },
  {
    position: [45.042599, 38.304048],
    pointName: "Адмиралтейский",
    map_icon: null,
    items: [
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 341,
          },
        ],
        groupby: [
          {
            name: "lpu_level3_short_name",
            value: "###",
          },
        ],
      },
    ],
    metric: {
      sum__lpu_id: 341,
    },
  },
  {
    position: [30.373019, 59.866215000000004],
    pointName: "Фрунзенский",
    map_icon: null,
    items: [
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 16856,
          },
        ],
        groupby: [
          {
            name: "lpu_level3_short_name",
            value: "###",
          },
        ],
      },
    ],
    metric: {
      sum__lpu_id: 16856,
    },
  },
  {
    position: [0, 0],
    pointName: "Фрунзенский",
    map_icon: null,
    items: [
      {
        metric: [
          {
            name: "sum__lpu_id",
            value: 16856,
          },
        ],
        groupby: [
          {
            name: "lpu_level3_short_name",
            value: "###",
          },
        ],
      },
    ],
    metric: {
      sum__lpu_id: 16856,
    },
  },
];
const placemark = new ymaps.Placemark([44, 38], {
  map_icon: "",
  hintContent: "Абинский район",
  metric: [
    {
      name: "sum__lpu_id",
      value: "389.0",
    },
  ],
  items: [
    {
      metric: [
        {
          name: "sum__lpu_id",
          value: 341,
        },
      ],
      groupby: [
        {
          name: "lpu_level3_short_name",
          value: "###",
        },
      ],
    },
    {
      metric: [
        {
          name: "sum__lpu_id",
          value: 48,
        },
      ],
      groupby: [
        {
          name: "lpu_level3_short_name",
          value: "###",
        },
      ],
    },
  ],
});
const polygon = new ymaps.Polygon();
export const placemarks = [placemark];
export const aggregates = [
  {
    fields: {
      icon_field: {
        field: "map_icon",
        value: "",
      },
      latitude: {
        field: "geo_x",
        value: 44,
      },
      longitude: {
        field: "geo_y",
        value: 38,
      },
      pointName: {
        field: "district_name",
        value: "Абинский район",
      },
    },
    point: placemark,
  },
];
export const multyplaied = [
  {
    metric: [
      {
        name: "sum__lpu_id",
        value: 341,
      },
    ],
    groupby: [
      {
        name: "lpu_level3_short_name",
        value: "###",
      },
    ],
  },
  {
    metric: [
      {
        name: "sum__lpu_id",
        value: 48,
      },
    ],
    groupby: [
      {
        name: "lpu_level3_short_name",
        value: "###",
      },
    ],
  },
];
export const aggregationResult = {
  "Абинский район": {
    metric: {
      name: "sum__lpu_id",
      value: "389.0",
    },
    center: [44.885214149999996, 38.28821395083526],
  },
};
export const placemarkData = [
  {
    area_name: "Абинский район",
    center: [44, 38],
    points: [placemark],
    polygon,
  },
];
export const centers = [
  {
    bounds: [[44, 38]],
    coordinates: [44, 38],
    events: {
      add: () => {},
    },
    options: {
      preset: "islands#violetStretchyIcon",
    },
    properties: {
      balloonContentBody: `\n    <table class=\"balloon-content-custom\">\n      <thead>\n        <tr><th style=\"text-align: center; padding: 4px; padding-right: 10px; font-weight: bold;\">lpu_level3_short_name</th><th style=\"text-align: center; padding: 4px; padding-right: 10px; font-weight: bold;\">Полное имя метрики</th></tr>\n      </thead>\n      <tbody>\n        \n  
        <tr class=\"row-undefined--341\">\n          <td style=\"text-align: center; padding: 4px; border: 1px solid #ddd;\">undefined</td><td style=\"text-align: center; padding: 4px; border: 
1px solid #ddd;\">###</td><td style=\"text-align: center; padding: 4px; border: 1px solid #ddd;\">341</td>\n          </tr>\n          \n          <tr class=\"row-undefined--48\">\n          <td style=\"text-align: center; padding: 4px; border: 1px solid #ddd;\">undefined</td><td style=\"text-align: center; padding: 4px; border: 1px solid #ddd;\">###</td><td style=\"text-align: center; padding: 4px; border: 1px solid #ddd;\">48</td>\n          </tr>\n          \n      </tbody>\n    </table>\n  `,
      balloonContentHead:
        '<tr><th style="text-align: center; padding: 4px; padding-right: 10px; font-weight: bold;">lpu_level3_short_name</th><th style="text-align: center; padding: 4px; padding-right: 10px; font-weight: bold;">Полное имя метрики</th></tr>',
      balloonContentRow:
        '<tr class="row--341"><td style="text-align: center; padding: 4px; border: 1px solid #ddd;">###</td><td style="text-align: center; padding: 4px; border: 1px solid #ddd;">341</td></tr>',
      clusterCaption: "<strong>No name</strong>",
      hintContent: "No name",
      iconContent: "389.0",
      map_icon: [null],
      placemarkData: {
        dateFormatter: [Function],
        dateTimeColumns: ["_calendar", "__timestamp"],
        groupby: [
          {
            name: "lpu_level3_short_name",
            value: "###",
          },
        ],
        hintContent: "No name",
        multyplaied: [
          {
            groupby: [
              {
                name: "lpu_level3_short_name",
                value: "###",
              },
            ],
            metric: [
              {
                name: "sum__lpu_id",
                value: 341,
              },
            ],
          },
          {
            groupby: [
              {
                name: "lpu_level3_short_name",
                value: "###",
              },
            ],
            metric: [
              {
                name: "sum__lpu_id",
                value: 48,
              },
            ],
          },
        ],
        position: [44.885214149999996, 38.28821395083526],
        row: [
          {
            name: "lpu_level3_short_name",
            value: "###",
          },
          {
            name: "sum__lpu_id",
            value: 341,
          },
        ],
        verbose_names: {
          __timestamp: "Time",
          _appointment_type: "_appointment_type",
          _calendar: "_calendar",
          _event_name: "_event_name",
          _record_hash_key: "_record_hash_key",
          appointment_id: "appointment_id",
          appointment_reg_source_name: "appointment_reg_source_name",
          appointment_visit_date: "appointment_visit_date",
          appointment_visit_time: "appointment_visit_time",
          avg__geo_x: "avg__geo_x",
          avg__geo_y: "avg__geo_y",
          avg__lpu_id: "avg__lpu_id",
          avg__patient_age: "avg__patient_age",
          avg__speciality_code: "avg__speciality_code",
          count: "COUNT(*)",
          district_name: "district_name",
          doctor_id: "doctor_id",
          doctor_name: "Имя доктора",
          geo_x: "Гео Х",
          geo_y: "Гео Y",
          lpu_id: "lpu_id",
          lpu_level1_short_name: "lpu_level1_short_name",
          lpu_level2_short_name: "lpu_level2_short_name",
          lpu_level3_short_name: "lpu_level3_short_name",
          map_icon: "map_icon",
          patient_age: "patient_age",
          patient_id: "patient_id",
          patient_name: "patient_name",
          speciality_code: "Имя точки",
          speciality_name: "Специальное имя",
          sum__geo_x: "sum__geo_x",
          sum__geo_y: "sum__geo_y",
          sum__lpu_id: "Полное имя метрики",
          sum__patient_age: "sum__patient_age",
          sum__speciality_code: "sum__speciality_code",
        },
      },
    },
  },
];
