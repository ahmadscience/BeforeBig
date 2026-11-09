"use server";

import { redirect } from "next/navigation";
import { revokeCurrentSession } from "@/lib/auth";

export async function signOut() {
  await revokeCurrentSession();
  redirect("/");
}
