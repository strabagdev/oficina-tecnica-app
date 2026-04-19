if (process.env.NODE_ENV === "development" && typeof performance !== "undefined") {
  const measure = performance.measure.bind(performance);

  performance.measure = ((measureName, startOrOptions, endMark) => {
    try {
      if (endMark === undefined) {
        return measure(measureName, startOrOptions);
      }

      return measure(measureName, startOrOptions, endMark);
    } catch (error) {
      if (
        error instanceof TypeError &&
        typeof startOrOptions === "object" &&
        startOrOptions !== null &&
        String(error.message).includes("negative time stamp")
      ) {
        const options = { ...startOrOptions };

        if (typeof options.start === "number" && options.start < 0) {
          options.start = 0;
        }

        if (typeof options.end === "number" && options.end < 0) {
          options.end = 0;
        }

        if (
          typeof options.start === "number" &&
          typeof options.end === "number" &&
          options.end < options.start
        ) {
          options.end = options.start;
        }

        return measure(measureName, options);
      }

      throw error;
    }
  }) as Performance["measure"];
}
