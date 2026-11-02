"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "@/lib/react-query";

import { getDemoFaultsQueryOptions } from "../../api/get-demo-faults";
import { updateDemoFaultsMutationOptions } from "../../api/update-demo-faults";
import { LabSection } from "../lab-section";
import { DefaultLatencySelect } from "./default-latency-select";
import { FaultForm } from "./fault-form";
import { describeFault } from "./fault-kinds";

/** 当前的故障配置。故障按数据层操作匹配，对服务端渲染、浏览器请求和 Server Action 都生效。 */
export function FaultPanel() {
  const t = useTranslations("demo-task");
  // 有故障时定期刷新：其他页面的请求会消耗故障次数，这里要跟着显示剩余次数。
  const faults = useQuery({
    ...getDemoFaultsQueryOptions(),
    refetchInterval: (query) => (query.state.data?.length ? 2000 : false),
  });
  const update = useMutation(updateDemoFaultsMutationOptions());
  return (
    <LabSection
      title={t("faultPanel.title")}
      description={t("faultPanel.description")}
    >
      <DefaultLatencySelect />
      <FaultForm />
      <div className="mt-4">
        {faults.data && faults.data.length > 0 ? (
          <>
            <ul className="space-y-1 text-sm">
              {faults.data.map((fault, index) => (
                <li
                  key={`${fault.operation} ${fault.kind} ${index}`}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="font-mono text-xs">
                    {describeFault(fault, t)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      update.mutate(
                        faults.data.filter((_, other) => other !== index),
                      )
                    }
                  >
                    {t("faultPanel.remove")}
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => update.mutate([])}
            >
              {t("faultPanel.clearAll")}
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {faults.data ? t("faultPanel.empty") : t("faultPanel.reading")}
          </p>
        )}
      </div>
    </LabSection>
  );
}
