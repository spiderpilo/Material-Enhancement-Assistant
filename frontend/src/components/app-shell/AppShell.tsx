import type { ReactNode } from "react";

import { FloatingHelpButton } from "@/components/course-content-upload/FloatingHelpButton";
import {
  AppNavItemKey,
  SidebarNav,
} from "@/components/course-content-upload/SidebarNav";
import { TopHeader } from "@/components/course-content-upload/TopHeader";

type AppShellProps = {
  activeNavItem: AppNavItemKey;
  children: ReactNode;
  headerActions?: ReactNode;
  headerSearchPlaceholder?: string;
  headerTitle: string;
  showHeaderSearch?: boolean;
  showHelpButton?: boolean;
};

export function AppShell({
  activeNavItem,
  children,
  headerActions,
  headerSearchPlaceholder,
  headerTitle,
  showHeaderSearch = true,
  showHelpButton = true,
}: AppShellProps) {
  return (
    <main className="flex-1">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <SidebarNav activeItem={activeNavItem} />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopHeader
            title={headerTitle}
            actions={headerActions}
            searchPlaceholder={headerSearchPlaceholder}
            showSearch={showHeaderSearch}
          />

          <div className="flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
            {children}
          </div>
        </div>
      </div>

      {showHelpButton ? <FloatingHelpButton /> : null}
    </main>
  );
}
