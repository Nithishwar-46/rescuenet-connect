import React from 'react';
import { Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';

interface TacticalButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  colors?: readonly [string, string, ...string[]];
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export function TacticalButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  colors = ['#2a2a2a', '#000000'],
  style,
  textStyle,
  icon
}: TacticalButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    if (disabled || loading) return;
    scale.value = withSpring(0.95, { mass: 0.5, damping: 10, stiffness: 200 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    if (disabled || loading) return;
    scale.value = withSpring(1, { mass: 0.5, damping: 10, stiffness: 200 });
  };

  return (
    <Animated.View style={[animatedStyle, { width: '100%' }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.container,
          disabled && styles.disabled
        ]}
      >
        <LinearGradient
          colors={disabled ? ['#444', '#222'] : colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              {icon}
              <Text style={[styles.text, textStyle]}>{title}</Text>
            </>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  gradient: {
    paddingVertical: 18,
    paddingHorizontal: 25,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  text: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  disabled: {
    opacity: 0.8,
  }
});
