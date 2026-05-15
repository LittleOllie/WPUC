const ICONS = {
  Website: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8M12 3c2.2 2.4 3.5 5.5 3.5 9s-1.3 6.6-3.5 9" />
    </svg>
  ),
  X: (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  OpenSea: (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
    </svg>
  ),
  Discord: (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20.317 4.37a19.79 19.79 0 00-4.885-1.515.074.074 0 00-.079.037 12.3 12.3 0 00-.608 1.25 18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 004.093-1.638.077.077 0 01.087.026 11.89 11.89 0 005.976 0 .077.077 0 01.087-.026 10.2 10.2 0 004.093 1.638.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107 14.322 14.322 0 001.225 1.993.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
    </svg>
  ),
};

export default function CommunityLinks({ collection }) {
  const theme = collection.theme;
  const links = [
    { label: "Website", href: collection.website },
    { label: "X", href: collection.twitter },
    { label: "OpenSea", href: collection.openSea },
    { label: "Discord", href: collection.discord },
  ].filter((l) => l.href);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
      <h2 className="font-display text-xl font-bold">Community links</h2>
      <p className="mt-1 text-sm text-tp-muted">Official channels — verify before you trade.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/10"
            style={{
              ["--hover-glow"]: theme.primary,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = `0 0 24px ${theme.primary}44`;
              e.currentTarget.style.borderColor = `${theme.primary}66`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "";
              e.currentTarget.style.borderColor = "";
            }}
          >
            <span className="text-white/70 transition-colors group-hover:text-white">{ICONS[link.label]}</span>
            {link.label}
          </a>
        ))}
      </div>
    </section>
  );
}
