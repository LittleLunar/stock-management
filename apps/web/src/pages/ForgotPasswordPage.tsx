import { zodResolver } from "@hookform/resolvers/zod";
import { ForgotPasswordBodySchema } from "@stock-management/shared";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { useForgotPassword } from "../hooks/auth";
import { formatApiError } from "../lib/errors";
import { Button, Input } from "../ui";

type ForgotForm = z.infer<typeof ForgotPasswordBodySchema>;

export function ForgotPasswordPage() {
  const { t } = useTranslation("auth");
  const forgot = useForgotPassword();
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotForm>({
    resolver: zodResolver(ForgotPasswordBodySchema),
    defaultValues: { email: "" },
  });

  if (sent) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{t("auth.forgot.sentTitle")}</h1>
        <p className="text-sm text-[var(--app-muted)]">
          {t("auth.forgot.sentBody")}
        </p>
        <Link
          to="/login"
          className="inline-block text-sm text-[var(--app-brand)] hover:underline"
        >
          {t("auth.forgot.backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("auth.forgot.title")}</h1>
        <p className="mt-1 text-sm text-[var(--app-muted)]">
          {t("auth.forgot.subtitle")}
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => {
          forgot.mutate(values, {
            onSuccess: () => setSent(true),
            onError: (err) => toast.error(formatApiError(err)),
          });
        })}
      >
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="email">
            {t("auth.fields.email")}
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            {...register("email")}
          />
          {errors.email ? (
            <p className="mt-1 text-xs text-red-700">{errors.email.message}</p>
          ) : null}
        </div>
        <Button
          type="submit"
          fullWidth
          isPending={forgot.isPending}
          isDisabled={forgot.isPending}
        >
          {t("auth.forgot.submit")}
        </Button>
      </form>

      <Link
        to="/login"
        className="inline-block text-sm text-[var(--app-brand)] hover:underline"
      >
        {t("auth.forgot.backToLogin")}
      </Link>
    </div>
  );
}
