# Little Ollie Book Reader — Setup Guide

This project uses a **static HTML** site with a modular vanilla JavaScript book reader. There is no React/Vue router. The reader page lives at:

`little-ollie-club/library/the-spark-inside/`

---

## 1. Place your PDF

Put the finished book PDF here:

```
book-imports/the-spark-inside.pdf
```

Keep the source PDF out of public asset folders.

---

## 2. Install import dependencies (one time)

From the project root:

```bash
npm install
```

This installs:

- `pdf-to-img` — reliable PDF page rendering in Node
- `sharp` — WebP export and resizing

Legacy packages (`canvas`, `pdfjs-dist`) may remain listed but the importer uses `pdf-to-img` + `sharp`.

---

## 3. Run the import command

```bash
npm run import:book -- --slug the-spark-inside --pdf "./book-imports/the-spark-inside.pdf" --cover-separate --force
```

Use `--cover-separate` when the PDF does **not** include the front cover (the reader uses `BookCover.jpg` instead). This also enables the **first-right** spread layout:

- **Open book:** blank left page, PDF page 1 on the right
- **Then:** text page on the left, illustration on the right (pages 2–3, 4–5, and so on)
- **Last page:** may sit alone if the page count is uneven

To overwrite an existing import:

```bash
npm run import:book -- --slug the-spark-inside --pdf "./book-imports/the-spark-inside.pdf" --force
```

Optional flags:

- `--quality 86` — WebP quality (default 86)
- `--desktop-max 2200` — longest edge for desktop pages
- `--mobile-max 1200` — longest edge for mobile pages

---

## 4. Generated output

After a successful import:

| Output | Location |
|--------|----------|
| Desktop page images | `books/the-spark-inside/pages/page-001.webp` … |
| Mobile page images | `books/the-spark-inside/pages-mobile/page-001.webp` … |
| Manifest (source of truth) | `books/the-spark-inside/manifest.json` |
| Cover copy | `books/the-spark-inside/cover.webp` |

The reader **never** renders the PDF in the browser. It only loads images listed in `manifest.json`.

---

## 5. Preview the reader

Open in your browser:

```
little-ollie-club/library/the-spark-inside/
```

Or from the Club page:

1. Go to `little-ollie-club/`
2. Scroll to **Library**
3. Click **Read the Book**
4. Press **Open Book** in the preview
5. In the reader, press **Open Book** on the closed cover

---

## 6. Update the cover image

The reader uses:

- `manifest.coverSrc` for the closed cover in the reader (currently `../../webpageassets/BookCover.jpg`)
- `books/the-spark-inside/cover.webp` is copied from page 1 during import

To use a custom cover without re-importing everything, either:

- Replace `webpageassets/BookCover.jpg`, or
- Edit `coverSrc` in `books/the-spark-inside/manifest.json`

---

## 7. Replace placeholder pages (before PDF import)

Temporary demo pages are here:

```
books/the-spark-inside/pages/page-001.svg … page-012.svg
books/the-spark-inside/pages-mobile/page-001.svg … page-012.svg
```

These are clearly labelled **Sample Page** placeholders. They are replaced automatically when you run the import command.

---

## 8. Add another book later

1. Add `book-imports/your-new-slug.pdf`
2. Run:

   ```bash
   npm run import:book -- --slug your-new-slug --pdf "./book-imports/your-new-slug.pdf"
   ```

3. Add an entry to `books/bookCatalog.js`
4. Create a reader page at `little-ollie-club/library/your-new-slug/index.html` (copy the spark-inside page and change the manifest URL + title)
5. Add a library card on the Club page

---

## 9. Desktop spreads vs mobile pages

| Viewport | Behaviour |
|----------|-----------|
| **900px and up** | Two-page spread (left + spine + right) |
| **Below 900px** | One page at a time |

Spread logic is driven by `manifest.json`. The reader preserves the closest page when rotating/resizing.

Reduced motion replaces page-turn animation with a quick fade.

---

## 10. Common import errors

| Problem | Fix |
|---------|-----|
| `PDF not found` | Check the path to `book-imports/the-spark-inside.pdf` |
| `Output folder already exists` | Add `--force` or delete `books/the-spark-inside/pages/` first |
| `canvas` install failed | Run `xcode-select --install`, then `npm install` |
| Blank pages in reader | Confirm `manifest.json` paths match generated files |
| Page failed to load | Use the **Retry** button; check file names are zero-padded (`page-001.webp`) |

---

## 11. Analytics hooks (optional, not active)

The reader emits hooks if you define:

```javascript
window.LoBookAnalytics = {
  onBookOpened: function (detail) {},
  onReadingStarted: function (detail) {},
  onPageChanged: function (detail) {},
  onBookCompleted: function (detail) {},
  onReadAgain: function (detail) {},
};
```

No child data is collected by default.

---

## 12. File map

```
books/
  bookCatalog.js
  the-spark-inside/
    manifest.json
    pages/
    pages-mobile/
  components/book-reader/
    book-reader.css
    BookReader.js
    BookStage.js
    BookCover.js
    BookSpread.js
    BookPage.js
    ReaderHeader.js
    ReaderControls.js
    ReaderProgress.js
    ReaderEndScreen.js
    reader-utils.js

little-ollie-club/
  library/the-spark-inside/index.html

scripts/import-book.mjs
book-imports/
```

---

## Quick checklist after importing your real PDF

- [ ] Import command completed without errors
- [ ] `manifest.json` shows `"placeholder": false`
- [ ] Reader opens with real cover
- [ ] Desktop shows two-page spreads
- [ ] Phone shows one page, no horizontal scroll
- [ ] Final page → end screen works
- [ ] No PDF download button appears in the UI
