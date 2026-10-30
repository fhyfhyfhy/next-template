import type { Metadata } from "next";
import { draftMode } from "next/headers";
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

export const metadata: Metadata = { title: "故障实验室 · Data demo" };

export default function LabPage() {
  return (
    <>
      <PageIntro title="故障实验室">
        <p>
          给 Mock API
          的接口注入延迟和各种失败，观察请求失败时页面的反应。故障配置对所有
          Data demo 页面生效，包括服务端渲染时发出的请求。
        </p>
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
