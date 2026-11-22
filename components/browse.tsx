"use client";

import { Search, Shuffle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MovieCard } from "@/components/movie-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Movie, MoviePage, SortKey } from "@/lib/types";

type BrowseProps = {
  initial: MoviePage;
  genres: string[];
  starters: Movie[];
  initialQuery: { q: string; genre: string; sort: SortKey };
};

const SORTS: { id: SortKey; label: string }[] = [
  { id: "popular", label: "Most rated" },
  { id: "rating", label: "Top rated" },
  { id: "newest", label: "Newest" },
];

export function Browse({ initial, genres, starters, initialQuery }: BrowseProps) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery.q);
  const [genre, setGenre] = useState(initialQuery.genre);
  const [sort, setSort] = useState<SortKey>(initialQuery.sort);
  const [movies, setMovies] = useState(initial.movies);
  const [total, setTotal] = useState(initial.total);
  const [page, setPage] = useState(initial.page);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [surprising, setSurprising] = useState(false);
  const skipFirst = useRef(true);
  const requestId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams();
      const query = q.trim();
      if (query) params.set("q", query);
      if (genre) params.set("genre", genre);
      if (sort !== "popular") params.set("sort", sort);
      const next = params.toString();
      router.replace(next ? `/?${next}` : "/", { scroll: false });
      void loadPage(1, true);
    }, 180);
    return () => window.clearTimeout(handle);
    // loadPage closes over the latest filters via the effect deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, genre, sort]);

  async function loadPage(nextPage: number, replace: boolean) {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      const query = q.trim();
      if (query) params.set("q", query);
      if (genre) params.set("genre", genre);
      if (sort !== "popular") params.set("sort", sort);
      params.set("page", String(nextPage));
      params.set("pageSize", "24");
      const response = await fetch(`/api/movies?${params.toString()}`);
      if (!response.ok) throw new Error("The catalog did not respond.");
      const data = (await response.json()) as MoviePage;
      if (id !== requestId.current) return;
      setMovies((current) => (replace ? data.movies : [...current, ...data.movies]));
      setTotal(data.total);
      setPage(data.page);
    } catch (cause) {
      if (id !== requestId.current) return;
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  async function surprise() {
    setSurprising(true);
    try {
      const response = await fetch("/api/random");
      if (!response.ok) throw new Error("Could not pick a film.");
      const data = (await response.json()) as { id: number };
      router.push(`/movie/${data.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not pick a film.");
      setSurprising(false);
    }
  }

  const shown = movies.length;
  const hasMore = shown < total;

  return (
    <section className="mt-8" aria-label="Film catalog">
      <div className="sticky top-14 z-30 -mx-4 border-b border-border/70 bg-background/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={q}
              onValueChange={(value) => setQ(value)}
              placeholder="Search a title, director, or actor"
              aria-label="Search films"
              className="h-11 rounded-full bg-card pr-4 pl-10 text-base md:text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-full bg-muted p-1" role="group" aria-label="Sort films">
              {SORTS.map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  size="sm"
                  variant={sort === option.id ? "default" : "ghost"}
                  className="rounded-full px-3"
                  aria-pressed={sort === option.id}
                  onClick={() => setSort(option.id)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => void surprise()} disabled={surprising}>
              <Shuffle />
              {surprising ? "Picking" : "Surprise"}
            </Button>
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Button
            type="button"
            size="sm"
            variant={genre === "" ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setGenre("")}
          >
            All
          </Button>
          {genres.map((name) => (
            <Button
              key={name}
              type="button"
              size="sm"
              variant={genre === name ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setGenre((current) => (current === name ? "" : name))}
            >
              {name}
            </Button>
          ))}
        </div>
      </div>

      {starters.length > 0 && !q && !genre ? (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Start from</p>
          {starters.map((movie) => (
            <Button
              key={movie.id}
              variant="outline"
              size="sm"
              className="rounded-full"
              nativeButton={false}
              render={<Link href={`/movie/${movie.id}`} />}
            >
              {movie.title}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {loading && shown === 0
            ? "Searching the catalog…"
            : `${shown.toLocaleString()} of ${total.toLocaleString()} films`}
        </p>
        {loading && shown > 0 ? <p className="text-xs text-muted-foreground">Updating the shelf…</p> : null}
      </div>

      {error ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <p>{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadPage(page, true)}>
            Retry
          </Button>
        </div>
      ) : null}

      {shown === 0 && !loading ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <p className="font-heading text-2xl">No films match that.</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Try a title, a director, or another genre. The shelf only keeps films with a poster and a real summary.
          </p>
          <Button
            type="button"
            className="mt-5 rounded-full"
            onClick={() => {
              setQ("");
              setGenre("");
              setSort("popular");
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <ul
          className={`mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 ${loading ? "opacity-70" : ""}`}
        >
          {movies.map((movie) => (
            <li key={movie.id}>
              <MovieCard movie={movie} />
            </li>
          ))}
        </ul>
      )}

      {hasMore ? (
        <div className="mt-8 flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="rounded-full px-6"
            disabled={loading}
            onClick={() => void loadPage(page + 1, false)}
          >
            {loading ? "Loading…" : "Show more"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
