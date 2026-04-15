import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Ionicons name="warning" size={60} color="#ff4d4d" />
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#f4f7fa',
    alignItems: 'center', justifyContent: 'center', padding: 30,
  },
  title: {
    fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginTop: 20, marginBottom: 10,
  },
  message: {
    fontSize: 14, color: '#8a8a8a', textAlign: 'center', marginBottom: 30, lineHeight: 20,
  },
  button: {
    backgroundColor: '#ff4d4d', paddingHorizontal: 30, paddingVertical: 14,
    borderRadius: 14,
  },
  buttonText: {
    color: '#ffffff', fontSize: 16, fontWeight: '700',
  },
});
