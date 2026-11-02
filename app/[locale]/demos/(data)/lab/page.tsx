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
      {/* The components below create queries on the client, which reads the
          current time; inside Suspense they don't interrupt prerendering. */}
      <Suspense fallback={null}>
        <div className="grid gap-6">
          {/* During prerendering draftMode() reads off, so the switch goes
              into the static shell off. Once it's on, requests bypass the
              static shell and read it on at request time. */}
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
