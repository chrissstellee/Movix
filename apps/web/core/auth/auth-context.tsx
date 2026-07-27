"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { AuthenticatedSession, AuthenticatedUser } from "@repo/stellar/auth";

interface AuthState {
  accessToken: string | null;
  expiresAt: number;
  isLoading: boolean;
  user: AuthenticatedUser | null;
}

interface AuthContextValue extends AuthState {
  establishSession(session: AuthenticatedSession): void;
  fetchAccessToken(args: { forceRefreshToken: boolean }): Promise<string | null>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function withCrossTabLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("movix-session-refresh", task);
  }
  return task();
}

export function MovixAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    accessToken: null,
    expiresAt: 0,
    isLoading: true,
    user: null,
  });
  const stateRef = useRef(state);
  const refreshRequest = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const establishSession = useCallback((session: AuthenticatedSession) => {
    const next = {
      accessToken: session.accessToken,
      expiresAt: session.expiresAt,
      isLoading: false,
      user: session.user,
    };
    stateRef.current = next;
    setState(next);
  }, []);

  const refresh = useCallback(() => {
    if (refreshRequest.current) {
      return refreshRequest.current;
    }

    refreshRequest.current = withCrossTabLock(async () => {
      const requestRefresh = () =>
        fetch("/api/auth/token", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          cache: "no-store",
        });
      let response = await requestRefresh();
      if (response.status === 409) {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        response = await requestRefresh();
      }
      if (!response.ok) {
        const next = {
          accessToken: null,
          expiresAt: 0,
          isLoading: false,
          user: null,
        };
        stateRef.current = next;
        setState(next);
        return null;
      }
      const session = (await response.json()) as AuthenticatedSession;
      establishSession(session);
      return session.accessToken;
    }).finally(() => {
      refreshRequest.current = null;
    });

    return refreshRequest.current;
  }, [establishSession]);

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      const current = stateRef.current;
      if (!forceRefreshToken && current.accessToken && current.expiresAt - Date.now() > 30_000) {
        return current.accessToken;
      }
      return refresh();
    },
    [refresh],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    const next = {
      accessToken: null,
      expiresAt: 0,
      isLoading: false,
      user: null,
    };
    stateRef.current = next;
    setState(next);
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("LOGOUT_FAILED");
    }
  }, []);

  const value = useMemo(
    () => ({ ...state, establishSession, fetchAccessToken, logout }),
    [establishSession, fetchAccessToken, logout, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useMovixAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useMovixAuth must be used inside MovixAuthProvider");
  }
  return value;
}

export function useConvexAuthAdapter() {
  const auth = useMovixAuth();
  return useMemo(
    () => ({
      isLoading: auth.isLoading,
      isAuthenticated: Boolean(auth.accessToken),
      fetchAccessToken: auth.fetchAccessToken,
    }),
    [auth.accessToken, auth.fetchAccessToken, auth.isLoading],
  );
}
