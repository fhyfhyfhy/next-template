import { Link } from "@/lib/i18n-navigation";

export default function TaskNotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-medium tracking-tight">任务不存在</h1>
      <p className="mt-3 text-sm text-muted-foreground">它可能已经被删除了。</p>
      <Link
        href="/demos/tasks"
        className="mt-6 inline-block text-sm text-primary hover:underline"
      >
        回到全部任务
      </Link>
    </div>
  );
}
