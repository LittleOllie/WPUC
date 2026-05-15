import { collections } from "../data/collections";
import CollectionCard from "../components/CollectionCard";

export default function Collections() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Communities</h1>
      <p className="mt-2 max-w-2xl text-tp-muted">
        Every supported collection has its own branded hub — trades, wanted listings, and community links.
      </p>
      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {collections.map((c) => (
          <CollectionCard key={c.id} collection={c} />
        ))}
      </div>
    </div>
  );
}
