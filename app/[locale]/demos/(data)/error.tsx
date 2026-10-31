"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

interface DataDemoErrorProps {
  error: unknown;
  /** 重新请求并渲染出错的路由段。 */
  retry: () => void;
}

/** Data demo 页面渲染时遇到的意外错误，比如服务端读取时后端返回 5xx。 */
export default function DataDemoError({ retry }: DataDemoErrorProps) {
  const t = useTranslations("app.demos.dataError");
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-medium tracking-tight">{t("title")}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{t("description")}</p>
      <Button className="mt-6" onClick={retry}>
        {t("retry")}
      </Button>
    </div>
  );
}
