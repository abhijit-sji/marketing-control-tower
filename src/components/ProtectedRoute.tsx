import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

type UserRole = 'super_admin' | 'manager' | 'pm' | 'content_creator' | 'marketing' | 'user';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole;
  requiredMinimumRole?: UserRole;
}

export default function ProtectedRoute({
  children,
  requiredRole,
  requiredMinimumRole
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check specific role requirement
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Check minimum role requirement
  if (requiredMinimumRole) {
    const roleHierarchy: Record<UserRole, number> = {
      'user': 1,
      'content_creator': 2,
      'marketing': 2,
      'pm': 3,
      'manager': 4,
      'super_admin': 5
    };

    if (roleHierarchy[user.role] < roleHierarchy[requiredMinimumRole]) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
}