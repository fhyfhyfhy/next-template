"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

interface TaskPageErrorProps {
  error: unknown;
  /** 重新请求并渲染出错的路由段。 */
  retry: () => void;
}

/** 任务各页面渲染时遇到的意外错误，比如服务端读取时数据库不可用。 */
export default function TaskPageError({ retry }: TaskPageErrorProps) {
  const t = useTranslations();
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-medium tracking-tight">
        {t("app.pageError.title")}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {t("app.pageError.description")}
      </p>
      <Button className="mt-6" onClick={retry}>
        {t("app.pageError.retry")}
      </Button>
    </div>
  );
}
