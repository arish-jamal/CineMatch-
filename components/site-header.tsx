import Link from "next/link";

export function SiteHeader({ count }: { count: number }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="font-heading text-2xl tracking-tight text-foreground">
          MovieMatch
        </Link>
        <p className="text-sm text-muted-foreground tabular-nums">
          {count.toLocaleString()} films
        </p>
      </div>
    </header>
  );
}
