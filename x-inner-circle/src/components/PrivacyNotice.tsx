import Link from "next/link";
import { APP_CONFIG } from "@/lib/config";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function PrivacyNotice() {
  return (
    <p className="text-sm text-slate-400">
      {APP_CONFIG.footerDisclaimer}{" "}
      <Link href={`${basePath}/privacy/`} className="underline">
        Privacy details
      </Link>
    </p>
  );
}
