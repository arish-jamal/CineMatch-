#!/usr/bin/env python3
"""Build Marquee's content-based movie catalog.

Reads the public TMDB movie metadata dump and IMDb name/crew/principal files,
keeps films that have a poster, a real summary, and enough ratings, then fits a
TF-IDF model over plot, genres, keywords, director, and cast. Cosine similarity
on that model becomes the recommendation list shipped with the app.

Source files are not committed. Pass their paths, or place them in /tmp/movie-src.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import json
import sys
import time
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize

MIN_VOTES = 25
MIN_OVERVIEW = 80
NEIGHBORS = 12
CANDIDATES = 18
CAST_LIMIT = 5

csv.field_size_limit(10_000_000)

PLACEHOLDER_OVERVIEWS = {
    "no overview",
    "no overview found",
    "n/a",
    "na",
    "none",
    "null",
    "plot unknown",
    "add a plot",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    root = Path("/tmp/movie-src")
    parser.add_argument("--tmdb", type=Path, default=root / "tmdb.csv")
    parser.add_argument("--crew", type=Path, default=root / "title.crew.tsv.gz")
    parser.add_argument("--principals", type=Path, default=root / "title.principals.tsv.gz")
    parser.add_argument("--names", type=Path, default=root / "name.basics.tsv.gz")
    parser.add_argument("--out", type=Path, default=Path("data"))
    parser.add_argument(
        "--reuse-catalog",
        action="store_true",
        help="Recompute neighbors from data/movies.json.gz instead of rebuilding cast.",
    )
    return parser.parse_args()


def require(path: Path) -> None:
    if not path.exists():
        sys.exit(f"Missing {path}. Download the source files described in the README.")


def parse_character(raw: str) -> str:
    raw = (raw or "").strip()
    if not raw or raw == r"\N":
        return ""
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return ""
    if isinstance(data, list) and data:
        text = str(data[0]).strip()
        return text if text and text.lower() != "null" else ""
    return ""


def load_movies(path: Path) -> list[dict]:
    movies: list[dict] = []
    seen_ids: set[int] = set()
    with path.open(newline="", encoding="utf-8", errors="replace") as handle:
        for row in csv.DictReader(handle):
            if str(row.get("adult") or "").strip().lower() in {"true", "1", "yes"}:
                continue
            if (row.get("status") or "").strip() != "Released":
                continue
            title = (row.get("title") or "").strip()
            overview = (row.get("overview") or "").strip()
            poster = (row.get("poster_path") or "").strip()
            if not title or len(overview) < MIN_OVERVIEW:
                continue
            if overview.lower() in PLACEHOLDER_OVERVIEWS:
                continue
            if not poster.startswith("/") or not poster.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
                continue
            try:
                votes = int(float(row.get("vote_count") or 0))
                rating = float(row.get("vote_average") or 0)
                popularity = float(row.get("popularity") or 0)
                runtime = int(float(row.get("runtime") or 0))
                movie_id = int(row["id"])
            except (TypeError, ValueError):
                continue
            if votes < MIN_VOTES or movie_id in seen_ids:
                continue
            if runtime and (runtime < 40 or runtime > 400):
                continue
            year_text = (row.get("release_date") or "")[:4]
            year = int(year_text) if year_text.isdigit() else None
            genres = [part.strip() for part in (row.get("genres") or "").split(",") if part.strip()][:6]
            keywords = [part.strip() for part in (row.get("keywords") or "").split(",") if part.strip()][:12]
            backdrop = (row.get("backdrop_path") or "").strip()
            if not backdrop.startswith("/"):
                backdrop = ""
            tagline = (row.get("tagline") or "").strip()
            if len(tagline) > 160:
                tagline = ""
            imdb_id = (row.get("imdb_id") or "").strip()
            if not imdb_id.startswith("tt"):
                imdb_id = ""
            seen_ids.add(movie_id)
            movies.append(
                {
                    "id": movie_id,
                    "imdb": imdb_id,
                    "title": title,
                    "year": year,
                    "rating": round(rating, 1),
                    "votes": votes,
                    "runtime": runtime,
                    "genres": genres,
                    "keywords": keywords,
                    "overview": overview,
                    "tagline": tagline,
                    "poster": poster,
                    "backdrop": backdrop,
                    "language": (row.get("original_language") or "").strip() or "en",
                    "popularity": round(popularity, 3),
                    "director_id": "",
                    "cast_ids": [],
                }
            )
    print(f"kept {len(movies):,} films", flush=True)
    return movies


def attach_directors(path: Path, imdb_to_indexes: dict[str, list[int]], movies: list[dict]) -> None:
    found = 0
    with gzip.open(path, "rt", encoding="utf-8", errors="replace") as handle:
        next(handle, None)
        for line in handle:
            tconst, _, rest = line.partition("\t")
            if tconst not in imdb_to_indexes:
                continue
            directors, _, _writers = rest.partition("\t")
            directors = directors.strip()
            if not directors or directors == r"\N":
                continue
            director_id = directors.split(",", 1)[0].strip()
            if not director_id or director_id == r"\N":
                continue
            for index in imdb_to_indexes[tconst]:
                movies[index]["director_id"] = director_id
                found += 1
    print(f"directors matched for {found:,} films", flush=True)


def attach_cast(path: Path, imdb_to_indexes: dict[str, list[int]], movies: list[dict]) -> None:
    buckets: dict[int, list[tuple[int, str, str]]] = {}
    scanned = 0
    started = time.time()
    with gzip.open(path, "rt", encoding="utf-8", errors="replace") as handle:
        next(handle, None)
        for line in handle:
            scanned += 1
            if scanned % 2_000_000 == 0:
                print(f"  scanned {scanned:,} principal rows", flush=True)
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 6:
                continue
            tconst, ordering, nconst, category, _job, characters = parts[:6]
            indexes = imdb_to_indexes.get(tconst)
            if not indexes or category not in {"actor", "actress"}:
                continue
            try:
                order = int(ordering)
            except ValueError:
                continue
            if order < 1 or order > 8:
                continue
            character = parse_character(characters)
            for index in indexes:
                buckets.setdefault(index, []).append((order, nconst, character))
    for index, rows in buckets.items():
        rows.sort(key=lambda item: item[0])
        chosen: list[tuple[int, str, str]] = []
        seen: set[str] = set()
        for order, nconst, character in rows:
            if nconst in seen:
                continue
            seen.add(nconst)
            chosen.append((order, nconst, character))
            if len(chosen) == CAST_LIMIT:
                break
        movies[index]["cast_ids"] = chosen
    print(
        f"cast lists for {len(buckets):,} films in {time.time() - started:.1f}s",
        flush=True,
    )


def attach_names(path: Path, movies: list[dict]) -> None:
    needed: set[str] = set()
    for movie in movies:
        if movie["director_id"]:
            needed.add(movie["director_id"])
        for _order, nconst, _character in movie["cast_ids"]:
            needed.add(nconst)
    print(f"resolving {len(needed):,} names", flush=True)
    names: dict[str, str] = {}
    with gzip.open(path, "rt", encoding="utf-8", errors="replace") as handle:
        next(handle, None)
        for line in handle:
            nconst, _, rest = line.partition("\t")
            if nconst not in needed:
                continue
            primary, _, _tail = rest.partition("\t")
            primary = primary.strip()
            if primary and primary != r"\N":
                names[nconst] = primary
            if len(names) == len(needed):
                break
    for movie in movies:
        movie["director"] = names.get(movie["director_id"], "")
        cast = []
        for _order, nconst, character in movie["cast_ids"]:
            name = names.get(nconst)
            if not name:
                continue
            cast.append({"name": name, "character": character})
        movie["cast"] = cast
    print(f"resolved {len(names):,} names", flush=True)


WEIGHTS = {
    "overview": 0.52,
    "metadata": 0.20,
    "director": 0.18,
    "cast": 0.10,
}


def token_name(name: str) -> str:
    cleaned = "".join(ch if ch.isalnum() else "_" for ch in name.casefold())
    return "_".join(part for part in cleaned.split("_") if part)


def fit_block(texts: list[str], **kwargs: object):
    vectorizer = TfidfVectorizer(dtype=np.float32, **kwargs)  # type: ignore[arg-type]
    matrix = vectorizer.fit_transform(texts)
    return normalize(matrix), len(vectorizer.vocabulary_)


def recommend(movies: list[dict]) -> dict[str, list[list[float | int]]]:
    print("fitting weighted TF-IDF blocks", flush=True)
    started = time.time()
    overview_matrix, overview_vocab = fit_block(
        [f"{movie['title']} {movie['overview']}" for movie in movies],
        stop_words="english",
        max_features=25_000,
        ngram_range=(1, 2),
        min_df=2,
        max_df=0.7,
        sublinear_tf=True,
    )
    metadata_matrix, metadata_vocab = fit_block(
        [
            f"{' '.join(movie['genres'])} {' '.join(movie['genres'])} {' '.join(movie.get('keywords') or [])}"
            for movie in movies
        ],
        token_pattern=r"(?u)\b\w[\w'-]+\b",
        min_df=2,
        sublinear_tf=True,
    )
    director_matrix, director_vocab = fit_block(
        [token_name(movie.get("director") or "") for movie in movies],
        token_pattern=r"(?u)\b\w+\b",
        min_df=1,
    )
    cast_matrix, cast_vocab = fit_block(
        [" ".join(token_name(person["name"]) for person in movie["cast"]) for movie in movies],
        token_pattern=r"(?u)\b\w+\b",
        min_df=1,
        sublinear_tf=True,
    )
    print(
        "vocabularies "
        f"plot={overview_vocab:,} metadata={metadata_vocab:,} "
        f"directors={director_vocab:,} cast={cast_vocab:,} "
        f"in {time.time() - started:.1f}s",
        flush=True,
    )
    blocks = (
        (WEIGHTS["overview"], overview_matrix),
        (WEIGHTS["metadata"], metadata_matrix),
        (WEIGHTS["director"], director_matrix),
        (WEIGHTS["cast"], cast_matrix),
    )
    count = overview_matrix.shape[0]
    titles = ["".join(ch for ch in movie["title"].casefold() if ch.isalnum()) for movie in movies]
    neighbors: dict[str, list[list[float | int]]] = {}
    batch_size = 400
    keep = min(CANDIDATES, count - 1)
    started = time.time()
    for start in range(0, count, batch_size):
        stop = min(start + batch_size, count)
        sims = None
        for weight, matrix in blocks:
            block = (matrix[start:stop] @ matrix.T).toarray()
            sims = block * weight if sims is None else sims + block * weight
        assert sims is not None
        np.nan_to_num(sims, copy=False, nan=0.0, posinf=0.0, neginf=0.0)
        for offset, global_index in enumerate(range(start, stop)):
            sims[offset, global_index] = -1.0
        chosen = np.argpartition(sims, -keep, axis=1)[:, -keep:]
        chosen_scores = np.take_along_axis(sims, chosen, axis=1)
        order = np.argsort(-chosen_scores, axis=1)
        top_index = np.take_along_axis(chosen, order, axis=1)
        top_score = np.take_along_axis(chosen_scores, order, axis=1)
        for offset, global_index in enumerate(range(start, stop)):
            picks: list[list[float | int]] = []
            own_title = titles[global_index]
            for column in range(keep):
                other = int(top_index[offset, column])
                score = float(top_score[offset, column])
                if score <= 0 or titles[other] == own_title:
                    continue
                picks.append([movies[other]["id"], round(score, 4)])
                if len(picks) == NEIGHBORS:
                    break
            neighbors[str(movies[global_index]["id"])] = picks
        done = stop
        elapsed = time.time() - started
        rate = done / elapsed if elapsed else 0
        remaining = (count - done) / rate if rate else 0
        print(
            f"  neighbors {done:,}/{count:,}  {elapsed:.0f}s  ~{remaining:.0f}s left",
            flush=True,
        )
    return neighbors


def public_movie(movie: dict) -> dict:
    payload = {
        "id": movie["id"],
        "title": movie["title"],
        "year": movie["year"],
        "rating": movie["rating"],
        "votes": movie["votes"],
        "runtime": movie["runtime"],
        "genres": movie["genres"],
        "overview": movie["overview"],
        "tagline": movie["tagline"],
        "cast": movie["cast"],
        "director": movie.get("director") or "",
        "poster": movie["poster"],
        "backdrop": movie["backdrop"],
        "language": movie["language"],
        "popularity": movie["popularity"],
    }
    return payload


def write_gzip_json(path: Path, payload: object) -> None:
    with gzip.open(path, "wt", encoding="utf-8", compresslevel=6) as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))


def attach_keywords(path: Path, movies: list[dict]) -> None:
    wanted = {movie["id"] for movie in movies}
    found: dict[int, list[str]] = {}
    with path.open(newline="", encoding="utf-8", errors="replace") as handle:
        for row in csv.DictReader(handle):
            try:
                movie_id = int(row["id"])
            except (TypeError, ValueError, KeyError):
                continue
            if movie_id not in wanted:
                continue
            found[movie_id] = [part.strip() for part in (row.get("keywords") or "").split(",") if part.strip()][:12]
    for movie in movies:
        movie["keywords"] = found.get(movie["id"], movie.get("keywords") or [])
    print(f"keywords attached for {len(found):,} films", flush=True)


def print_samples(movies: list[dict], neighbor_map: dict[str, list[list[float | int]]]) -> None:
    by_id = {movie["id"]: movie for movie in movies}
    grouped: dict[str, list[dict]] = {}
    for movie in movies:
        grouped.setdefault(movie["title"].casefold(), []).append(movie)
    for sample in ("inception", "spirited away", "the godfather", "parasite", "toy story", "get out"):
        choices = grouped.get(sample) or []
        if not choices:
            print(f"sample missing: {sample}")
            continue
        movie = max(choices, key=lambda item: item["votes"])
        print(f"\n{movie['title']} ({movie['year']})")
        for other_id, score in neighbor_map[str(movie["id"])][:8]:
            other = by_id[int(other_id)]
            print(f"  {score:.3f}  {other['title']} ({other['year']})")


def write_model(path: Path, movies: list[dict]) -> None:
    model = {
        "algorithm": "Weighted TF-IDF cosine similarity",
        "features": ["overview", "genres", "keywords", "director", "top cast"],
        "weights": WEIGHTS,
        "maxFeatures": 25000,
        "ngramRange": [1, 2],
        "neighbors": NEIGHBORS,
        "movieCount": len(movies),
        "withCast": sum(1 for movie in movies if movie.get("cast")),
        "minVotes": MIN_VOTES,
    }
    path.write_text(json.dumps(model, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(model, indent=2), flush=True)


def main() -> None:
    args = parse_args()
    if args.reuse_catalog:
        require(args.tmdb)
        catalog_path = args.out / "movies.json.gz"
        require(catalog_path)
        with gzip.open(catalog_path, "rt", encoding="utf-8") as handle:
            movies = json.load(handle)
        attach_keywords(args.tmdb, movies)
        neighbor_map = recommend(movies)
        args.out.mkdir(parents=True, exist_ok=True)
        write_gzip_json(args.out / "neighbors.json.gz", neighbor_map)
        write_model(args.out / "model.json", movies)
        print_samples(movies, neighbor_map)
        return
    for path in (args.tmdb, args.crew, args.principals, args.names):
        require(path)
    movies = load_movies(args.tmdb)
    if len(movies) < 1000:
        sys.exit("Too few films survived filtering. Check the TMDB source file.")
    imdb_to_indexes: dict[str, list[int]] = {}
    for index, movie in enumerate(movies):
        if movie["imdb"]:
            imdb_to_indexes.setdefault(movie["imdb"], []).append(index)
    attach_directors(args.crew, imdb_to_indexes, movies)
    attach_cast(args.principals, imdb_to_indexes, movies)
    attach_names(args.names, movies)
    neighbor_map = recommend(movies)
    movies.sort(key=lambda movie: (movie["popularity"], movie["votes"]), reverse=True)
    args.out.mkdir(parents=True, exist_ok=True)
    write_gzip_json(args.out / "movies.json.gz", [public_movie(movie) for movie in movies])
    write_gzip_json(args.out / "neighbors.json.gz", neighbor_map)
    write_model(args.out / "model.json", movies)
    print_samples(movies, neighbor_map)


if __name__ == "__main__":
    main()
