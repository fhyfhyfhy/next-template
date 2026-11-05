import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import {
  PageIntro,
  RecentTasks,
  RecentTasksLoading,
} from "@/features/demo-task";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return { title: t("demos.recent.metadataTitle") };
}

export default function RecentPage() {
  const t = useTranslations("app");
  return (
    <>
      <PageIntro title={t("demos.recent.title")}>
        <p>{t("demos.recent.intro")}</p>
      </PageIntro>
      <Suspense fallback={<RecentTasksLoading />}>
        <RecentTasks />
      </Suspense>
    </>
  );
}
