"use client";

import { useTranslations } from "next-intl";

import { StatusMessage } from "@/components/status-message";
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
    <StatusMessage
      title={t("app.pageError.title")}
      description={t("app.pageError.description")}
      action={<Button onClick={retry}>{t("app.pageError.retry")}</Button>}
    />
  );
}
