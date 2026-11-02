import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import {
  FaultPanel,
  LabConcurrentFailures,
  LabDraftMode,
  LabQueryStates,
  LabRetry,
  LabSuspenseReset,
  MockResetButton,
  PageIntro,
} from "@/features/demo-task";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app.demos.lab");
  return { title: t("metadataTitle") };
}

export default function LabPage() {
  const t = useTranslations("app.demos.lab");
  return (
    <>
      <PageIntro title={t("title")}>
        <p>{t("intro")}</p>
      </PageIntro>
      <div className="mb-6">
        <MockResetButton />
      </div>
      {/* 下面的组件在客户端创建 query，读当前时间，放进 Suspense 才不会打断预渲染。 */}
      <Suspense fallback={null}>
        <div className="grid gap-6">
          {/* 预渲染时 draftMode() 读到关闭，开关以关闭状态进静态 shell；开启后请求绕过静态 shell，在请求时读到开启。 */}
          {draftMode().then(({ isEnabled }) => (
            <LabDraftMode enabled={isEnabled} />
          ))}
          <FaultPanel />
          <div className="grid gap-6 lg:grid-cols-2">
            <LabQueryStates />
            <LabRetry />
            <LabConcurrentFailures />
            <LabSuspenseReset />
          </div>
        </div>
      </Suspense>
    </>
  );
}
