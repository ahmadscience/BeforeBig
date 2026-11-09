module.exports = {
  ci: {
    collect: {
      startServerCommand: "node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3247",
      startServerReadyPattern: "Ready in",
      url: [
        "http://127.0.0.1:3247/",
        "http://127.0.0.1:3247/today",
        "http://127.0.0.1:3247/submit",
      ],
      // Use a median sample so one cold-browser outlier does not decide the budget.
      numberOfRuns: 3,
      settings: {
        chromeFlags: "--headless=new --no-sandbox",
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.9, aggregationMethod: "median" }],
        "categories:accessibility": ["error", { minScore: 0.95, aggregationMethod: "pessimistic" }],
        "categories:best-practices": ["error", { minScore: 0.95, aggregationMethod: "pessimistic" }],
        "categories:seo": ["error", { minScore: 0.95, aggregationMethod: "pessimistic" }],
        "largest-contentful-paint": ["error", { maxNumericValue: 2500, aggregationMethod: "median" }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1, aggregationMethod: "median" }],
        "total-blocking-time": ["error", { maxNumericValue: 200, aggregationMethod: "median" }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci",
    },
  },
};
