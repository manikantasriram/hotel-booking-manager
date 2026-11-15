import { useState } from "react";
import { NavLink, Outlet } from "react-router";
import { useAuth } from "../auth/useAuth";
import { Badge } from "./ui";

const links = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/hotels", label: "Hotels" },
  { to: "/bookings", label: "Bookings", end: true },
  { to: "/bookings/new", label: "New booking" },
];

/** The frame around every signed-in page: a sidebar (a top bar on phones) and the page itself. */
export function Layout() {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>

      <aside className="border-b border-line bg-white lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-5 py-4">
          <NavLink to="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm font-bold text-white" aria-hidden="true">
              H
            </span>
            Hotel Manager
          </NavLink>
          <button
            type="button"
            className="rounded-lg border border-line px-3 py-1.5 text-sm lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="main-nav"
            onClick={() => setMenuOpen((o) => !o)}
          >
            Menu
          </button>
        </div>

        <div id="main-nav" className={`${menuOpen ? "block" : "hidden"} lg:flex lg:h-[calc(100dvh-4rem)] lg:flex-col`}>
          <nav aria-label="Main" className="flex flex-col gap-1 px-3 pb-3">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end ?? false}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-brand-soft text-brand" : "text-mute hover:bg-slate-50 hover:text-ink"}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          {user && (
            <div className="mt-auto border-t border-line p-4">
              <p className="truncate text-sm font-medium">{user.full_name}</p>
              <p className="truncate text-xs text-mute">{user.email}</p>
              <div className="mt-2 flex items-center justify-between">
                <Badge tone={user.role === "admin" ? "blue" : "slate"}>{user.role}</Badge>
                <button type="button" onClick={signOut} className="text-sm font-medium text-mute hover:text-ink">
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      <main id="main" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <Outlet />
      </main>
    </div>
  );
}
