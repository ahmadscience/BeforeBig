import type { Route } from "next";
import Link from "next/link";

export function CatalogPagination({ page, pages, href }: { page: number; pages: number; href: (page: number) => string }) {
  if (pages <= 1) return null;
  const numbers = [...new Set([1, ...Array.from({ length: 5 }, (_, index) => page - 2 + index).filter((value) => value > 0 && value <= pages), pages])].sort((a, b) => a - b);
  return <nav className="catalog-pagination" aria-label="Catalog pages">
    {page > 1 ? <Link prefetch={false} href={href(page - 1) as Route} rel="prev">← Previous</Link> : <span aria-disabled="true">← Previous</span>}
    <div>{numbers.map((number, index) => <span key={number}>{index > 0 && number - numbers[index - 1] > 1 ? <span className="pagination-gap" aria-hidden="true">…</span> : null}{number === page ? <span className="pagination-current" aria-current="page">{number}</span> : <Link prefetch={false} href={href(number) as Route} aria-label={"Page " + number}>{number}</Link>}</span>)}</div>
    {page < pages ? <Link prefetch={false} href={href(page + 1) as Route} rel="next">Next →</Link> : <span aria-disabled="true">Next →</span>}
  </nav>;
}
