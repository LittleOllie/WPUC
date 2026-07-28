"use client";

import { useEffect, useState } from "react";
import { getOllieImageSrc } from "@/lib/wallet-dna/ollie-images";
import { getPassportOllieFallbackSrc, getPassportOllieSrc } from "@/lib/wallet-dna/passport/ollie-assets";

type Props = {
  variant: string;
  personalityId?: string;
  visible: boolean;
  className?: string;
  large?: boolean;
};

function resolvePassportOllieSrc(variant: string, personalityId?: string): string {
  if (personalityId) return getOllieImageSrc(personalityId);
  return getPassportOllieSrc(variant);
}

export function WalletPassportOllie({ variant, personalityId, visible, className, large }: Props) {
  const intendedSrc = resolvePassportOllieSrc(variant, personalityId);
  const fallback = getPassportOllieFallbackSrc();
  const [src, setSrc] = useState(intendedSrc);

  useEffect(() => {
    setSrc(intendedSrc);
  }, [intendedSrc]);

  if (!visible) return null;

  return (
    <div className={`wdna-passport-ollie${large ? " wdna-passport-ollie--large" : ""} ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Little Ollie"
        onError={() => {
          if (src !== fallback) setSrc(fallback);
        }}
      />
    </div>
  );
}
