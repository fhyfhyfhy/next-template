import { useTranslations } from "next-intl";

import { Link } from "@/lib/i18n/navigation";

export default function TaskNotFound() {
  const t = useTranslations("app.demos.taskDetail.notFound");
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-medium tracking-tight">{t("title")}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{t("description")}</p>
      <Link
        href="/demos/tasks"
        className="mt-6 inline-block text-sm text-primary hover:underline"
      >
        {t("back")}
      </Link>
    </div>
  );
}
