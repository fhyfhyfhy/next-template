import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PageIntro, RecentTasks } from "@/features/demo-task";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app.demos.recent");
  return { title: t("metadataTitle") };
}

export default function RecentPage() {
  const t = useTranslations("app.demos.recent");
  return (
    <>
      <PageIntro title={t("title")}>
        <p>{t("intro")}</p>
      </PageIntro>
      <Suspense fallback={null}>
        <RecentTasks />
      </Suspense>
    </>
  );
}
