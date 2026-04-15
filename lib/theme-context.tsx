import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './auth-context';
import { supabase } from './supabase';

export type TacticalTheme = 'monochrome' | 'agency_blue' | 'night_dark' | 'custom';

interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  accent: string;
}

const Themes: Record<Exclude<TacticalTheme, 'custom'>, ThemeColors> = {
  monochrome: {
    primary: '#1a1a1a',
    secondary: '#8a8a8a',
    background: '#ffffff',
    surface: '#f9fafb',
    text: '#111827',
    textSecondary: '#6b7280',
    border: '#e5e7eb',
    accent: '#1a1a1a',
  },
  agency_blue: {
    primary: '#007AFF',
    secondary: '#6b7280',
    background: '#f3f4f6',
    surface: '#ffffff',
    text: '#111827',
    textSecondary: '#6b7280',
    border: '#e5e7eb',
    accent: '#007AFF',
  },
  night_dark: {
    primary: '#007AFF',
    secondary: '#a0a0a0',
    background: '#0a0a0a',
    surface: '#1a1a1a',
    text: '#ffffff',
    textSecondary: '#a0a0a0',
    border: '#333333',
    accent: '#007AFF',
  }
};

interface ThemeContextType {
  theme: TacticalTheme;
  colors: ThemeColors;
  setTheme: (theme: TacticalTheme, customColor?: string) => void;
  customColor: string;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function TacticalThemeProvider({ children }: { children: React.ReactNode }) {
  const { userId, profile } = useAuth();
  const [theme, setThemeState] = useState<TacticalTheme>('agency_blue');
  const [customColor, setCustomColor] = useState('#007AFF');

  useEffect(() => {
    if (profile?.theme_preference) {
      setThemeState(profile.theme_preference as TacticalTheme);
    } else {
      setThemeState('agency_blue');
    }
    
    if ((profile as any)?.custom_color) {
      setCustomColor((profile as any).custom_color);
    }
  }, [profile]);

  const setTheme = async (newTheme: TacticalTheme, newCustomColor?: string) => {
    setThemeState(newTheme);
    if (newCustomColor) setCustomColor(newCustomColor);

    if (userId) {
      const updates: any = { theme_preference: newTheme };
      if (newCustomColor) updates.custom_color = newCustomColor;
      await supabase.from('profiles').update(updates).eq('id', userId);
    }
  };

  const getColors = (): ThemeColors => {
    if (theme === 'custom') {
      return {
        primary: customColor,
        secondary: '#6b7280',
        background: '#ffffff',
        surface: '#ffffff',
        text: '#111827',
        textSecondary: '#6b7280',
        border: '#e5e7eb',
        accent: customColor,
      };
    }
    return Themes[theme] || Themes.agency_blue;
  };

  const colors = getColors();

  return (
    <ThemeContext.Provider value={{ theme, colors, setTheme, customColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
