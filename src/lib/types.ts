export type ProductStatus = "draft" | "public" | "approved" | "suspended" | "discontinued";
export type VerificationStatus = "unverified" | "domain_verified" | "founder_verified";

export type Product = {
  /** Distinguishes bundled examples from records read from the configured database. */
  source?: "sample" | "database";
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  websiteUrl: string;
  category: string;
  stage: string;
  status: ProductStatus;
  verificationStatus: VerificationStatus;
  bestFor: string;
  notBestFor: string;
  price: string;
  activeBacking: number;
  lifetimeBacking: number;
  launchedAt: string;
  tags: string[];
  platforms?: string[];
  licenseType?: "unknown" | "open-source" | "proprietary";
  pricingModel?: "unknown" | "free" | "freemium" | "paid";
  sourceUrl?: string;
  accent: "mint" | "coral" | "gold" | "blue";
  stats: {
    upvotes: number;
    downvotes: number;
    views: number;
    qualifiedVisits: number;
    reviews: number;
  };
  viewerHasVoted?: boolean;
  viewerHasDownvoted?: boolean;
  viewerDownvoteStatus?: "pending" | "approved";
};
