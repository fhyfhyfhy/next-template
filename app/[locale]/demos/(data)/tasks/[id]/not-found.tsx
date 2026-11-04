import Link from "next/link";
import { useTranslations } from "next-intl";

export default function TaskNotFound() {
  const t = useTranslations("app");
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-medium tracking-tight">
        {t("demos.taskDetail.notFound.title")}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {t("demos.taskDetail.notFound.description")}
      </p>
      <Link
        href="/demos/tasks"
        className="mt-6 inline-block text-sm text-primary hover:underline"
      >
        {t("demos.taskDetail.notFound.back")}
      </Link>
    </div>
  );
}
