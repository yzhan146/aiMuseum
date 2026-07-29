export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
export function Breadcrumbs({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav className="public-breadcrumbs" aria-label="面包屑">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {index > 0 && <i aria-hidden="true">/</i>}
          {item.href ? <a href={item.href}>{item.label}</a> : <b>{item.label}</b>}
        </span>
      ))}
    </nav>
  );
}
