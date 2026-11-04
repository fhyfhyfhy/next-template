import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PageIntro, TaskSearch } from "@/features/demo-task";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return { title: t("demos.search.metadataTitle") };
}

export default function SearchPage() {
  const t = useTranslations("app");
  return (
    <>
      <PageIntro title={t("demos.search.title")}>
        <p>{t("demos.search.intro.typing")}</p>
        <p>{t("demos.search.intro.tryIt")}</p>
      </PageIntro>
      {/* useSearchParams 在预渲染时没有值，放进 Suspense 让它在请求时渲染。 */}
      <Suspense fallback={null}>
        <TaskSearch />
      </Suspense>
    </>
  );
}
