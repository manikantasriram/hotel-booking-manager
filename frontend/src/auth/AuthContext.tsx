// Who is signed in, shared with every component through React context.
//
// On load we look for a saved token and ask the API "who am I?" (/api/auth/me). Signing in
// stores the token; signing out (or a 401 from the API) clears it and every cached query.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { API_URL, ApiError, http, setUnauthorizedHandler, tokenStore } from "../lib/api";
import type { User } from "../lib/types";
import { AuthContext, type AuthValue } from "./useAuth";



export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(() => tokenStore.get());

  const me = useQuery({
    queryKey: ["me", token],
    queryFn: () => http.get<User>("/api/auth/me"),
    enabled: token !== null,
    retry: false,
    staleTime: Infinity,
  });

  const signOut = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    qc.clear(); // forget all data that belonged to this user
  }, [qc]);

  useEffect(() => setUnauthorizedHandler(signOut), [signOut]);

  const signIn = useCallback(async (email: string, password: string) => {
    // The login endpoint follows the OAuth2 standard: a form body with "username" and "password".
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: email, password }),
    }).catch(() => {
      throw new ApiError(0, "Can't reach the server. If it was asleep, it can take up to a minute to wake up.");
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, body?.detail ?? "Sign-in failed");
    tokenStore.set(body.access_token);
    setToken(body.access_token);
  }, []);

  const value = useMemo<AuthValue>(() => {
    const user = token && me.data ? me.data : null;
    return {
      user,
      isLoading: token !== null && me.isPending,
      isAdmin: user?.role === "admin",
      signIn,
      signOut,
    };
  }, [token, me.data, me.isPending, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
