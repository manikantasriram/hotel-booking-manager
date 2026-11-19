import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { useAuth } from "./auth/useAuth";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/ui";
import { LoginPage } from "./pages/LoginPage";

// Signed-in pages are downloaded only when first opened, so the sign-in screen loads fast
// (it doesn't need the table, form and validation code).
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const HotelsPage = lazy(() => import("./pages/HotelsPage").then((m) => ({ default: m.HotelsPage })));
const HotelDetailPage = lazy(() => import("./pages/HotelDetailPage").then((m) => ({ default: m.HotelDetailPage })));
const BookingsPage = lazy(() => import("./pages/BookingsPage").then((m) => ({ default: m.BookingsPage })));
const NewBookingPage = lazy(() => import("./pages/NewBookingPage").then((m) => ({ default: m.NewBookingPage })));

const page = (element: ReactNode) => <Suspense fallback={<Spinner label="Loading page" />}>{element}</Suspense>;

/** Sends signed-out visitors to /login, then back to where they were going. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <Spinner label="Checking your session" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={page(<DashboardPage />)} />
        <Route path="hotels" element={page(<HotelsPage />)} />
        <Route path="hotels/:hotelId" element={page(<HotelDetailPage />)} />
        <Route path="bookings" element={page(<BookingsPage />)} />
        <Route path="bookings/new" element={page(<NewBookingPage />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
