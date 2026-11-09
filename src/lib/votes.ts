import type { ProductStatus } from "@/lib/types";

export function productAcceptsVotes(status: ProductStatus) {
  return status === "public" || status === "approved";
}
