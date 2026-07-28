import { zodResolver } from "@hookform/resolvers/zod";
import { AcceptMembershipInviteBodySchema } from "@stock-management/shared";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { useAcceptInvite, useDeclineInvite } from "../hooks/auth";
import { formatApiError } from "../lib/errors";
import { Button, Input } from "../ui";

const AcceptFormSchema = AcceptMembershipInviteBodySchema.omit({
  token: true,
});
type AcceptForm = z.infer<typeof AcceptFormSchema>;

export function AcceptInvitePage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { token?: string };
  const token = search.token ?? "";
  const accept = useAcceptInvite();
  const decline = useDeclineInvite();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcceptForm>({
    resolver: zodResolver(AcceptFormSchema),
    defaultValues: { name: "", password: "" },
  });

  if (!token) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">
          {t("auth.invite.invalidTitle")}
        </h1>
        <p className="text-sm text-[var(--app-muted)]">
          {t("auth.invite.invalidBody")}
        </p>
        <Link
          to="/login"
          className="inline-block text-sm text-[var(--app-brand)] hover:underline"
        >
          {t("auth.invite.backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("auth.invite.title")}</h1>
        <p className="mt-1 text-sm text-[var(--app-muted)]">
          {t("auth.invite.subtitle")}
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => {
          accept.mutate(
            { token, name: values.name, password: values.password },
            {
              onSuccess: () => {
                toast.success(t("auth.invite.acceptSuccess"));
                void navigate({ to: "/login" });
              },
              onError: (err) => toast.error(formatApiError(err)),
            },
          );
        })}
      >
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="name">
            {t("auth.fields.name")}
          </label>
          <Input id="name" autoComplete="name" {...register("name")} />
          {errors.name ? (
            <p className="mt-1 text-xs text-red-700">{errors.name.message}</p>
          ) : null}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="password">
            {t("auth.fields.password")}
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register("password")}
          />
          {errors.password ? (
            <p className="mt-1 text-xs text-red-700">
              {errors.password.message}
            </p>
          ) : null}
        </div>
        <Button
          type="submit"
          fullWidth
          isPending={accept.isPending}
          isDisabled={accept.isPending || decline.isPending}
        >
          {t("auth.invite.accept")}
        </Button>
        <Button
          type="button"
          fullWidth
          variant="secondary"
          isPending={decline.isPending}
          isDisabled={accept.isPending || decline.isPending}
          onPress={() => {
            decline.mutate(
              { token },
              {
                onSuccess: () => {
                  toast.success(t("auth.invite.declineSuccess"));
                  void navigate({ to: "/login" });
                },
                onError: (err) => toast.error(formatApiError(err)),
              },
            );
          }}
        >
          {t("auth.invite.decline")}
        </Button>
      </form>
    </div>
  );
}
