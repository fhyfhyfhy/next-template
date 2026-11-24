import Link from "next/link";
import { useTranslations } from "next-intl";

import { StatusMessage } from "@/components/status-message";

/**
 * `[locale]` 下调用 notFound() 时用访客的语言显示的 404，比如 app/[locale]/[...rest]/page.tsx 接住的地址。内容和
 * app/global-not-found.tsx 一样，只是在根 layout 里，不用自己渲染 `<html>`。
 */
export default function NotFound() {
  const t = useTranslations();
  return (
    <main className="mx-auto max-w-xl px-5 py-8">
      <StatusMessage
        title={t("app.globalNotFound.title")}
        description={t("app.globalNotFound.description")}
        action={
          <Link
            href="/"
            className="text-sm text-primary focus-ring hover:underline"
          >
            {t("app.globalNotFound.home")}
          </Link>
        }
      />
    </main>
  );
}
