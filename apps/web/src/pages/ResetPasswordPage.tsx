import { zodResolver } from "@hookform/resolvers/zod";
import { ResetPasswordBodySchema } from "@stock-management/shared";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { useResetPassword } from "../hooks/auth";
import { formatApiError } from "../lib/errors";
import { Button, Input } from "../ui";

const ResetFormSchema = ResetPasswordBodySchema.omit({ token: true }).extend({
  newPassword: z.string().min(8).max(128),
});
type ResetForm = z.infer<typeof ResetFormSchema>;

export function ResetPasswordPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { token?: string };
  const token = search.token ?? "";
  const reset = useResetPassword();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetForm>({
    resolver: zodResolver(ResetFormSchema),
    defaultValues: { newPassword: "" },
  });

  if (!token) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{t("auth.reset.invalidTitle")}</h1>
        <p className="text-sm text-[var(--app-muted)]">
          {t("auth.reset.invalidBody")}
        </p>
        <Link
          to="/forgot-password"
          className="inline-block text-sm text-[var(--app-brand)] hover:underline"
        >
          {t("auth.reset.requestNew")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("auth.reset.title")}</h1>
        <p className="mt-1 text-sm text-[var(--app-muted)]">
          {t("auth.reset.subtitle")}
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => {
          reset.mutate(
            { token, newPassword: values.newPassword },
            {
              onSuccess: () => {
                toast.success(t("auth.reset.success"));
                void navigate({ to: "/login" });
              },
              onError: (err) => toast.error(formatApiError(err)),
            },
          );
        })}
      >
        <div>
          <label
            className="mb-1 block text-sm font-medium"
            htmlFor="newPassword"
          >
            {t("auth.fields.newPassword")}
          </label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            {...register("newPassword")}
          />
          {errors.newPassword ? (
            <p className="mt-1 text-xs text-red-700">
              {errors.newPassword.message}
            </p>
          ) : null}
        </div>
        <Button
          type="submit"
          fullWidth
          isPending={reset.isPending}
          isDisabled={reset.isPending}
        >
          {t("auth.reset.submit")}
        </Button>
      </form>
    </div>
  );
}
