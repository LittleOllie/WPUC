/**
 * Little Ollie World — book catalogue (add new books here after PDF import)
 */
window.LoBookCatalog = [
  {
    slug: "the-spark-inside",
    title: "Little Ollie and the Spark Inside",
    description:
      "A rhyming picture book about curiosity, courage, creativity and believing in the little spark inside you.",
    cover: "../webpageassets/BookCover.jpg",
    manifest: "../books/the-spark-inside/manifest.json",
    readerUrl: "library/the-spark-inside/",
    status: "available",
    tags: ["Rhyming Story", "Creativity", "Courage", "Family Reading"],
    amazonUrl:
      "https://www.amazon.com.au/Little-Ollie-Spark-Inside-Creativity/dp/B0H7MPSM1N",
  },
];

window.LoBookCatalog.getBySlug = function (slug) {
  return window.LoBookCatalog.find(function (book) {
    return book.slug === slug;
  });
};
