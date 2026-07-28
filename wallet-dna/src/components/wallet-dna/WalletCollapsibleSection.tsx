"use client";

import { useId, useState, type ReactNode } from "react";

type Props = {
  title: string;
  titleAccent?: string;
  lead?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  className?: string;
};

function TitleWithAccent({ title, accent }: { title: string; accent?: string }) {
  if (!accent || !title.includes(accent)) return <>{title}</>;
  const idx = title.indexOf(accent);
  return (
    <>
      {title.slice(0, idx)}
      <span className="wdna-collapse__title-accent">{accent}</span>
      {title.slice(idx + accent.length)}
    </>
  );
}

export function WalletCollapsibleSection({
  title,
  titleAccent,
  lead,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  children,
  className,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const contentId = useId();
  const headerId = useId();

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const toggle = () => setOpen(!open);

  const onHeaderKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <section
      className={`wdna-collapse${open ? "" : " wdna-collapse--closed"}${className ? ` ${className}` : ""}`}
    >
      <div
        id={headerId}
        className="wdna-collapse__header"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={contentId}
        onClick={toggle}
        onKeyDown={onHeaderKeyDown}
      >
        <div className="wdna-collapse__titles">
          <h3 className="wdna-collapse__title">
            <TitleWithAccent title={title} accent={titleAccent} />
          </h3>
          {lead && !open ? <p className="wdna-collapse__lead-preview">{lead}</p> : null}
        </div>
        <span className="wdna-collapse__icon" aria-hidden="true">
          ▶
        </span>
      </div>
      <div
        id={contentId}
        className="wdna-collapse__content"
        role="region"
        aria-labelledby={headerId}
        hidden={!open}
      >
        {lead && open ? <p className="wdna-section__lead">{lead}</p> : null}
        {children}
      </div>
    </section>
  );
}
