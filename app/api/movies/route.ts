import { NextRequest, NextResponse } from "next/server";
import { queryMovies } from "@/lib/catalog";
import type { SortKey } from "@/lib/types";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const sortParam = params.get("sort") ?? "popular";
  const sort: SortKey = sortParam === "rating" || sortParam === "newest" ? sortParam : "popular";
  const page = Number(params.get("page") ?? "1");
  const pageSize = Number(params.get("pageSize") ?? "24");
  const result = queryMovies({
    q: params.get("q") ?? "",
    genre: params.get("genre") ?? "",
    sort,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 24,
  });
  return NextResponse.json(result);
}
