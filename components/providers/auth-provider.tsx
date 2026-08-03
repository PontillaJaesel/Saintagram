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
  register: (email: string, password: string) => Promise<AppUser>;
  login: (email: string, password: string) => Promise<AppUser>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<AppUser>;
  continueAsGuest: () => Promise<AppUser>;
  upgradeGuestWithGoogle: () => Promise<AppUser>;
  upgradeGuestWithEmail: (email: string, password: string) => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<void>;
  refreshUser: () => Promise<AppUser | null>;
  updateUser: (
    patch: Partial<Omit<AppUser, "id" | "email" | "createdAt">>
  ) => Promise<AppUser>;
  deleteAccount: (currentPassword: string) => Promise<void>;
  cancelAccountCreation: () => Promise<void>;
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

  const register = useCallback(async (email: string, password: string) => {
    const nextUser = await appService.register(email, password);
    if (appService.mode === "local") setUser(nextUser);
    return nextUser;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const nextUser = await appService.login(email, password);
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

  const requestPasswordReset = useCallback(async (email: string) => {
    await appService.requestPasswordReset(email);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const nextUser = await appService.signInWithGoogle();
    setUser(nextUser);
    return nextUser;
  }, []);

  const continueAsGuest = useCallback(async () => {
    const nextUser = await appService.continueAsGuest();
    setUser(nextUser);
    return nextUser;
  }, []);

  const upgradeGuestWithGoogle = useCallback(async () => {
    const nextUser = await appService.upgradeGuestWithGoogle();
    setUser(nextUser);
    return nextUser;
  }, []);

  const upgradeGuestWithEmail = useCallback(
    async (email: string, password: string) => {
      await appService.upgradeGuestWithEmail(email, password);
      setUser(null);
    },
    []
  );

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

  const deleteAccount = useCallback(async (currentPassword: string) => {
    if (!user) throw new Error("Please log in to continue.");
    beginIntentionalAuthExit();
    try {
      await appService.deleteAllUserData(user.id, currentPassword);
      setUser(null);
    } catch (error) {
      cancelIntentionalAuthExit();
      throw error;
    }
  }, [user]);

  const cancelAccountCreation = useCallback(async () => {
    if (!user) throw new Error("Please log in to continue.");
    beginIntentionalAuthExit();
    try {
      await appService.cancelAccountCreation(user.id);
      setUser(null);
    } catch (error) {
      cancelIntentionalAuthExit();
      throw error;
    }
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      mode: appService.mode,
      register,
      login,
      logout,
      requestPasswordReset,
      signInWithGoogle,
      continueAsGuest,
      upgradeGuestWithGoogle,
      upgradeGuestWithEmail,
      changePassword,
      refreshUser,
      updateUser,
      deleteAccount,
      cancelAccountCreation
    }),
    [
      user,
      loading,
      register,
      login,
      logout,
      requestPasswordReset,
      signInWithGoogle,
      continueAsGuest,
      upgradeGuestWithGoogle,
      upgradeGuestWithEmail,
      changePassword,
      refreshUser,
      updateUser,
      deleteAccount,
      cancelAccountCreation
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
