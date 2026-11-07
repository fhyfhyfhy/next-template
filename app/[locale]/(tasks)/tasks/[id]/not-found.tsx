import Link from "next/link";
import { useTranslations } from "next-intl";

import { StatusMessage } from "@/components/status-message";
import { TASK_LIST_HREF } from "@/features/task";

export default function TaskNotFound() {
  const t = useTranslations();
  return (
    <StatusMessage
      title={t("app.taskDetail.notFound.title")}
      description={t("app.taskDetail.notFound.description")}
      action={
        <Link
          href={TASK_LIST_HREF}
          className="text-sm text-primary hover:underline"
        >
          {t("app.taskDetail.notFound.back")}
        </Link>
      }
    />
  );
}
