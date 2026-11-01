import { useTranslations } from "next-intl";

/**
 * Shown instead of the Data demo pages when the Mock API isn't running, so the
 * pages send no requests.
 */
export function MockApiNotice() {
  const t = useTranslations("demo-task.mockApiNotice");
  const howToRun = t.rich("howToRun", {
    code: (chunks) => <code>{chunks}</code>,
  });
  return (
    <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <h1 className="text-3xl font-medium tracking-tight">{t("title")}</h1>
      <div className="mt-5 space-y-3 text-sm/6 text-muted-foreground">
        <p>{t("why")}</p>
        <p>{howToRun}</p>
      </div>
    </main>
  );
}
