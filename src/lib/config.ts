export const appConfig = {
  brand: process.env.NEXT_PUBLIC_BRAND_NAME ?? "BeforeBig",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3247",
  trafficFeatureEnabled: process.env.TRAFFIC_FEATURE_ENABLED === "true",
  paymentsFeatureEnabled: process.env.PAYMENTS_FEATURE_ENABLED === "true",
  emailFeatureEnabled: process.env.EMAIL_FEATURE_ENABLED === "true",
  submissionPersistenceEnabled: process.env.SUBMISSION_PERSISTENCE_ENABLED === "true",
  authDevMagicLinkEnabled: process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_MAGIC_LINK_ENABLED === "true",
};
