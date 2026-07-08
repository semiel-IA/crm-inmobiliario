"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  Building2,
  Calendar,
  Home,
  LogOut,
  Menu,
  Settings,
  Users,
  UserSquare2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, type MemberRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "Inicio", icon: Home },
  { href: "/app/contactos", label: "Contactos", icon: Users },
  { href: "/app/propiedades", label: "Propiedades", icon: Building2 },
  { href: "/app/negocios", label: "Negocios", icon: Briefcase },
  { href: "/app/agenda", label: "Agenda", icon: Calendar },
  { href: "/app/equipo", label: "Equipo", icon: UserSquare2, adminOnly: true },
  { href: "/app/configuracion", label: "Configuración", icon: Settings, adminOnly: true },
];

export type AppNavProps = {
  role: MemberRole;
  tenantName: string;
  fullName: string;
  signOutAction: () => Promise<void>;
};

/**
 * Persistent app shell navigation. Admin-only items are filtered out here purely for
 * presentation — the proxy (`src/proxy.ts`) and `requireAdmin` still enforce access server-side
 * regardless of what this component renders (defense in depth, not the actual guard).
 *
 * Mobile fallback: a hamburger toggle collapses the link list into a dropdown under a compact top
 * bar; from `md` up the same `<nav>` renders as a permanent sidebar (no separate markup, so no
 * duplicated/ambiguous links for assistive tech or tests).
 */
export function AppNav({ role, tenantName, fullName, signOutAction }: AppNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || role === "admin");

  return (
    <div className="flex flex-col border-b md:w-56 md:shrink-0 md:border-r md:border-b-0">
      <div className="flex items-center justify-between p-4 md:block">
        <div>
          <p className="truncate text-sm font-semibold">{tenantName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {fullName} · {ROLE_LABELS[role]}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>

      <nav
        aria-label="Navegación principal"
        className={cn("flex-col gap-1 px-4 pb-4 md:flex", open ? "flex" : "hidden")}
      >
        {items.map((item) => {
          const active =
            item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}

        <form action={signOutAction} className="mt-4">
          <Button type="submit" variant="secondary" size="sm" className="w-full">
            <LogOut />
            Cerrar sesión
          </Button>
        </form>
      </nav>
    </div>
  );
}
