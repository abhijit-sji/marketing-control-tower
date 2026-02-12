import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

type UserRole = 'super_admin' | 'manager' | 'pm' | 'content_creator' | 'marketing' | 'user';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  brandAccess?: string[];
}

interface AuthContextType {
  user: User | null;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  loading: boolean;
  hasRole: (role: UserRole) => boolean;
  hasMinimumRole: (role: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Role hierarchy for permission checking
  const roleHierarchy: Record<UserRole, number> = {
    'user': 1,
    'content_creator': 2,
    'marketing': 2,
    'pm': 3,
    'manager': 4,
    'super_admin': 5
  };

  // Fetch user profile from custom users table and role from user_roles table
  const fetchUserProfile = async (authUser: SupabaseUser): Promise<User | null> => {
    try {
      // Fetch user profile data
      const { data: userProfile, error: userError } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, status')
        .eq('id', authUser.id)
        .maybeSingle();

      if (userError) {
        console.error('[Auth] Error fetching user profile:', userError);
        return null;
      }

      if (!userProfile) {
        console.warn('[Auth] No user profile found for authenticated user');
        return null;
      }

      // Fetch all roles from user_roles table (secure separate table)
      // User may have multiple roles, we take the highest priority one
      const { data: rolesData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authUser.id);

      if (roleError) {
        console.error('Error fetching user roles:', roleError);
      }

      // Determine highest role from user's roles
      let highestRole: UserRole = 'user';
      if (rolesData && rolesData.length > 0) {
        const userRoles = rolesData.map(r => r.role as UserRole);
        // Find the role with highest hierarchy value
        highestRole = userRoles.reduce((highest, current) => {
          return roleHierarchy[current] > roleHierarchy[highest] ? current : highest;
        }, 'user' as UserRole);
      }

      const profile = {
        id: userProfile.id,
        name: `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || userProfile.email,
        email: userProfile.email,
        role: highestRole,
        avatar: authUser.user_metadata?.avatar_url
      };

      return profile;
    } catch (error) {
      console.error('[Auth] Error fetching user profile:', error);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;
    
    // Set up auth state listener (sync callback only)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      
      setSession(session);

      if (session?.user) {
        // Defer Supabase calls to avoid deadlocks
        setTimeout(() => {
          fetchUserProfile(session.user).then((profile) => {
            if (!mounted) return;

            if (profile) {
              setUser(profile);
            } else {
              console.warn('No user profile found for authenticated user');
              setUser(null);
            }
            setLoading(false);
            setIsInitialized(true);
          }).catch((err) => {
            console.error('Failed to fetch user profile:', err);
            if (!mounted) return;
            setLoading(false);
            setIsInitialized(true);
          });
        }, 0);
      } else {
        setUser(null);
        setLoading(false);
        setIsInitialized(true);
      }
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;

      setSession(session);

      if (session?.user) {
        fetchUserProfile(session.user).then((profile) => {
          if (!mounted) return;

          if (profile) {
            setUser(profile);
          } else {
            console.warn('No user profile found for authenticated user');
            setUser(null);
          }
          setLoading(false);
          setIsInitialized(true);
        }).catch((err) => {
          console.error('Failed to fetch user profile:', err);
          if (!mounted) return;
          setLoading(false);
          setIsInitialized(true);
        });
      } else {
        setLoading(false);
        setIsInitialized(true);
      }
    }).catch((err) => {
      console.error('Failed to get session:', err);
      if (!mounted) return;
      setLoading(false);
      setIsInitialized(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    setLoading(true);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      setLoading(false);
      throw new Error(error.message);
    }

    // User profile will be fetched automatically by the auth state change listener
    setLoading(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const hasRole = (role: UserRole): boolean => {
    return user?.role === role;
  };

  const hasMinimumRole = (role: UserRole): boolean => {
    if (!user) return false;
    return roleHierarchy[user.role] >= roleHierarchy[role];
  };

  // Don't render children until the provider is initialized
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      loading,
      hasRole,
      hasMinimumRole
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}