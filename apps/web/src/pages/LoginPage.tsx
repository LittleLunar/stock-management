import { zodResolver } from "@hookform/resolvers/zod";
import { LoginBodySchema } from "@stock-management/shared";
import { Link, useSearch } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { safeNextPath } from "../auth/session";
import { useLogin } from "../hooks/auth";
import { formatApiError } from "../lib/errors";
import { Button, Input } from "../ui";

const LoginFormSchema = LoginBodySchema;
type LoginForm = z.infer<typeof LoginFormSchema>;

export function LoginPage() {
  const { t } = useTranslation("auth");
  const search = useSearch({ strict: false }) as {
    next?: string;
    verified?: string;
  };
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(LoginFormSchema),
    defaultValues: { email: "", password: "" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("auth.login.title")}</h1>
        <p className="mt-1 text-sm text-[var(--app-muted)]">
          {t("auth.login.subtitle")}
        </p>
      </div>

      {search.verified === "1" ? (
        <p className="rounded border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
          {t("auth.verify.success")}
        </p>
      ) : null}

      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => {
          login.mutate(values, {
            onSuccess: () => {
              const next = safeNextPath(search.next);
              window.location.assign(next);
            },
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
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="password">
            {t("auth.fields.password")}
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
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
          isPending={login.isPending}
          isDisabled={login.isPending}
        >
          {t("auth.login.submit")}
        </Button>
      </form>

      <div className="flex flex-col gap-2 text-sm">
        <Link
          to="/forgot-password"
          className="text-[var(--app-brand)] hover:underline"
        >
          {t("auth.login.forgot")}
        </Link>
        <p className="text-[var(--app-muted)]">
          {t("auth.login.noAccount")}{" "}
          <Link to="/signup" className="text-[var(--app-brand)] hover:underline">
            {t("auth.login.signupLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
