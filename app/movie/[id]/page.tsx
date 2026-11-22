import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MovieCard } from "@/components/movie-card";
import { Badge } from "@/components/ui/badge";
import { formatRuntime, formatVotes, languageName, posterUrl } from "@/lib/format";
import { getMovie, getRecommendations } from "@/lib/catalog";

type MovieRouteProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: MovieRouteProps): Promise<Metadata> {
  const { id } = await params;
  const movie = getMovie(Number(id));
  if (!movie) return { title: "Film not found" };
  const year = movie.year ? ` (${movie.year})` : "";
  return {
    title: `${movie.title}${year}`,
    description: movie.overview.slice(0, 180),
  };
}

export default async function MoviePage({ params }: MovieRouteProps) {
  const { id } = await params;
  const movieId = Number(id);
  if (!Number.isInteger(movieId)) notFound();
  const movie = getMovie(movieId);
  if (!movie) notFound();
  const recommendations = getRecommendations(movieId);
  const backdrop = posterUrl(movie.backdrop || movie.poster, "w1280");
  const meta = [movie.year, formatRuntime(movie.runtime), languageName(movie.language)]
    .filter(Boolean)
    .join(" · ");

  return (
    <article>
      <section className="relative overflow-hidden border-b border-border">
        {backdrop ? (
          <Image
            src={backdrop}
            alt=""
            fill
            unoptimized
            priority
            sizes="100vw"
            className="object-cover opacity-35"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/75 to-background/25" />
        <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12 md:flex-row md:items-end">
          <Image
            src={posterUrl(movie.poster, "w500")}
            alt=""
            width={500}
            height={750}
            unoptimized
            priority
            className="w-36 shrink-0 rounded-xl shadow-2xl ring-1 ring-white/15 sm:w-52"
          />
          <div className="min-w-0 pb-1">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← Catalog
            </Link>
            <h1 className="mt-3 font-heading text-4xl leading-none tracking-tight text-balance sm:text-6xl">
              {movie.title}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">{meta}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {movie.rating > 0 ? (
                <Badge className="tabular-nums">{movie.rating.toFixed(1)} / 10</Badge>
              ) : null}
              <Badge variant="secondary">{formatVotes(movie.votes)}</Badge>
              {movie.genres.map((genre) => (
                <Badge key={genre} variant="outline">
                  {genre}
                </Badge>
              ))}
            </div>
            {movie.tagline ? (
              <p className="mt-4 max-w-xl font-heading text-lg text-primary/90 italic">{movie.tagline}</p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,42rem)_minmax(16rem,1fr)]">
          <section>
            <h2 className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Summary</h2>
            <p className="mt-3 text-lg leading-relaxed text-foreground">{movie.overview}</p>
          </section>
          <section>
            {movie.director ? (
              <div>
                <h2 className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Director</h2>
                <p className="mt-2 text-base">{movie.director}</p>
              </div>
            ) : null}
            <div className={movie.director ? "mt-6" : ""}>
              <h2 className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Cast</h2>
              {movie.cast.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Cast is not listed for this title.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {movie.cast.map((person) => (
                    <li key={person.name}>
                      <p className="text-sm font-medium">{person.name}</p>
                      {person.character ? (
                        <p className="text-sm text-muted-foreground">{person.character}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <section className="mt-14">
          <h2 className="font-heading text-3xl tracking-tight">If you liked {movie.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Ranked by a weighted mix of cosine similarities: plot, genres and keywords, director, and
            top-billed cast. Higher means more of that profile is shared.
          </p>
          {recommendations.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">No close matches in the catalog.</p>
          ) : (
            <ul className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {recommendations.map((pick) => (
                <li key={pick.movie.id}>
                  <MovieCard movie={pick.movie} score={pick.score} reasons={pick.reasons} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </article>
  );
}
