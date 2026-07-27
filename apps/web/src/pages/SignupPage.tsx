import { zodResolver } from "@hookform/resolvers/zod";
import { SignupBodySchema } from "@stock-management/shared";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { useSignup } from "../hooks/auth";
import { formatApiError } from "../lib/errors";
import { Button, Input } from "../ui";

type SignupForm = z.infer<typeof SignupBodySchema>;

export function SignupPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const signup = useSignup();
  const [doneEmail, setDoneEmail] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(SignupBodySchema),
    defaultValues: { name: "", email: "", password: "", orgName: "" },
  });

  if (doneEmail) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{t("auth.signup.checkEmailTitle")}</h1>
        <p className="text-sm text-[var(--app-muted)]">
          {t("auth.signup.checkEmailBody", { email: doneEmail })}
        </p>
        <Link
          to="/login"
          className="inline-block text-sm text-[var(--app-brand)] hover:underline"
        >
          {t("auth.signup.backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("auth.signup.title")}</h1>
        <p className="mt-1 text-sm text-[var(--app-muted)]">
          {t("auth.signup.subtitle")}
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => {
          signup.mutate(values, {
            onSuccess: () => setDoneEmail(values.email),
            onError: (err) => toast.error(formatApiError(err)),
          });
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
            autoComplete="new-password"
            {...register("password")}
          />
          {errors.password ? (
            <p className="mt-1 text-xs text-red-700">
              {errors.password.message}
            </p>
          ) : null}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="orgName">
            {t("auth.fields.orgName")}
          </label>
          <Input id="orgName" {...register("orgName")} />
          {errors.orgName ? (
            <p className="mt-1 text-xs text-red-700">{errors.orgName.message}</p>
          ) : null}
        </div>
        <Button
          type="submit"
          fullWidth
          isPending={signup.isPending}
          isDisabled={signup.isPending}
        >
          {t("auth.signup.submit")}
        </Button>
      </form>

      <p className="text-sm text-[var(--app-muted)]">
        {t("auth.signup.hasAccount")}{" "}
        <button
          type="button"
          className="text-[var(--app-brand)] hover:underline"
          onClick={() => void navigate({ to: "/login" })}
        >
          {t("auth.signup.loginLink")}
        </button>
      </p>
    </div>
  );
}
