import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wallet DNA | Discover Your NFT Collector Personality",
  description:
    "Analyse public Ethereum and Base NFT activity to discover your Wallet DNA, collector personality and achievement badges.",
  openGraph: {
    title: "Wallet DNA | Little Ollie",
    description: "Discover your NFT collector personality from public on-chain activity.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/ollie/default.png`} />
      </head>
      <body>{children}</body>
    </html>
  );
}
