import { NextResponse } from "next/server";
import { randomMovieId } from "@/lib/catalog";

export async function GET() {
  const id = randomMovieId();
  if (!id) return NextResponse.json({ error: "Catalog is empty." }, { status: 404 });
  return NextResponse.json({ id });
}
