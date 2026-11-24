"use client";

import { useTranslations } from "next-intl";

import { StatusMessage } from "@/components/status-message";
import { Button } from "@/components/ui/button";

/**
 * 页面渲染出错时显示，服务端和浏览器里的错误都算，比如服务端读取时数据库不可用。部署也是原因之一：上一个版本的
 * 页面可能加载不到只有那个版本才有的脚本（.agents/skills/self-hosting-audit/checks.md 的 Static files during a
 * rollout）。整页重新加载拿到的是当前版本，Next 的 retry() 只在旧页面里重新渲染。
 */
export default function PageError() {
  const t = useTranslations();
  return (
    <StatusMessage
      title={t("app.pageError.title")}
      description={t("app.pageError.description")}
      action={
        <Button onClick={() => window.location.reload()}>
          {t("app.pageError.reload")}
        </Button>
      }
    />
  );
}
