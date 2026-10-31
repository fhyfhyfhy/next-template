import { IconArrowRight } from "@tabler/icons-react";
import type { Metadata } from "next";

import { Link } from "@/lib/i18n-navigation";

export const metadata: Metadata = {
  title: "Demo · Next Demo",
};

const sections = [
  {
    href: "/demos/ui",
    title: "UI demo",
    description:
      "设计系统组件的用法：可交互的 playground 和可以单独复制的 example。",
  },
  {
    href: "/demos/tasks",
    title: "Data demo · 全部任务",
    description:
      "Server Component 负责的列表：URL 筛选分页、服务端缓存、Server Action 写入和 useOptimistic。",
  },
  {
    href: "/demos/feed",
    title: "Data demo · 作品广场",
    description:
      "React Query 负责的无限滚动：第一页在服务端渲染、随 HTML 送达，收藏时多处同时乐观更新。",
  },
  {
    href: "/demos/search",
    title: "Data demo · 搜索",
    description: "边输入边搜索：debounce、shallow URL、中止过期请求。",
  },
  {
    href: "/demos/recent",
    title: "Data demo · 最近查看",
    description: "依赖 localStorage 的请求，hydration 之后才发出。",
  },
  {
    href: "/demos/lab",
    title: "Data demo · 故障实验室",
    description: "给接口注入延迟和失败，观察错误提示、重试和错误边界。",
  },
] as const;

export default function DemosPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-12 sm:px-8 lg:py-20">
      <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
        NEXT DEMO
      </p>
      <h1 className="mt-5 text-5xl font-medium tracking-[-0.055em] sm:text-6xl">
        Demo<span className="text-primary">.</span>
      </h1>
      <p className="mt-5 max-w-2xl text-base/7 text-muted-foreground">
        按这个模板的约定写成的可运行参考实现。写代码时可以照着看。
      </p>
      <ul className="mt-10 grid gap-4">
        {sections.map((section) => (
          <li key={section.href}>
            <Link
              href={section.href}
              className="group flex items-center justify-between gap-6 rounded-control border border-border bg-card p-6 text-card-foreground transition-colors outline-none hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>
                <span className="block text-lg font-medium">
                  {section.title}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {section.description}
                </span>
              </span>
              <IconArrowRight
                className="size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
