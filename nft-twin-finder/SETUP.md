# NFT Twin Finder — Version 1

**Contract Importer** (`/nft-twin-finder-import/`) fetches metadata from network + contract address.

**Admin** (`/nft-twin-finder-admin/`) builds similarity scores and exports the full package.

Similarity is not run during contract import — prove metadata first, then build twins.

## Public app

`/nft-twin-finder/` — reads local JSON from `collections/{slug}/`. No blockchain calls.

**Try the demo:** collection **Demo Pals**, token **#1**.

## Add a collection

### A — Contract import (recommended)

1. Run the import worker — see `nft-twin-finder-import-api/SETUP.md`
2. Open `/nft-twin-finder-import/`
3. Select **network** + **contract address** → **Import Collection**
4. Download `metadata.json` and `images.json`

### B — Build twin package (admin)

1. Open `/nft-twin-finder-admin/`
2. Enter **collection name** and **slug**
3. Upload the **metadata.json** from step A (or a metadata folder)
4. Click **Build similarity package**
5. Click **Export package** — saves 4 JSON files
6. Create folder `nft-twin-finder/collections/{slug}/` and move the files in:
   - `collection.json`
   - `metadata.json`
   - `images.json`
   - `similarity.json`
7. Add the collection to `nft-twin-finder/collections/index.json`:

```json
[
  { "slug": "your-slug", "name": "Your Collection Name" }
]
```

8. Deploy and test on `/nft-twin-finder/`

## Metadata format

Each token should include traits (OpenSea-style is fine):

```json
{
  "name": "Space Rider #437",
  "image": "https://…/437.png",
  "attributes": [
    { "trait_type": "Skin", "value": "Blue" },
    { "trait_type": "Hat", "value": "Cap" }
  ]
}
```

Images should be full URLs in each record when possible. Use **Advanced options** in admin only if images are missing.

## Local dev

Serve the repo root over HTTP (ES modules need a server):

```bash
python3 -m http.server 8891
```

Then open `http://127.0.0.1:8891/nft-twin-finder/`
