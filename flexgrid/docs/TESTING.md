# FlexGrid testing

## Automated

```bash
cd flexgrid
npm install
npm run test
```

Full check (build + tests):

```bash
npm run check
```

### Test files

| File | Covers |
|------|--------|
| `tests/walletValidation.test.js` | EVM / Solana addresses |
| `tests/constants.test.js` | 900 cap, whale threshold |
| `tests/escapeHtml.test.js` | XSS escaping helper |
| `tests/rateLimit.test.js` | Worker 429 behaviour |
| `tests/api-cache.test.js` | Cache key format |
| `tests/notifications.test.js` | User error messages |

Tests do **not** call live Alchemy, Moralis, or Helius APIs.

## Manual chain matrix

| Chain | Load wallet | Build grid | Export PNG |
|-------|-------------|------------|------------|
| Ethereum | ☐ | ☐ | ☐ |
| Base | ☐ | ☐ | ☐ |
| ApeChain | ☐ | ☐ | ☐ |
| Polygon + contract | ☐ | ☐ | ☐ |
| Solana | ☐ | ☐ | ☐ |
| Custom upload | ☐ | ☐ | ☐ |

## Export matrix

| Format | Desktop | Mobile Safari |
|--------|---------|---------------|
| PNG | ☐ | ☐ |
| GIF | ☐ | ☐ |
| MP4 | ☐ | ☐ |

## Browser smoke checklist

1. Hard refresh → disclaimer once per tab session
2. Custom grid → upload images → build → export PNG enabled
3. Failed wallet load shows toast (invalid address)
4. Theme toggle persists

## Force disclaimer (dev)

- URL: `?disclaimer=1`
- Or: `sessionStorage.removeItem('flexgrid_disclaimer_dismissed_v1')`
