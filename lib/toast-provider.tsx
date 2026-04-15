import React, { createContext, useContext, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Animated, { 
  FadeInUp, 
  FadeOutUp, 
  Layout, 
  SlideInUp, 
  SlideOutUp 
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from './theme-context';

export type ToastType = 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const { width } = Dimensions.get('window');

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const [toasts, setToasts] = useState<({ id: string } & ToastOptions)[]>([]);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(({ message, type = 'INFO', duration = 4000 }: ToastOptions) => {
    const id = Math.random().toString(36).substring(7);
    
    // Trigger Haptics based on type
    if (type === 'CRITICAL') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (type === 'WARNING') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setToasts((prev) => [...prev, { id, message, type, duration }]);

    setTimeout(() => {
      hideToast(id);
    }, duration);
  }, [hideToast]);

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'CRITICAL': return 'alert-circle';
      case 'WARNING': return 'warning';
      case 'SUCCESS': return 'checkmark-circle';
      default: return 'information-circle';
    }
  };

  const getTypeColor = (type: ToastType) => {
    switch (type) {
      case 'CRITICAL': return '#ff4d4d';
      case 'WARNING': return '#ff9f43';
      case 'SUCCESS': return '#28c76f';
      default: return colors.primary;
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View style={styles.container} pointerEvents="box-none">
        {toasts.map((toast) => (
          <Animated.View
            key={toast.id}
            entering={SlideInUp.duration(300)}
            exiting={SlideOutUp}
            layout={Layout.springify()}
            style={[
              styles.toast, 
              { 
                backgroundColor: colors.surface,
                borderLeftColor: getTypeColor(toast.type || 'INFO'),
                shadowColor: '#000',
              }
            ]}
          >
            <TouchableOpacity 
              style={styles.content} 
              onPress={() => hideToast(toast.id)}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={getIcon(toast.type || 'INFO')} 
                size={24} 
                color={getTypeColor(toast.type || 'INFO')} 
                style={styles.icon}
              />
              <View style={styles.textContainer}>
                <Text style={[styles.typeText, { color: getTypeColor(toast.type || 'INFO') }]}>
                  {toast.type || 'INFO'}
                </Text>
                <Text style={[styles.messageText, { color: colors.text }]}>
                  {toast.message}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    width: width - 40,
    marginBottom: 10,
    borderRadius: 12,
    borderLeftWidth: 5,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 10,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  messageText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
});
