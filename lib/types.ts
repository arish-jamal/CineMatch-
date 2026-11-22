export type CastMember = {
  name: string;
  character: string;
};

export type Movie = {
  id: number;
  title: string;
  year: number | null;
  rating: number;
  votes: number;
  runtime: number;
  genres: string[];
  overview: string;
  tagline: string;
  cast: CastMember[];
  director: string;
  poster: string;
  backdrop: string;
  language: string;
  popularity: number;
};

export type SortKey = "popular" | "rating" | "newest";

export type MovieQuery = {
  q: string;
  genre: string;
  sort: SortKey;
  page: number;
  pageSize: number;
};

export type MoviePage = {
  movies: Movie[];
  total: number;
  page: number;
  pageSize: number;
};

export type Recommendation = {
  movie: Movie;
  score: number;
  reasons: string[];
};

export type ModelInfo = {
  algorithm: string;
  features: string[];
  maxFeatures: number;
  ngramRange: number[];
  neighbors: number;
  movieCount: number;
  withCast: number;
  minVotes: number;
};
