import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { BrandMark, BrandWordmark } from "@/components/brand-logo";
import {
  Activity,
  Award,
  Bell,
  CalendarDays,
  ClipboardList,
  Zap,
  CreditCard,
  Menu,
  MessageCircle,
  GraduationCap,
  History,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Wallet,
  Gift,
  MessagesSquare,
  Users,
  UserCheck,
  Video,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ComponentType, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { displayName, initialsOf, useSession } from "@/lib/session";
import { useNotifications, useRealtimeInbox } from "@/lib/messaging";
import { useMyRole } from "@/lib/tutoring";
import { useClaimPendingReferral } from "@/lib/referrals";
import {
  PENDING_ALLOWED_PATHS,
  STATUS_LABEL,
  hasPlatformAccess,
  useApprovalAdmin,
  useMyApproval,
  usePendingApprovalCount,
} from "@/lib/approvals";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge?: number;
};

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/classes", label: "Classes", icon: GraduationCap },
  { to: "/tutors", label: "Tutors", icon: Users },
  { to: "/assignments", label: "Assignments", icon: ClipboardList },
  { to: "/loop", label: "Loop", icon: Zap },
  { to: "/history", label: "History", icon: History },
  { to: "/recordings", label: "Recordings", icon: Video },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/referrals", label: "Referrals", icon: Gift },
  { to: "/assistant", label: "Ask Hoot", icon: MessagesSquare },
];

function useNavItems(
  role: string | undefined | null,
  isApprovalAdmin: boolean,
  pendingCount: number,
): NavItem[] {
  const items = [...NAV];
  if (isApprovalAdmin)
    items.push({
      to: "/approvals",
      label: "My Approvals",
      icon: UserCheck,
      badge: pendingCount,
    });
  if (role === "admin") items.push({ to: "/admin", label: "Tutor manager", icon: ShieldCheck });
  if (role === "tutor" || role === "admin")
    items.push({ to: "/mentor", label: "Mentor portal", icon: Award });
  if (role !== "tutor") items.push({ to: "/billing", label: "Billing", icon: CreditCard });
  if (role === "tutor" || role === "admin")
    items.push({ to: "/payouts", label: "Payouts", icon: Wallet });
  if (role === "admin") items.push({ to: "/oversight", label: "Oversight", icon: Activity });
  return items;
}


function NavLinks({
  items,
  pathname,
  showLabels,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  showLabels: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ to, label, icon: Icon, badge }) => {
        const active = pathname === to || pathname.startsWith(`${to}/`);
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            title={label}
            className={cn(
              "relative flex items-center gap-3 rounded-full px-3 py-2 text-sm font-medium text-ink-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-ink-foreground",
              active &&
                "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <span className="relative shrink-0">
              <Icon className="size-4" />
              {!!badge && badge > 0 && !showLabels && (
                <span className="absolute -right-1.5 -top-1.5 size-2 rounded-full bg-accent" />
              )}
            </span>
            <span
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 truncate whitespace-nowrap transition-opacity duration-150",
                showLabels ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              {label}
              {!!badge && badge > 0 && (
                <span className="ml-auto rounded-full bg-accent px-2 text-[10px] font-semibold text-accent-foreground">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </span>
          </Link>

        );
      })}
    </nav>
  );
}

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: role } = useMyRole(user?.id);
  const name = displayName(user);
  useRealtimeInbox(user?.id);
  useClaimPendingReferral(user?.id);
  const { data: notifications } = useNotifications(user?.id);
  const unread = (notifications ?? []).filter((n) => !n.read_at).length;
  const { data: approvalAdmin } = useApprovalAdmin(user?.id);
  const isApprovalAdmin = !!approvalAdmin?.isAdmin;
  const { data: pendingCount } = usePendingApprovalCount(isApprovalAdmin);
  const { data: myApproval } = useMyApproval(user?.id);
  const items = useNavItems(role, isApprovalAdmin, pendingCount ?? 0);
  const blocked =
    !!myApproval &&
    !hasPlatformAccess(myApproval.status) &&
    !isApprovalAdmin &&
    !PENDING_ALLOWED_PATHS.some((p) => pathname.startsWith(p));
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Auto-hiding left sidebar (desktop) */}
      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        onFocusCapture={() => setExpanded(true)}
        onBlurCapture={() => setExpanded(false)}
        className={cn(
          "surface-ink fixed inset-y-0 left-0 z-40 hidden flex-col overflow-hidden border-r border-sidebar-border p-3 transition-[width] duration-200 ease-out md:flex",
          expanded ? "w-56 shadow-xl" : "w-16",
        )}
      >
        <Link to="/dashboard" className="mb-4 flex items-center gap-2 px-1 text-lg">
          <BrandMark />
          <span
            className={cn(
              "transition-opacity duration-150",
              expanded ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <BrandWordmark />
          </span>
        </Link>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <NavLinks items={items} pathname={pathname} showLabels={expanded} />
        </div>
      </aside>

      <div className="md:pl-16">
        <header className="surface-ink sticky top-0 z-30 border-b border-sidebar-border">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-4">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="surface-ink w-64 p-3">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <Link
                  to="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="mb-4 flex items-center gap-2 px-1 text-lg"
                >
                  <BrandMark />
                  <BrandWordmark />
                </Link>
                <NavLinks
                  items={items}
                  pathname={pathname}
                  showLabels
                  onNavigate={() => setMobileOpen(false)}
                />
              </SheetContent>
            </Sheet>

            <Link to="/dashboard" className="flex items-center gap-2 text-lg md:hidden">
              <BrandMark />
              <BrandWordmark />
            </Link>

            <div className="ml-auto flex items-center gap-3">
              <Link
                to="/notifications"
                aria-label="Notifications"
                className="relative grid size-9 place-items-center rounded-full text-ink-foreground/80 transition-colors hover:bg-sidebar-accent"
              >
                <Bell className="size-4" />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium leading-tight">{name}</p>
                {role && (
                  <Badge variant="secondary" className="mt-0.5 capitalize">
                    {role}
                  </Badge>
                )}
              </div>
              <Avatar className="size-9 border border-sidebar-border">
                <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground">
                  {initialsOf(name)}
                </AvatarFallback>
              </Avatar>
              <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out">
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
        </header>

        {pathname !== "/assistant" && (
          <Link
            to="/assistant"
            aria-label="Ask Hoot, the myNexClass assistant"
            className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground shadow-lg transition-transform hover:scale-105"
          >
            <MessagesSquare className="size-5" />
            Ask Hoot
          </Link>
        )}

        <main className="mx-auto max-w-6xl px-5 py-8">
          {blocked ? (
            <div className="mx-auto max-w-xl rounded-2xl border bg-card p-10 text-center">
              <h1 className="text-2xl font-semibold">
                {myApproval ? STATUS_LABEL[myApproval.status] : "Awaiting approval"}
              </h1>
              <p className="mt-3 text-muted-foreground">
                An administrator has to approve your registration before you can use myNexClass.
                We&apos;ll email you as soon as there&apos;s a decision.
              </p>
              <Button className="mt-6" asChild>
                <Link to="/approval-status">View your registration status</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-semibold">{title}</h1>
                  {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
                </div>
                {actions}
              </div>
              {children}
            </>
          )}
        </main>

      </div>
    </div>
  );
}
