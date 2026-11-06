import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PageHeading, RecentTasks, RecentTasksLoading } from "@/features/task";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("app.recent.title") };
}

export default function RecentPage() {
  const t = useTranslations();
  return (
    <>
      <PageHeading title={t("app.recent.title")} className="mb-8" />
      <Suspense fallback={<RecentTasksLoading />}>
        <RecentTasks />
      </Suspense>
    </>
  );
}
