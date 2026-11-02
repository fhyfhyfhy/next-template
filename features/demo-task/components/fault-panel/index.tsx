"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "@/lib/react-query";

import { getMockFaultsQueryOptions } from "../../api/get-mock-faults";
import { updateMockFaultsMutationOptions } from "../../api/update-mock-faults";
import { LabSection } from "../lab-section";
import { DefaultLatencySelect } from "./default-latency-select";
import { FaultForm } from "./fault-form";
import { describeFault } from "./fault-kinds";

/**
 * The Mock API's current fault config. Faults apply to the requests of every
 * Data demo page, server rendering's included.
 */
export function FaultPanel() {
  const t = useTranslations("demo-task");
  // Refresh periodically while there are faults: other pages' requests use up
  // their counts, and this shows how many remain.
  const faults = useQuery({
    ...getMockFaultsQueryOptions(),
    refetchInterval: (query) => (query.state.data?.length ? 2000 : false),
  });
  const update = useMutation(updateMockFaultsMutationOptions());
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
                  key={`${fault.method} ${fault.path} ${index}`}
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
