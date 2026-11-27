import { cn } from "cn";
import { CircleAlert, Menu, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, useFetcher, useLoaderData } from "react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { requireTeacherLoader, signOutAction } from "../session";

const NAV_ITEMS = [
  { to: "/questions", label: "Questions" },
  { to: "/tests", label: "Tests" },
] as const;

// NavLink sets aria-current="page" on the current link. The underline (or side bar in the
// phone menu) and the weight mark it too, so colour is never the only signal (DESIGN.md).
function topLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    "inline-flex h-11 items-center border-b-2 px-3 text-base",
    isActive
      ? "border-primary font-semibold text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
  );
}

function menuLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    "flex min-h-11 items-center border-l-4 px-4 text-base",
    isActive
      ? "border-primary font-semibold text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
  );
}

// The teacher app shell: top bar, the phone menu below `md`, and the user menu (DESIGN.md
// Navigation). Each page renders its own H1 inside <main>.
export function TeacherLayout() {
  const { email } = useLoaderData<typeof requireTeacherLoader>();
  const signOut = useFetcher<typeof signOutAction>();
  const [menuOpen, setMenuOpen] = useState(false);
  const signingOut = signOut.state !== "idle";

  return (
    <div className="min-h-dvh">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-2 sm:px-4">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>GradeLink</SheetTitle>
                <SheetDescription className="sr-only">Main navigation</SheetDescription>
              </SheetHeader>
              <nav aria-label="Main">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={menuLinkClass}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          <Link
            to="/"
            className="inline-flex h-11 items-center px-2 text-lg font-semibold text-foreground"
          >
            GradeLink
          </Link>

          <nav aria-label="Main" className="hidden md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} className={topLinkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" aria-label={`Account menu for ${email}`}>
                  <UserRound aria-hidden="true" />
                  <span className="hidden max-w-48 truncate sm:inline">{email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-auto min-w-56">
                <DropdownMenuLabel className="truncate text-sm font-normal text-muted-foreground">
                  {email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="min-h-11 text-base"
                  disabled={signingOut}
                  onSelect={() => {
                    signOut.submit(null, { method: "post", action: "/sign-out" });
                  }}
                >
                  {signingOut ? "Signing out..." : "Sign out"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Always rendered, so the error is announced when it appears. */}
      <div aria-live="polite" className="mx-auto max-w-5xl px-4 sm:px-6">
        {signOut.data?.error ? (
          <p className="mt-4 flex items-start gap-2 rounded-md bg-destructive-tint p-3 text-destructive">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            {signOut.data.error}
          </p>
        ) : null}
      </div>

      <main className="mx-auto max-w-5xl p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  );
}
