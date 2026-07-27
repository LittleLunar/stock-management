import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  dashboardItem,
  isNavItemActive,
  loadSidebarOpenState,
  saveSidebarOpenState,
  sectionIdForPath,
  sidebarSections,
  type SidebarOpenState,
  type SidebarSectionId,
} from "../nav/sidebarNav";
import { Icon } from "../ui";

function linkClassName(active: boolean): string {
  return [
    "rounded-md px-2 py-1.5 text-sm transition-colors",
    active
      ? "bg-slate-100 font-medium text-slate-900"
      : "text-slate-700 hover:bg-slate-100",
  ].join(" ");
}

type SidebarNavProps = {
  onNavigate?: () => void;
};

export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const { t } = useTranslation("nav");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState<SidebarOpenState>(() =>
    loadSidebarOpenState(),
  );
  const baseId = useId();

  useEffect(() => {
    const activeSection = sectionIdForPath(pathname);
    if (!activeSection) return;
    setOpen((prev) => {
      if (prev[activeSection]) return prev;
      const next = { ...prev, [activeSection]: true };
      saveSidebarOpenState(next);
      return next;
    });
  }, [pathname]);

  function toggleSection(id: SidebarSectionId) {
    setOpen((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveSidebarOpenState(next);
      return next;
    });
  }

  return (
    <nav className="flex flex-col gap-1">
      <Link
        to={dashboardItem.to}
        className={linkClassName(isNavItemActive(dashboardItem, pathname))}
        onClick={onNavigate}
      >
        {t(dashboardItem.labelKey)}
      </Link>

      {sidebarSections.map((section) => {
        const isOpen = Boolean(open[section.id]);
        const panelId = `${baseId}-${section.id}-panel`;
        const headerId = `${baseId}-${section.id}-header`;

        return (
          <div key={section.id} className="mt-3 first:mt-1">
            <button
              type="button"
              id={headerId}
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggleSection(section.id)}
              className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            >
              <span
                aria-hidden
                className={`inline-flex transition-transform ${isOpen ? "rotate-90" : ""}`}
              >
                <Icon name="chevronDown" size={12} className="-rotate-90" />
              </span>
              {t(section.labelKey)}
            </button>
            {isOpen ? (
              <div
                id={panelId}
                role="region"
                aria-labelledby={headerId}
                className="mt-1 flex flex-col gap-0.5"
              >
                {section.items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={linkClassName(isNavItemActive(item, pathname))}
                    onClick={onNavigate}
                  >
                    {t(item.labelKey)}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
