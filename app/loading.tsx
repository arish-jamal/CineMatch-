export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <div className="h-4 w-40 rounded bg-muted" />
      <div className="mt-4 h-14 w-full max-w-xl rounded bg-muted" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }, (_, index) => (
          <div key={index} className="aspect-[2/3] animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </main>
  );
}
