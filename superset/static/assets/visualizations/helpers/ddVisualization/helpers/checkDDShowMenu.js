export const checkDDShowMenu = (hierarchy, formData) => {
  const fieldsNames = new Set(formData.url_drilldowns?.map((elem) => elem.field) || []);

  return !!fieldsNames.size || checkDDHierarchyExist(hierarchy, formData);
};

export const checkDDHierarchyExist = (hierarchy, formData) => {
  const filteredHierarchy = hierarchy.filter((hierarchy) => !formData?.disabled_hierarchy.includes(hierarchy.id));
  const hierarchyFirstNames = new Set(filteredHierarchy.map((el) => el.columns[0].name));
  if (formData.viz_type === "dist_bar") {
    return formData?.columns.some((el) => hierarchyFirstNames.has(el));
  } else {
    return formData?.groupby.some((el) => hierarchyFirstNames.has(el));
  }
};

export const checkMetric = (slice, payload) => {
  const metricsSet = new Set(
    slice.formData?.metrics.map((metric) => (typeof metric === "string" ? metric : metric?.label)) || []
  );

  if (metricsSet.has("count")) {
    metricsSet.add("COUNT(*)");
  }

  return (col) => {
    if(typeof  payload.data.columns[col] === "string") {
      return payload.data.columns[col];
    } else {
      return payload.data.columns[col].find((el) => metricsSet.has(el));
    }
  };
};
