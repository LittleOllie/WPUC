export function collectionThemeStyle(theme) {
  if (!theme) return {};
  return {
    "--collection-primary": theme.primary,
    "--collection-secondary": theme.secondary,
    "--collection-bg": theme.background,
    "--collection-accent": theme.accent,
  };
}

export function nftPlaceholderStyle(gradient) {
  const [a, b] = gradient || ["#7c5cff", "#12121f"];
  return {
    background: `linear-gradient(135deg, ${a} 0%, ${b} 100%)`,
  };
}
