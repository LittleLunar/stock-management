import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ForgotPasswordBody,
  LoginBody,
  ResetPasswordBody,
  SignupBody,
} from "@stock-management/shared";
import { authApi } from "../auth/api";
import { refreshSession } from "../auth/refresh";
import {
  clearSession,
  getAccessToken,
  setOrgContext,
} from "../auth/session";

export async function applyMeOrgContext(): Promise<void> {
  const me = await authApi.me();
  const membership = me.memberships[0];
  if (membership) {
    setOrgContext(membership.orgId, membership.orgName);
  }
  return;
}

export function useMe(enabled = true) {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => authApi.me(),
    enabled: enabled && Boolean(getAccessToken()),
    retry: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: LoginBody) => {
      await authApi.login(body);
      await applyMeOrgContext();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
}

export function useSignup() {
  return useMutation({
    mutationFn: (body: SignupBody) => authApi.signup(body),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (body: ForgotPasswordBody) => authApi.forgotPassword(body),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (body: ResetPasswordBody) => authApi.resetPassword(body),
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (token: string) => authApi.verifyEmail({ token }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        await authApi.logout();
      } finally {
        clearSession();
        qc.clear();
      }
    },
  });
}

export function useEnsureSession() {
  return useQuery({
    queryKey: ["auth", "session"],
    queryFn: async () => {
      if (getAccessToken()) return true;
      return refreshSession();
    },
    staleTime: Infinity,
    retry: false,
  });
}
