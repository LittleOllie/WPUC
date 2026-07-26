import Link from "next/link";
import { APP_CONFIG } from "@/lib/config";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-slate-200">
      <Link href={`${basePath}/`} className="text-indigo-300 underline">
        ← Back
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-white">Privacy</h1>
      <div className="prose prose-invert mt-6 space-y-4">
        <p>{APP_CONFIG.footerDisclaimer}</p>
        <p>
          {APP_CONFIG.name} retrieves publicly available X posts, mentions, and profile metadata needed to estimate
          interaction closeness. It does not access passwords, direct messages, or private account content.
        </p>
        <p>
          Raw posts are processed in memory to produce your result. In this MVP, generated analysis results may be
          temporarily cached (typically 24 hours) to avoid repeated API usage for the same username.
        </p>
        <p>
          Results describe public interaction patterns only. They should not be treated as proof of real-world friendship
          or private relationships.
        </p>
      </div>
    </main>
  );
}
