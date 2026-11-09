import { z } from "zod";

export const downvoteReasonSchema = z
  .string()
  .trim()
  .min(20, "Please explain the concern in at least 20 characters.")
  .max(500, "Keep the reason to 500 characters or fewer.");
