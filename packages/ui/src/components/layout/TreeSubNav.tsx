"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

interface TreeSubNavProps {
  treeId: string;
}

export function TreeSubNav({ treeId }: TreeSubNavProps) {
  const pathname = usePathname();

  const links = [
    { href: `/tree/${treeId}`, label: "View Tree" },
    { href: `/tree/${treeId}/directory`, label: "Directory" },
    { href: `/tree/${treeId}/cross-tree`, label: "Cross-Tree" },
    { href: `/tree/${treeId}/manage`, label: "Manage Roles" },
    { href: `/tree/${treeId}/proposals`, label: "Proposals" },
  ];

  return (
    <nav className="flex gap-1 border-b border-white/10 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
      {links.map((link) => {
        const isActive =
          link.href === `/tree/${treeId}`
            ? pathname === link.href
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={clsx(
              "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              isActive
                ? "border-pink-500 text-white"
                : "border-transparent text-gray-400 hover:text-white hover:border-gray-600"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
