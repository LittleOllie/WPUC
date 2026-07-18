# Book PDF imports

Place source PDF files here **before** running the import command.

Example:

```
book-imports/the-spark-inside.pdf
```

Do not put the source PDF in `webpageassets/` or any publicly served folder unless you intentionally want it downloadable.

After import, generated WebP pages appear in:

```
books/the-spark-inside/pages/
books/the-spark-inside/pages-mobile/
books/the-spark-inside/manifest.json
```

See `BOOK_READER_SETUP.md` in the project root for full instructions.
