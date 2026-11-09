import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3247";
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/admin/", "/claim/", "/sign-in", "/auth/", "/api/"] }], sitemap: `${baseUrl}/sitemap.xml` };
}
