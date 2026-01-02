const { query } = require("express-validator");

const validateDashboardPeriod = [
  query("period")
    .optional()
    .isIn(["7d", "30d", "90d", "1y", "custom"])
    .withMessage("Period must be 7d, 30d, 90d, 1y, or custom"),

  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date")
    .custom((value, { req }) => {
      if (req.query.period === "custom" && !value) {
        throw new Error("Start date is required for custom period");
      }
      return true;
    }),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO 8601 date")
    .custom((value, { req }) => {
      if (req.query.startDate && !value) {
        throw new Error("End date is required when start date is provided");
      }
      return true;
    }),
];

const validateSalesPerformanceQuery = [
  query("period")
    .optional()
    .isIn(["7d", "30d", "90d", "1y", "today", "yesterday", "week", "month", "quarter", "year", "custom"])
    .withMessage("Period must be 7d, 30d, 90d, 1y, today, yesterday, week, month, quarter, year, or custom"),

  query("metric")
    .optional()
    .isIn(["revenue", "orders", "customers", "aov"])
    .withMessage("Metric must be revenue, orders, customers, or aov"),

  query("groupBy")
    .optional()
    .isIn(["day", "week", "month", "quarter", "year"])
    .withMessage("Group by must be day, week, month, quarter, or year"),

  query("compareToPrevious")
    .optional()
    .isBoolean()
    .withMessage("compareToPrevious must be a boolean"),
];

module.exports = {
  validateDashboardPeriod,
  validateSalesPerformanceQuery,
};
