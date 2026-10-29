"use client";

import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "@/lib/react-query";

import {
  getMockFaultsQueryOptions,
  type MockFault,
} from "../../api/get-mock-faults";
import { updateMockFaultsMutationOptions } from "../../api/update-mock-faults";
import { LabSection } from "../lab-section";
import { FaultForm } from "./fault-form";

function describeFault(fault: MockFault) {
  const effect = fault.status
    ? `返回 ${fault.status}`
    : fault.code
      ? `业务 code ${fault.code}`
      : fault.malformed
        ? "data 不符合 schema"
        : `延迟 ${fault.latencyMs}ms`;
  const times = fault.times === null ? "一直生效" : `还剩 ${fault.times} 次`;
  return `${fault.method} ${fault.path}：${effect}，${times}`;
}

/** Mock API 当前的故障配置。故障对所有 Data demo 页面的请求生效，包括服务端渲染时的请求。 */
export function FaultPanel() {
  // 有故障时定期刷新：其他页面的请求会消耗故障次数，这里要跟着显示剩余次数。
  const faults = useQuery({
    ...getMockFaultsQueryOptions(),
    refetchInterval: (query) => (query.state.data?.length ? 2000 : false),
  });
  const update = useMutation(updateMockFaultsMutationOptions());
  return (
    <LabSection
      title="注入故障"
      description="选一个接口和故障类型。“次数”用完后故障自动消失。注入后去其他页面操作，看页面怎么反应。"
    >
      <FaultForm />
      <div className="mt-4">
        {faults.data && faults.data.length > 0 ? (
          <>
            <ul className="space-y-1 text-sm">
              {faults.data.map((fault, index) => (
                <li
                  key={`${fault.method} ${fault.path} ${index}`}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="font-mono text-xs">
                    {describeFault(fault)}
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
                    移除
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
              清除全部
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {faults.data ? "当前没有故障" : "读取故障配置…"}
          </p>
        )}
      </div>
    </LabSection>
  );
}
