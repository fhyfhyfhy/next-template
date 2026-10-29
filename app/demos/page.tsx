import { IconArrowRight } from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";

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
      <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
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
