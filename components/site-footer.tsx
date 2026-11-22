export function SiteFooter() {
  return (
    <footer className="border-t border-border/80">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-8 text-xs leading-relaxed text-muted-foreground sm:px-6">
        <p>
          Plot summaries, posters, and genres come from The Movie Database. Cast and director
          names come from IMDb&apos;s public datasets. This product uses TMDB data but is not
          endorsed or certified by TMDB.
        </p>
        <p>Recommendations stay on this machine. Nothing you search is sent to a movie API.</p>
      </div>
    </footer>
  );
}
