"use client";

import { useEffect, useState } from "react";
import { getOllieImageExportSrc, getOllieImageSrc } from "@/lib/wallet-dna/ollie-images";
import {
  getPassportOllieExportSrc,
  getPassportOllieFallbackSrc,
  getPassportOllieSrc,
} from "@/lib/wallet-dna/passport/ollie-assets";
import { getOllieImageDimensions } from "@/lib/wallet-dna/ollie-image-url";

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

function resolvePassportOllieExportSrc(variant: string, personalityId?: string): string {
  if (personalityId) return getOllieImageExportSrc(personalityId);
  return getPassportOllieExportSrc(variant);
}

export function WalletPassportOllie({ variant, personalityId, visible, className, large }: Props) {
  const intendedSrc = resolvePassportOllieSrc(variant, personalityId);
  const exportSrc = resolvePassportOllieExportSrc(variant, personalityId);
  const fallback = getPassportOllieFallbackSrc();
  const [src, setSrc] = useState(intendedSrc);
  const dims = getOllieImageDimensions(exportSrc.split("/").pop() ?? "");

  useEffect(() => {
    setSrc(intendedSrc);
  }, [intendedSrc]);

  if (!visible) return null;

  return (
    <div className={`wdna-passport-ollie${large ? " wdna-passport-ollie--large" : ""} ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        data-export-src={exportSrc}
        alt="Little Ollie"
        width={dims?.width}
        height={dims?.height}
        onError={() => {
          if (src !== fallback) setSrc(fallback);
        }}
      />
    </div>
  );
}
