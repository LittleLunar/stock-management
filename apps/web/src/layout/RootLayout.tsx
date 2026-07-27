import { Outlet, useRouterState } from "@tanstack/react-router";
import { isAuthPublicPath } from "../auth/session";
import { AuthLayout } from "./AuthLayout";
import { RequireAuth } from "./RequireAuth";

/** Picks public auth shell vs authed AppShell based on pathname. */
export function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (isAuthPublicPath(pathname)) {
    return <AuthLayout />;
  }
  return <RequireAuth />;
}

/** Fallback if shells are composed differently. */
export function RootOutlet() {
  return <Outlet />;
}
