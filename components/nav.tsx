"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Hoje", icon: "M3 12l9-8 9 8M5 10v10h14V10" },
  { href: "/diario", label: "Diário", icon: "M4 5h16M4 10h16M4 15h16M4 20h10" },
  { href: "/evolucao", label: "Evolução", icon: "M4 19l5-6 4 3 7-9" },
  { href: "/plano", label: "Plano", icon: "M7 3v3M17 3v3M4 8h16M5 5h14v16H5z" },
  { href: "/treinador", label: "Treinador", icon: "M4 5h16v11H8l-4 4z" },
];

export function BottomNav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" || path.startsWith("/dia/") : path.startsWith(href));
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-2xl grid-cols-5">
        {ITEMS.map((i) => (
          <li key={i.href}>
            <Link href={i.href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active(i.href) ? "text-accent" : "text-muted"}`}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={i.icon} />
              </svg>
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
