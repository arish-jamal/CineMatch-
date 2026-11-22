"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { castLine, formatRuntime, posterUrl } from "@/lib/format";
import type { Movie } from "@/lib/types";

type MovieCardProps = {
  movie: Movie;
  score?: number;
  reasons?: string[];
};

export function MovieCard({ movie, score, reasons }: MovieCardProps) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const names = movie.cast.map((person) => person.name);
  const meta = [movie.year, formatRuntime(movie.runtime)].filter(Boolean).join(" · ");

  return (
    <article className="relative">
      <Link
        href={`/movie/${movie.id}`}
        prefetch={false}
        className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-card shadow-lg ring-1 ring-white/10">
          {failed ? (
            <div className="flex h-full items-end bg-[#2a221c] p-3">
              <p className="font-heading text-lg leading-tight text-foreground">{movie.title}</p>
            </div>
          ) : (
            <Image
              src={posterUrl(movie.poster, "w342")}
              alt=""
              fill
              unoptimized
              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 16vw"
              className="object-cover transition duration-500 group-hover:scale-[1.04]"
              onError={() => setFailed(true)}
            />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/10 to-black/15" />
          {typeof score === "number" ? (
            <div className="absolute top-2 left-2 rounded-full bg-black/70 px-2 py-1 text-[11px] font-medium text-primary tabular-nums">
              {score.toFixed(2)}
            </div>
          ) : null}
          {movie.rating > 0 ? (
            <div className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-1 text-[11px] font-medium text-primary tabular-nums">
              {movie.rating.toFixed(1)}
            </div>
          ) : null}
          <div className="poster-caption absolute inset-x-0 bottom-0 p-3 transition-opacity duration-200" aria-hidden={open}>
            <h3 className="font-heading text-[15px] leading-tight text-white line-clamp-2">{movie.title}</h3>
            {meta ? <p className="mt-1 text-[11px] text-white/75">{meta}</p> : null}
          </div>
          <div className={`poster-details absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black via-black/80 to-black/25 p-3 text-white transition-opacity duration-200 ${open ? "is-open" : ""}`} aria-hidden={!open}>
            <h3 className="font-heading text-[15px] leading-tight">{movie.title}</h3>
            {meta ? <p className="mt-1 text-[11px] text-white/70">{meta}</p> : null}
            <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-white/90">{movie.overview}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-primary">{castLine(names)}</p>
          </div>
        </div>
      </Link>
      {reasons && reasons.length > 0 ? (
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{reasons.join(" · ")}</p>
      ) : null}
      <Dialog>
        <DialogTrigger
          className={`peek-trigger absolute left-2 z-20 rounded-full bg-black/75 px-2.5 py-1 text-[11px] font-medium text-white ${typeof score === "number" ? "top-9" : "top-2"}`}
        >
          Story & cast
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{movie.title}</DialogTitle>
            <DialogDescription>
              {[meta, movie.director ? `Directed by ${movie.director}` : ""]
                .filter(Boolean)
                .join(" · ")}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-foreground">{movie.overview}</p>
          <div>
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Cast</p>
            <ul className="mt-2 space-y-1.5">
              {movie.cast.length === 0 ? (
                <li className="text-sm text-muted-foreground">Cast is not listed for this title.</li>
              ) : (
                movie.cast.map((person) => (
                  <li key={person.name} className="text-sm">
                    <span className="text-foreground">{person.name}</span>
                    {person.character ? (
                      <span className="text-muted-foreground"> as {person.character}</span>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>
          <Link
            href={`/movie/${movie.id}`}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Open recommendations
          </Link>
        </DialogContent>
      </Dialog>
    </article>
  );
}
