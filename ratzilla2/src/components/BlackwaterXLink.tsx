import { BLACKWATER_X_URL } from "../lib/blackwaterLinks";

function XIcon() {
  return (
    <svg
      className="rz-bw-x__icon"
      viewBox="0 0 24 24"
      width={14}
      height={14}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
    </svg>
  );
}

interface BlackwaterXLinkProps {
  className?: string;
}

/** Lore CTA — opens Blackwater X profile in a new tab. */
export default function BlackwaterXLink({ className = "" }: BlackwaterXLinkProps) {
  return (
    <a
      href={BLACKWATER_X_URL}
      className={`rz-bw-x ${className}`.trim()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Blackwater on X — View Blackwater Transmissions"
    >
      <span className="rz-bw-x__eyebrow" aria-hidden="true">
        ◈ SIGNAL INTERCEPT ◈
      </span>
      <span className="rz-bw-x__row">
        <XIcon />
        <span className="rz-bw-x__label">View Blackwater Transmissions</span>
        <span className="rz-bw-x__arrow" aria-hidden="true">
          →
        </span>
      </span>
      <span className="rz-bw-x__hint">Blackwater</span>
    </a>
  );
}
