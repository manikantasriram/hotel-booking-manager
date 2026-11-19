import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { useAuth } from "../auth/useAuth";
import { APP_NAME } from "../components/classes";
import { Button, ErrorNote, Field, Input } from "../components/ui";

// Public demo accounts, also listed in the README so recruiters can try the app.
const DEMO = [
  { label: "Admin", email: "admin@demo.dev", password: "admin-demo-2026", note: "manages hotels and rates" },
  { label: "Staff", email: "staff@demo.dev", password: "staff-demo-2026", note: "handles bookings" },
];

export function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <title>{`Sign in · ${APP_NAME}`}</title>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand text-lg font-bold text-white" aria-hidden="true">
            H
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Hotel Rate & Booking Manager</h1>
          <p className="mt-1 text-sm text-mute">Sign in to manage hotels, rates and bookings.</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-xl border border-line bg-white p-6" noValidate>
          <Field label="Email">
            {(id) => (
              <Input
                id={id}
                type="email"
                autoComplete="username"
                required
                aria-invalid={Boolean(error)}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>
          <Field label="Password">
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="current-password"
                required
                aria-invalid={Boolean(error)}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
          <ErrorNote error={error} />
          <Button type="submit" className="w-full" disabled={busy || !email || !password}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="mt-6 rounded-xl border border-dashed border-line p-4">
          <p className="text-sm font-medium">Try the demo</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {DEMO.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => {
                  setEmail(d.email);
                  setPassword(d.password);
                }}
                className="rounded-lg border border-line-strong bg-white px-3 py-2 text-left text-sm transition-colors hover:border-brand"
              >
                <span className="block font-medium">{d.label}</span>
                <span className="block text-xs text-mute">{d.note}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-mute">Fills in the form; then press Sign in.</p>
        </div>
      </div>
    </main>
  );
}
