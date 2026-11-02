import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PageIntro, TaskSearch } from "@/features/demo-task";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app.demos.search");
  return { title: t("metadataTitle") };
}

export default function SearchPage() {
  const t = useTranslations("app.demos.search");
  return (
    <>
      <PageIntro title={t("title")}>
        <p>{t("intro.typing")}</p>
        <p>{t("intro.tryIt")}</p>
      </PageIntro>
      {/* useSearchParams has no value during prerendering; Suspense lets it
          render at request time. */}
      <Suspense fallback={null}>
        <TaskSearch />
      </Suspense>
    </>
  );
}
