import { basePath } from "@/lib/wallet-dna/client";

type Props = {
  className?: string;
  width?: number;
  height?: number;
  large?: boolean;
};

export function LittleOllieLogo({ className, width, height, large }: Props) {
  const w = width ?? (large ? 220 : 180);
  const h = height ?? (large ? 64 : 52);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${basePath}/logo-nav.webp`}
      className={className ?? (large ? "wdna-logo wdna-logo--large" : "wdna-logo")}
      alt="Little Ollie"
      width={w}
      height={h}
      decoding="async"
      crossOrigin="anonymous"
    />
  );
}

export function littleOllieLogoSrc(): string {
  return `${basePath}/logo-nav.webp`;
}
