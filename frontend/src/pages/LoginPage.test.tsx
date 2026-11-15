import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthProvider } from "../auth/AuthContext";
import { LoginPage } from "./LoginPage";

function renderLogin() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/login"]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<p>Signed in home</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("LoginPage", () => {
  it("shows the server's message when the password is wrong", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => json(401, { detail: "Incorrect email or password" }));
    renderLogin();
    await userEvent.type(screen.getByLabelText("Email"), "staff@demo.dev");
    await userEvent.type(screen.getByLabelText("Password"), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password");
  });

  it("signs in and goes to the dashboard", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/api/auth/login")) return json(200, { access_token: "t0k3n", token_type: "bearer" });
      if (url.endsWith("/api/auth/me"))
        return json(200, { id: 2, email: "staff@demo.dev", full_name: "Sam Staff", role: "staff" });
      return json(404, { detail: "Not found" });
    });
    renderLogin();
    // the demo button fills in the form
    await userEvent.click(screen.getByRole("button", { name: /staff/i }));
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Signed in home")).toBeInTheDocument();
    expect(localStorage.getItem("hbm.token")).toBe("t0k3n");
  });
});
