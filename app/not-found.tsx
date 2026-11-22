import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-start px-4 py-24 sm:px-6">
      <p className="text-xs tracking-[0.18em] text-primary uppercase">Missing title</p>
      <h1 className="mt-3 font-heading text-4xl tracking-tight">That film is not on the shelf.</h1>
      <p className="mt-3 text-muted-foreground">
        It may have been filtered out for a missing poster, a thin summary, or too few ratings.
      </p>
      <Button className="mt-6 rounded-full" nativeButton={false} render={<Link href="/" />}>
        Back to the catalog
      </Button>
    </main>
  );
}
