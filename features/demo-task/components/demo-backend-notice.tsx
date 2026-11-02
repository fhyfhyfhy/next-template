import { useTranslations } from "next-intl";

/** Demo 后端没有启用时代替 Data demo 页面显示，页面不读写任何数据。 */
export function DemoBackendNotice() {
  const t = useTranslations("demo-task.demoBackendNotice");
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
