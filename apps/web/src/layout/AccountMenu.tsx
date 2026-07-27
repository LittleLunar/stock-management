import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { getOrgId, getOrgName } from "../auth/session";
import { useLogout, useMe } from "../hooks/auth";
import { formatApiError } from "../lib/errors";
import { Avatar, Button, Dropdown } from "../ui";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function shortId(id: string): string {
  if (!id) return "—";
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…`;
}

export function AccountMenu() {
  const { t } = useTranslation("common");
  const { t: ta } = useTranslation("auth");
  const navigate = useNavigate();
  const { data: me } = useMe();
  const logout = useLogout();
  const orgId = getOrgId();
  const orgName = getOrgName();
  const displayName = me?.user.name ?? me?.user.email ?? t("account.label");

  return (
    <Dropdown>
      <Dropdown.Trigger>
        <Button
          isIconOnly
          variant="ghost"
          size="sm"
          aria-label={t("account.menu")}
          className="rounded-full"
        >
          <Avatar size="sm" className="size-8">
            <Avatar.Fallback className="bg-[var(--app-brand)] text-xs text-[var(--app-brand-fg)]">
              {initialsFromName(displayName)}
            </Avatar.Fallback>
          </Avatar>
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end" className="min-w-52">
        <Dropdown.Menu
          onAction={(key) => {
            if (key === "logout") {
              logout.mutate(undefined, {
                onSuccess: () => {
                  void navigate({ to: "/login" });
                },
                onError: (err) => {
                  toast.error(formatApiError(err));
                  void navigate({ to: "/login" });
                },
              });
            }
          }}
        >
          <Dropdown.Item
            id="account"
            textValue={displayName}
            isDisabled
            label={displayName}
          />
          {orgName || orgId ? (
            <Dropdown.Item
              id="org"
              textValue={orgName || orgId}
              isDisabled
              label={
                orgName
                  ? t("account.orgName", { orgName })
                  : t("account.org", { orgId: shortId(orgId) })
              }
            />
          ) : null}
          <Dropdown.Item
            id="logout"
            textValue={ta("auth.logout")}
            label={ta("auth.logout")}
          />
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
