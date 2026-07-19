/**
 * Games Lab playground titles — used by the in-game switcher.
 */
export const LABS_PLAYGROUND_GAMES = [
  {
    id: "obh",
    title: "One Button Hero",
    match: /(?:^|\/)(?:game\.html|games\/one-button-hero(?:\/index\.html)?)\/?$/i,
    path: "game.html",
  },
  {
    id: "slider",
    title: "Slider Puzzle",
    match: /(?:^|\/)games\/slider-puzzle(?:\/index\.html)?\/?$/i,
    path: "games/slider-puzzle/index.html",
  },
  {
    id: "memory",
    title: "Memory Match",
    match: /(?:^|\/)games\/memory-match(?:\/index\.html)?\/?$/i,
    path: "games/memory-match/index.html",
  },
  {
    id: "jigsaw",
    title: "Jigsaw Puzzle",
    match: /(?:^|\/)games\/jigsaw-puzzle(?:\/index\.html)?\/?$/i,
    path: "games/jigsaw-puzzle/index.html",
  },
  {
    id: "ttt",
    title: "X & O",
    match: /(?:^|\/)games\/tic-tac-toe(?:\/index\.html)?\/?$/i,
    path: "games/tic-tac-toe/index.html",
  },
  {
    id: "ddg",
    title: "DDG Frappy Brew",
    match: /(?:^|\/)ddg(?:\/index\.html)?\/?$/i,
    path: "ddg/index.html",
  },
  {
    id: "pog",
    title: "Proof of Grass",
    match: /(?:^|\/)proof-of-grass(?:\/index\.html)?\/?$/i,
    path: "proof-of-grass/index.html",
  },
];

export function detectCurrentGameId(pathname = location.pathname) {
  for (const game of LABS_PLAYGROUND_GAMES) {
    if (game.match.test(pathname)) return game.id;
  }
  return null;
}

export function getSiteRoot(pathname = location.pathname) {
  for (const game of LABS_PLAYGROUND_GAMES) {
    if (game.match.test(pathname)) {
      const idx = pathname.search(game.match);
      return pathname.slice(0, idx);
    }
  }
  const lastSlash = pathname.lastIndexOf("/");
  return lastSlash >= 0 ? pathname.slice(0, lastSlash + 1) : "/";
}

export function hrefForGame(gameId, pathname = location.pathname) {
  const game = LABS_PLAYGROUND_GAMES.find((g) => g.id === gameId);
  if (!game) return null;
  const root = getSiteRoot(pathname);
  const joined = `${root}${game.path}`.replace(/\/{2,}/g, "/");
  return new URL(joined, location.origin).pathname;
}
