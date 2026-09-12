/**
 * A shelf's loading shape: the header line plus four tile placeholders, so the
 * card occupies roughly the height the real shelf will (DESIGN_PLAN §5.1, no
 * visible layout shift).
 */
export default function ShelfSkeleton() {
  return (
    <div className="rounded-md border border-subtle surface p-3">
      <div className="flex items-center gap-3">
        <span className="skeleton block h-10 w-10 rounded-md" />
        <span className="skeleton block h-4 w-28 rounded-sm" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-md border border-subtle p-2.5">
            <span className="skeleton block h-16 w-16 rounded-md" />
            <span className="skeleton mt-2 block h-3 w-full rounded-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}
