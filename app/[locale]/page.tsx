import { getTranslations } from "next-intl/server";

import { DEMOS_SERVED } from "@/lib/demos";
import { Link } from "@/lib/i18n/navigation";

export default async function Home() {
  const t = await getTranslations("app.home");
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("description")}</p>
      {DEMOS_SERVED && (
        <p className="mt-6">
          <Link href="/demos" className="underline underline-offset-4">
            {t("demos")}
          </Link>
        </p>
      )}
    </main>
  );
}
