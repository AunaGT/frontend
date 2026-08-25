/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AuthContext, type AuthUser } from "./AuthContext";
import { fetchMe, logoutRequest } from "@/services/authService";

const AUTH_KEY = "auth:isAuthenticated";
const USER_KEY = "auth:user";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Start as loading
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    // Cache optimista para evitar parpadeo; la verdad la da /auth/me (lee la cookie httpOnly).
    const cached = localStorage.getItem(USER_KEY);
    if (cached) {
      try {
        setUser(JSON.parse(cached));
        setIsAuthenticated(true);
      } catch {
        /* cache corrupta: la ignoramos */
      }
    }

    fetchMe()
      .then(({ user }) => {
        setUser(user);
        setIsAuthenticated(true);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      })
      .catch(() => {
        // Sin sesión válida (ni siquiera tras intentar refresh).
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem(USER_KEY);
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    localStorage.setItem(AUTH_KEY, String(isAuthenticated));
  }, [isAuthenticated]);

  useEffect(() => {
    const onUnauthorized = () => {
      localStorage.removeItem(USER_KEY);
      setIsAuthenticated(false);
      setUser(null);
    };
    
    const onUserUpdated = (event: CustomEvent) => {
      const updatedUser = event.detail;
      setUser(updatedUser);
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    };
    
    window.addEventListener("auth:unauthorized", onUnauthorized);
    window.addEventListener("auth:userUpdated", onUserUpdated as EventListener);
    
    return () => {
      window.removeEventListener("auth:unauthorized", onUnauthorized);
      window.removeEventListener("auth:userUpdated", onUserUpdated as EventListener);
    };
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated,
      isLoading,
      user,
      login: () => {
        setIsAuthenticated(true);
        const storedUser = localStorage.getItem(USER_KEY);
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
          } catch (e) {
            console.error("Error parsing user on login:", e);
          }
        }
      },
      refreshUser: async () => {
        const { user: fresh } = await fetchMe();
        setUser(fresh);
        localStorage.setItem(USER_KEY, JSON.stringify(fresh));
      },
      logout: () => {
        void logoutRequest(); // revoca el refresh token en el backend (best-effort)
        localStorage.removeItem(USER_KEY);
        setIsAuthenticated(false);
        setUser(null);
        // Datos sensibles por usuario (mi ficha de RRHH, sueldo, cajas, lo que
        // sea) quedaban en la caché de react-query después de cerrar sesión —
        // si otra persona entra en el mismo navegador sin recargar, el primer
        // render podía mostrar por un instante los datos de la sesión anterior.
        queryClient.clear();
      },
    }),
    [isAuthenticated, isLoading, user, queryClient]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
