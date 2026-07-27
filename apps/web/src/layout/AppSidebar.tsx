import { zodResolver } from "@hookform/resolvers/zod";
import { CreateOrganizationSchema } from "@stock-management/shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { api } from "../api/client";
import { SidebarNav } from "../components/SidebarNav";
import { useBranches } from "../hooks/masters";
import { formatApiError } from "../lib/errors";
import { Button, Input, Select } from "../ui";

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

function OrgBootstrap() {
  const { t } = useTranslation("common");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(CreateOrganizationSchema),
    defaultValues: { name: "Demo Shop" },
  });

  async function bootstrap(values: z.infer<typeof CreateOrganizationSchema>) {
    try {
      const userId = "00000000-0000-0000-0000-000000000001";
      localStorage.setItem("userId", userId);
      const org = await api.createOrg(userId, values);
      localStorage.setItem("orgId", org.id);
      window.location.reload();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  }

  return (
    <form className="space-y-2" onSubmit={handleSubmit(bootstrap)}>
      <Input
        placeholder={t("org.namePlaceholder")}
        {...register("name")}
      />
      {errors.name && (
        <p className="text-xs text-red-700">{errors.name.message}</p>
      )}
      <Button type="submit" fullWidth size="sm" isDisabled={isSubmitting}>
        {t("org.create")}
      </Button>
    </form>
  );
}

type AppSidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

export function AppSidebar({ className, onNavigate }: AppSidebarProps) {
  const { t } = useTranslation("common");
  const orgId = localStorage.getItem("orgId") ?? "";

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
            <p className="break-all">{t("org.label", { orgId })}</p>
            <div className="mt-3">
              <BranchSwitcher />
            </div>
          </>
        ) : (
          <OrgBootstrap />
        )}
      </div>
    </aside>
  );
}
