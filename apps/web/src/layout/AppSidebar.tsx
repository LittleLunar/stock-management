import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getOrgId, getOrgName } from "../auth/session";
import { SidebarNav } from "../components/SidebarNav";
import { useBranches } from "../hooks/masters";
import { Select } from "../ui";

const ALL_BRANCHES = "__all__";

function BranchSwitcher() {
  const { t } = useTranslation("common");
  const { data: branches } = useBranches();
  const [active, setActive] = useState(
    () => localStorage.getItem("activeBranchId") ?? "",
  );

  const options = [
    { id: ALL_BRANCHES, label: t("branch.all") },
    ...(branches ?? []).map((b) => ({
      id: b.id,
      label: `${b.code} — ${b.name}`,
    })),
  ];

  return (
    <Select
      label={t("branch.label")}
      aria-label={t("branch.label")}
      value={active || ALL_BRANCHES}
      options={options}
      onChange={(v) => {
        const next = v === ALL_BRANCHES ? "" : v;
        setActive(next);
        if (next) localStorage.setItem("activeBranchId", next);
        else localStorage.removeItem("activeBranchId");
        window.location.reload();
      }}
    />
  );
}

type AppSidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

export function AppSidebar({ className, onNavigate }: AppSidebarProps) {
  const { t } = useTranslation("common");
  const orgId = getOrgId();
  const orgName = getOrgName();

  return (
    <aside
      className={[
        "flex h-full w-64 flex-col border-r border-[var(--app-border)] bg-[var(--app-surface)]",
        className ?? "",
      ].join(" ")}
    >
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <SidebarNav onNavigate={onNavigate} />
      </div>
      <div className="border-t border-[var(--app-border)] px-3 py-4 text-xs text-[var(--app-muted)]">
        {orgId ? (
          <>
            <p className="break-all font-medium text-[var(--app-ink)]">
              {orgName || t("org.label", { orgId })}
            </p>
            {!orgName ? (
              <p className="mt-1 break-all opacity-70">{orgId}</p>
            ) : null}
            <div className="mt-3">
              <BranchSwitcher />
            </div>
          </>
        ) : (
          <p>{t("org.missing")}</p>
        )}
      </div>
    </aside>
  );
}
