import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import {
  DemoResetButton,
  LabConcurrentFailures,
  LabDraftMode,
  LabFaults,
  LabQueryStates,
  LabRetry,
  LabSectionSkeleton,
  LabSuspenseReset,
} from "@/features/demo-lab";
import { PageIntro } from "@/features/demo-task";
import { ClientMessages } from "@/lib/i18n/client-messages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("app.demos.lab.metadataTitle") };
}

export default function LabPage() {
  const t = useTranslations();
  return (
    <ClientMessages namespaces={["demo-faults", "demo-lab"]}>
      <PageIntro title={t("app.demos.lab.title")}>
        <p>{t("app.demos.lab.intro")}</p>
      </PageIntro>
      <div className="mb-6">
        <DemoResetButton />
      </div>
      {/* 下面的区块在客户端创建 query，读当前时间，各自放进 Suspense 才不会打断预渲染，也互不等待。 */}
      <div className="grid gap-6">
        {/* 预渲染时 draftMode() 读到关闭，开关以关闭状态进静态 shell；开启后请求绕过静态 shell，在请求时读到开启。 */}
        <Suspense fallback={<LabSectionSkeleton className="h-36" />}>
          {draftMode().then(({ isEnabled }) => (
            <LabDraftMode enabled={isEnabled} />
          ))}
        </Suspense>
        <Suspense fallback={<LabSectionSkeleton className="h-72" />}>
          <LabFaults />
        </Suspense>
        <div className="grid gap-6 lg:grid-cols-2">
          <Suspense fallback={<LabSectionSkeleton />}>
            <LabQueryStates />
          </Suspense>
          <Suspense fallback={<LabSectionSkeleton />}>
            <LabRetry />
          </Suspense>
          <Suspense fallback={<LabSectionSkeleton />}>
            <LabConcurrentFailures />
          </Suspense>
          <Suspense fallback={<LabSectionSkeleton />}>
            <LabSuspenseReset />
          </Suspense>
        </div>
      </div>
    </ClientMessages>
  );
}
