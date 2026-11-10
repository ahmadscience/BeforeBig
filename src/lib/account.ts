import { z } from "zod";
export const accountLimits = { freshMs: 15 * 60_000, rows: 5000, exportBytes: 2 * 1024 * 1024 } as const;
export const deletionSchema = z.object({
  confirmation: z.literal("DELETE", { error: "Type DELETE to confirm account deletion." }),
  understood: z.literal(true, { error: "Confirm that you understand what will be removed and retained." }),
  products: z.enum(["remove", "keep"]),
});
export class AccountError extends Error { constructor(message: string, public status = 422) { super(message); } }
export type AccountState = { error?: string; message?: string };
