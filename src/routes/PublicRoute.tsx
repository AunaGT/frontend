/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/useAuth";

// Public pages accessible only when NOT authenticated (e.g., login)
const PublicRoute = () => {
  const { isAuthenticated, user } = useAuth();
  return isAuthenticated ? <Navigate to={user?.must_change_password ? '/cambiar-contrasena' : '/'} replace /> : <Outlet />;
};

export default PublicRoute;
