import { Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Drawer, useOverlayState } from "../ui";
import { AppSidebar } from "./AppSidebar";
import { TopNavbar } from "./TopNavbar";

export function AppShell() {
  const { t } = useTranslation("common");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navState = useOverlayState({ defaultOpen: false });
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (prevPathname.current === pathname) return;
    prevPathname.current = pathname;
    navState.close();
  }, [pathname, navState]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--app-canvas)] text-[var(--app-ink)]">
      <TopNavbar
        showMenuButton
        onOpenNav={() => navState.open()}
      />

      <div className="flex min-h-0 flex-1">
        <div className="hidden md:block md:shrink-0">
          <div className="sticky top-14 h-[calc(100vh-3.5rem)]">
            <AppSidebar />
          </div>
        </div>

        <main className="min-w-0 flex-1 overflow-x-auto px-4 py-5 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      <Drawer state={navState}>
        <Drawer.Backdrop>
          <Drawer.Content placement="left">
            <Drawer.Dialog
              aria-label={t("nav.openMenu")}
              className="h-full max-w-[18rem] rounded-none"
            >
              <Drawer.Header className="flex items-center justify-between border-b border-[var(--app-border)] px-3 py-3">
                <Drawer.Heading className="text-sm font-semibold tracking-[0.14em] text-[var(--app-brand)] uppercase">
                  {t("brand.name")}
                </Drawer.Heading>
                <Drawer.CloseTrigger aria-label={t("nav.closeMenu")} />
              </Drawer.Header>
              <Drawer.Body className="p-0">
                <AppSidebar
                  className="w-full border-r-0"
                  onNavigate={() => navState.close()}
                />
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
    </div>
  );
}
