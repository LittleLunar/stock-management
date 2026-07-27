import { useTranslation } from "react-i18next";
import { Button, Icon, Popover } from "../ui";

export function NotificationBell() {
  const { t } = useTranslation("common");

  return (
    <Popover>
      <Popover.Trigger>
        <Button
          isIconOnly
          variant="ghost"
          size="sm"
          aria-label={t("notifications.label")}
        >
          <Icon name="notification" size={20} />
        </Button>
      </Popover.Trigger>
      <Popover.Content placement="bottom end" className="min-w-56">
        <Popover.Dialog className="p-3">
          <Popover.Heading className="text-sm font-semibold">
            {t("notifications.label")}
          </Popover.Heading>
          <p className="mt-2 text-sm text-[var(--app-muted)]">
            {t("notifications.empty")}
          </p>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
