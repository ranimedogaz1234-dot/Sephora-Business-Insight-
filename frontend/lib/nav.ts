/**
 * The application's navigation, in one place. The sidebar, the mobile menu and the
 * breadcrumbs all read this list, so a page only appears here once it exists.
 */
import type { LucideIcon } from "lucide-react";
import { FolderTree, Gem, Info, UsersRound, LayoutDashboard, MessageSquareHeart, ShoppingBag } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  { title: "Overview", items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }] },
  {
    title: "Analytics",
    items: [
      { href: "/products", label: "Products", icon: ShoppingBag },
      { href: "/brands", label: "Brands", icon: Gem },
      { href: "/categories", label: "Categories", icon: FolderTree },
      { href: "/reviews", label: "Reviews", icon: MessageSquareHeart },
    ],
  },
  { title: "Customers", items: [{ href: "/customers", label: "Customer insights", icon: UsersRound }] },
  { title: "Project", items: [{ href: "/about", label: "About", icon: Info }] },
];

export const NAV: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export const isActive = (href: string, pathname: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

/** The nav item that owns a path (the longest matching prefix), if any. */
export function currentItem(pathname: string): NavItem | undefined {
  return NAV.filter((i) => isActive(i.href, pathname)).sort((a, b) => b.href.length - a.href.length)[0];
}

/** Breadcrumb trail: section, page, and a final "Details" step for nested paths such as /products/123. */
export function breadcrumbs(pathname: string): { label: string; href?: string }[] {
  const item = currentItem(pathname);
  if (!item) return [];
  const section = NAV_SECTIONS.find((s) => s.items.includes(item))!;
  const trail: { label: string; href?: string }[] = [{ label: section.title }];
  const nested = item.href !== "/" && pathname !== item.href;
  trail.push(nested ? { label: item.label, href: item.href } : { label: item.label });
  if (nested) trail.push({ label: "Details" });
  return trail;
}
