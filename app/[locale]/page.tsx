import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { DEMOS_SERVED } from "@/app/demos";

export default async function Home() {
  const t = await getTranslations();
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold">{t("app.home.title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("app.home.description")}</p>
      {DEMOS_SERVED && (
        <p className="mt-6">
          <Link href="/demos" className="underline underline-offset-4">
            {t("app.home.demos")}
          </Link>
        </p>
      )}
    </main>
  );
}
