/** 任务各页面的标题。 */
export function PageHeading({ title }: { title: string }) {
  return (
    <h1 className="mb-8 text-4xl font-medium tracking-[-0.04em] sm:text-5xl">
      {title}
      <span className="text-primary">.</span>
    </h1>
  );
}
