"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { appService } from "@/lib/app-service";
import {
  beginIntentionalAuthExit,
  cancelIntentionalAuthExit
} from "@/lib/auth-navigation";
import type { AppUser } from "@/types";

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  mode: "firebase" | "local";
  login: (username: string, password: string) => Promise<AppUser>;
  logout: () => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<void>;
  refreshUser: () => Promise<AppUser | null>;
  updateUser: (
    patch: Partial<Omit<AppUser, "id" | "email" | "createdAt">>
  ) => Promise<AppUser>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void appService.initializeLocalDemo();
    const unsubscribe = appService.subscribeAuth((nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const nextUser = await appService.login(username, password);
    setUser(nextUser);
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    beginIntentionalAuthExit();
    try {
      await appService.logout();
      setUser(null);
    } catch (error) {
      cancelIntentionalAuthExit();
      throw error;
    }
  }, []);


  const refreshUser = useCallback(async () => {
    if (!user) return null;
    const refreshed = await appService.refreshUser(user.id);
    setUser(refreshed);
    return refreshed;
  }, [user]);

  const updateUser = useCallback(
    async (
      patch: Partial<Omit<AppUser, "id" | "email" | "createdAt">>
    ) => {
      if (!user) throw new Error("Please log in to continue.");
      const updated = await appService.updateUser(user.id, patch);
      setUser(updated);
      return updated;
    },
    [user]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!user) throw new Error("Please log in to continue.");
      await appService.changePassword(user.id, currentPassword, newPassword);
    },
    [user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      mode: appService.mode,
      login,
      logout,
      changePassword,
      refreshUser,
      updateUser
    }),
    [
      user,
      loading,
      login,
      logout,
      changePassword,
      refreshUser,
      updateUser
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
