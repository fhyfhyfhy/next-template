import { useTranslations } from "next-intl";

import { FaultPanel } from "@/features/demo-faults";

import { LabSection } from "./lab-section";

/** 故障实验室的故障面板：在这里改的默认延迟和故障，对所有 Data demo 页面生效。 */
export function LabFaults() {
  const t = useTranslations("demo-lab");
  return (
    <LabSection
      title={t("labFaults.title")}
      description={t("labFaults.description")}
    >
      <FaultPanel />
    </LabSection>
  );
}
