import type { Metadata } from "next";
import { APP_CONFIG } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_CONFIG.name,
  description: APP_CONFIG.subtitle,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
