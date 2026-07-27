import { useTranslation } from "react-i18next";
import { Avatar, Button, Dropdown } from "../ui";

function initialsFromId(id: string): string {
  if (!id) return "?";
  const compact = id.replace(/-/g, "");
  return compact.slice(0, 2).toUpperCase();
}

function shortId(id: string): string {
  if (!id) return "—";
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…`;
}

export function AccountMenu() {
  const { t } = useTranslation("common");
  const orgId = localStorage.getItem("orgId") ?? "";
  const userId =
    localStorage.getItem("userId") ??
    "00000000-0000-0000-0000-000000000001";

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
              {initialsFromId(userId)}
            </Avatar.Fallback>
          </Avatar>
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end" className="min-w-52">
        <Dropdown.Menu>
          <Dropdown.Item
            id="account"
            textValue={t("account.label")}
            isDisabled
            label={t("account.label")}
          />
          {orgId ? (
            <Dropdown.Item
              id="org"
              textValue={orgId}
              isDisabled
              label={t("account.org", { orgId: shortId(orgId) })}
            />
          ) : null}
          <Dropdown.Item
            id="user"
            textValue={userId}
            isDisabled
            label={t("account.user", { userId: shortId(userId) })}
          />
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
