import fs from "fs";
import path from "path";
import zlib from "zlib";
import type { ModelInfo, Movie, MoviePage, MovieQuery, Recommendation, SortKey } from "@/lib/types";

type Store = {
  movies: Movie[];
  byId: Map<number, Movie>;
  hay: Map<number, string>;
  neighbors: Map<number, [number, number][]>;
  genres: string[];
  model: ModelInfo;
};

const PREFERRED_GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Science Fiction",
  "Thriller",
  "War",
  "Western",
];

const STARTER_TITLES = [
  "Inception",
  "Spirited Away",
  "The Godfather",
  "Parasite",
  "Lady Bird",
  "Get Out",
];

let store: Store | null = null;

function readGzipJson<T>(filename: string): T {
  const file = path.join(process.cwd(), "data", filename);
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8")) as T;
}

function loadStore(): Store {
  if (store) return store;
  const movies = readGzipJson<Movie[]>("movies.json.gz");
  const neighborFile = readGzipJson<Record<string, [number, number][]>>("neighbors.json.gz");
  const model = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "model.json"), "utf8"),
  ) as ModelInfo;
  const byId = new Map<number, Movie>();
  const hay = new Map<number, string>();
  const genreCounts = new Map<string, number>();

  for (const movie of movies) {
    byId.set(movie.id, movie);
    hay.set(
      movie.id,
      [movie.title, movie.director, ...movie.cast.map((person) => person.name)].join(" ").toLowerCase(),
    );
    for (const genre of movie.genres) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
  }

  const genres = PREFERRED_GENRES.filter((genre) => (genreCounts.get(genre) ?? 0) >= 40);
  const neighbors = new Map<number, [number, number][]>();
  for (const [id, picks] of Object.entries(neighborFile)) {
    neighbors.set(Number(id), picks);
  }

  store = { movies, byId, hay, neighbors, genres, model };
  return store;
}

export function getModel() {
  return loadStore().model;
}

export function getGenres() {
  return loadStore().genres;
}

export function getStarters() {
  const { movies } = loadStore();
  const wanted = new Map(STARTER_TITLES.map((title) => [title.toLowerCase(), title]));
  const best = new Map<string, Movie>();
  for (const movie of movies) {
    const key = movie.title.toLowerCase();
    if (!wanted.has(key)) continue;
    const current = best.get(key);
    if (!current || movie.votes > current.votes) best.set(key, movie);
  }
  return STARTER_TITLES.map((title) => best.get(title.toLowerCase())).filter((movie): movie is Movie => Boolean(movie));
}

function parseSort(sort: string): SortKey {
  if (sort === "rating" || sort === "newest") return sort;
  return "popular";
}

// Shrink tiny vote totals toward a typical score so a 10/10 from 30 ratings
// does not outrank a film thousands of people scored at 8.6.
function weightedRating(movie: Movie) {
  const priorVotes = 800;
  const priorMean = 6.9;
  return (movie.votes * movie.rating + priorVotes * priorMean) / (movie.votes + priorVotes);
}

function sortMovies(movies: Movie[], sort: SortKey) {
  const copy = movies.slice();
  if (sort === "rating") {
    copy.sort((a, b) => weightedRating(b) - weightedRating(a) || b.votes - a.votes);
    return copy;
  }
  if (sort === "newest") {
    copy.sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || b.votes - a.votes);
    return copy;
  }
  // The dump's popularity field is a short-lived trending score, so the default
  // shelf follows how many people actually rated the film.
  copy.sort((a, b) => b.votes - a.votes || b.rating - a.rating);
  return copy;
}

export function queryMovies(input: Partial<MovieQuery>): MoviePage {
  const data = loadStore();
  const q = (input.q ?? "").trim().toLowerCase().slice(0, 80);
  const genre = data.genres.includes(input.genre ?? "") ? (input.genre ?? "") : "";
  const sort = parseSort(input.sort ?? "popular");
  const pageSize = Math.min(48, Math.max(1, Math.floor(input.pageSize ?? 24)));
  const page = Math.max(1, Math.floor(input.page ?? 1));

  let rows = data.movies;
  if (genre) rows = rows.filter((movie) => movie.genres.includes(genre));
  if (q) rows = rows.filter((movie) => data.hay.get(movie.id)?.includes(q));
  rows = sortMovies(rows, sort);

  const start = (page - 1) * pageSize;
  return {
    movies: rows.slice(start, start + pageSize),
    total: rows.length,
    page,
    pageSize,
  };
}

function reasonsFor(source: Movie, other: Movie) {
  const reasons: string[] = [];
  if (source.director && source.director === other.director) {
    reasons.push(`Same director, ${source.director}`);
  }
  const sharedCast = source.cast
    .map((person) => person.name)
    .filter((name) => other.cast.some((person) => person.name === name));
  if (sharedCast.length) reasons.push(`Shared cast: ${sharedCast.slice(0, 2).join(", ")}`);
  const sharedGenres = source.genres.filter((genre) => other.genres.includes(genre));
  if (sharedGenres.length) reasons.push(sharedGenres.slice(0, 3).join(" · "));
  return reasons.slice(0, 2);
}

export function getMovie(id: number) {
  return loadStore().byId.get(id) ?? null;
}

export function getRecommendations(id: number): Recommendation[] {
  const data = loadStore();
  const source = data.byId.get(id);
  if (!source) return [];
  const picks = data.neighbors.get(id) ?? [];
  const recommendations: Recommendation[] = [];
  for (const [otherId, score] of picks) {
    const movie = data.byId.get(otherId);
    if (!movie) continue;
    recommendations.push({ movie, score, reasons: reasonsFor(source, movie) });
  }
  return recommendations;
}

export function randomMovieId() {
  const { movies } = loadStore();
  const pool = movies.slice(0, Math.min(800, movies.length));
  const movie = pool[Math.floor(Math.random() * pool.length)];
  return movie?.id ?? null;
}
