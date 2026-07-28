# Wallet DNA Design Audit

Audit date: July 2026. Sources: FlexGrid, Games Lab, `styles/site-brand.css`.

## Typography

| Role | Font | Source |
|------|------|--------|
| Headings / display | **Fredoka** | `site-brand.css` `--lo-font`, Games Lab |
| Body | **Nunito** | Games Lab (`lo-playground.css`), Wallet DNA loader |
| FlexGrid-only | Baloo 2 | FlexGrid app (not used for Wallet DNA — hub/games stack preferred) |

Wallet DNA uses **Fredoka + Nunito** (same as Games Lab and links hub).

## Brand colours

| Token | Value | Usage |
|-------|-------|-------|
| `--lo-blue` | `#4c6fff` | Primary brand, gradients |
| `--lo-bg-top` | `#6de0ff` | Page gradient top |
| `--lo-bg-bottom` | `#4c6fff` | Page gradient bottom |
| `--lo-yellow` | `#ffdd55` | Primary CTA |
| `--lo-yellow-light` | `#ffe986` | Button gradient top |
| `--lo-yellow-press` | `#d4b300` | Button shadow |
| `--lo-ink` | `#1a1a2e` | Text on yellow buttons |

## Surfaces

| Token | Value |
|-------|-------|
| `--lo-glass` | `rgba(0, 0, 0, 0.35)` |
| `--lo-glass-border` | `rgba(255, 255, 255, 0.12)` |
| `--lo-surface-light` | `rgba(255, 255, 255, 0.96)` |

## Radii

| Token | Value |
|-------|-------|
| `--lo-radius-sm` | 12px |
| `--lo-radius-md` | 14px |
| `--lo-radius-lg` | 16px |
| `--lo-radius-xl` | 20px |
| `--lo-radius-card` | 24px |

## Shadows

| Token | Usage |
|-------|-------|
| `--lo-shadow-card` | Glass cards |
| `--lo-shadow-btn` | Primary yellow buttons |
| `--lo-shadow-btn-yellow-sm` | Inline CTAs |

## Buttons

- **Primary:** `linear-gradient(180deg, --lo-yellow-light, --lo-yellow)`, `--lo-ink` text, min-height 48px, radius `--lo-radius-lg`
- **Ghost/secondary:** `rgba(255,255,255,0.08)` fill, glass border

## Spacing

- Page: `--lo-space-page` = `clamp(16px, 4vw, 32px)`
- Card padding: `--lo-space-card` = `clamp(20px, 4vw, 28px)`
- Section gap: `--lo-space-section-gap` = 22px

## Breakpoints

- 480px — mobile card padding, game actions
- 560px — lab grid 2-col
- 640px — Wallet DNA gallery / scores
- 768px — share layouts
- 960px — results max-width

## Patterns reused in Wallet DNA

1. `styles/site-brand.css` tokens via CSS aliases in `globals.css`
2. Fredoka headings + Nunito body (already in `layout.tsx`)
3. Glass cards on brand gradient background
4. Yellow primary buttons matching hub CTAs
5. 24px card radius, 14–16px control radius
6. Personality accents as secondary highlights only

## Components not duplicated

FlexGrid-specific: Baloo 2, dark-mode neon, 1100px wizard layout — not applicable.

Games Lab: photo background + cream card — Wallet DNA uses hub-style glass-on-gradient for tool consistency with NFT Lab entry point.

## Wallet DNA aliases

```css
--wallet-dna-bg: linear-gradient(180deg, var(--lo-bg-top), var(--lo-bg-bottom));
--wallet-dna-surface: var(--lo-glass);
--wallet-dna-border: var(--lo-glass-border);
--wallet-dna-action: var(--lo-yellow);
--wallet-dna-text: var(--lo-text-on-dark);
--wallet-dna-muted: var(--lo-text-muted);
```
