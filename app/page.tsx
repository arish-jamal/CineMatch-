import { Suspense } from "react";
import { Browse } from "@/components/browse";
import { getGenres, getModel, getStarters, queryMovies } from "@/lib/catalog";
import type { SortKey } from "@/lib/types";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function parseSort(value: string): SortKey {
  if (value === "rating" || value === "newest") return value;
  return "popular";
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const initialQuery = {
    q: one(params.q),
    genre: one(params.genre),
    sort: parseSort(one(params.sort)),
  };
  const initial = queryMovies({ ...initialQuery, page: 1, pageSize: 24 });
  const model = getModel();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6">
      <section className="max-w-3xl pt-10 sm:pt-14">
        <p className="text-xs tracking-[0.18em] text-primary uppercase">Content-based recommender</p>
        <h1 className="mt-3 font-heading text-4xl leading-[1.05] tracking-tight text-balance sm:text-6xl">
          The next film is already sitting next to one you love.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Hover a poster for the summary and the cast. Open a film and MovieMatch ranks the nearest{" "}
          {model.movieCount.toLocaleString()} titles with a weighted TF-IDF model of plot, genre, keywords, director, and cast.
        </p>
      </section>
      <Suspense fallback={<p className="mt-8 text-sm text-muted-foreground">Loading the shelf…</p>}>
        <Browse
          initial={initial}
          genres={getGenres()}
          starters={getStarters()}
          initialQuery={initialQuery}
        />
      </Suspense>
    </main>
  );
}
