"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { bookmarks } from "@/lib/db/schema";

export async function createBookmark(formData: FormData) {
  const rawUrl = formData.get("url");

  if (typeof rawUrl !== "string") {
    throw new Error("url is required");
  }

  const url = rawUrl.trim();

  if (url.length === 0) {
    throw new Error("url cannot be empty");
  }

  if (url.length > 2048) {
    throw new Error("url is too long");
  }

  try {
    new URL(url);
  } catch {
    throw new Error("url is not a valid URL");
  }

  await db.insert(bookmarks).values({
    id: crypto.randomUUID(),
    url,
    createdAt: new Date(),
  });

  revalidatePath("/");
  redirect("/");
}