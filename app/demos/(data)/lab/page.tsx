import type { Metadata } from "next";

import { MockResetButton, PageIntro } from "@/features/demo-task";

export const metadata: Metadata = { title: "故障实验室 · Data demo" };

export default function LabPage() {
  return (
    <>
      <PageIntro title="故障实验室">
        <p>
          给 Mock API
          的接口注入延迟和各种失败，观察请求失败时页面的反应。这里的故障配置对所有
          Data demo 页面都生效。
        </p>
      </PageIntro>
      <MockResetButton />
    </>
  );
}
