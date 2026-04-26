import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import * as Linking from 'expo-linking';

export type UserRole = 'admin' | 'social_worker';

interface AuthState {
  user: any | null;
  userId: string | null;
  role: UserRole | null;
  profile: { 
    full_name: string; 
    avatar_url: string; 
    role: UserRole;
    theme_preference?: string;
    agency_name?: string;
    expertise?: string[];
    phone_contact?: string;
    last_seen?: string;
    custom_color?: string;
  } | null | undefined;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  userId: null,
  role: null,
  profile: undefined,
  loading: true,
  refreshProfile: async () => {},
});

export const ADMIN_ACCESS_CODE = 'RESCUENET_ADMIN_2026';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<AuthState['profile']>(undefined);
  const [loading, setLoading] = useState(true);

  // --- DEEP LINK HANDLING ---
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      const { queryParams } = Linking.parse(url);
      if (queryParams?.access_token && queryParams?.refresh_token) {
        await supabase.auth.setSession({
          access_token: queryParams.access_token as string,
          refresh_token: queryParams.refresh_token as string,
        });
      }
    };

    // 1. Initial link if app was closed
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    // 2. Listener for links while app is open
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const fetchProfile = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, role, theme_preference, agency_name, expertise, phone_contact, last_seen, custom_color')
        .eq('id', uid)
        .single();
      if (data && !error) {
        setProfile({
          full_name: data.full_name || '',
          avatar_url: data.avatar_url || '',
          role: (data.role as UserRole) || 'social_worker',
          theme_preference: data.theme_preference || 'monochrome',
          agency_name: data.agency_name || '',
          expertise: data.expertise || [],
          phone_contact: data.phone_contact || '',
          last_seen: data.last_seen,
          custom_color: data.custom_color,
        });
      } else {
        setProfile(null);
      }
    } catch (e) {
      console.warn('fetchProfile error:', e);
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    let mounted = true;

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    const timeout = setTimeout(() => {
      if (mounted && loading) {
        setLoading(false);
      }
    }, 4000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        userId: user?.id || null,
        role: profile?.role || null,
        profile,
        loading,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
