import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { ADMIN_ACCESS_CODE } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-provider';
import Animated, { FadeIn, FadeInDown, Layout } from 'react-native-reanimated';
import { TacticalButton } from '@/components/ui/tactical-button';

type RoleTab = 'social_worker' | 'admin';

export default function AuthScreen() {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<RoleTab>('social_worker');
  const [isRegistering, setIsRegistering] = useState(false);

  const isAdmin = activeTab === 'admin';

  async function handleAuth() {
    if (!email || !password) {
      showToast({ message: "Identifier and Passcode required for uplink.", type: 'WARNING' });
      return;
    }

    setLoading(true);

    if (isRegistering) {
      // Registration Logic
      if (isAdmin) {
        if (!adminCode.trim() || adminCode.trim() !== ADMIN_ACCESS_CODE) {
          showToast({ message: "Invalid Strategic Clearance Code.", type: 'CRITICAL' });
          setLoading(false);
          return;
        }
      }

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        showToast({ message: error.message, type: 'CRITICAL' });
      } else {
        const role = isAdmin ? 'admin' : 'social_worker';
        await supabase.from('profiles').insert([{ id: data.user?.id, full_name: '', role: role }]);
        showToast({ message: "Unit registered. Check mission-brief (email) for verification.", type: 'SUCCESS', duration: 6000 });
      }
    } else {
      // Login Logic
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        showToast({ message: "Access Denied: " + error.message, type: 'CRITICAL' });
      } else {
        if (isAdmin) {
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user?.id).single();
          if (profile?.role !== 'admin') {
            await supabase.auth.signOut();
            showToast({ message: "Unauthorized Command access detected.", type: 'CRITICAL' });
            setLoading(false);
            return;
          }
        }
        showToast({ message: "Tactical OS Initialized. Welcome back.", type: 'SUCCESS' });
      }
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <Animated.View entering={FadeIn.duration(1000)} style={styles.card}>
        <View style={styles.iconContainer}>
          <View style={styles.logoBadge}>
             <Ionicons name="shield-checkmark" size={48} color="#ffffff" />
          </View>
        </View>
        
        <Text style={styles.title}>RescueNet</Text>
        <Text style={styles.subtitle}>Unified Tactical Command v2.1</Text>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'social_worker' && { backgroundColor: '#000' }]}
            onPress={() => setActiveTab('social_worker')}
          >
            <Text style={[styles.tabText, activeTab === 'social_worker' && styles.tabTextActive]}>Field Portal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'admin' && { backgroundColor: '#000' }]}
            onPress={() => setActiveTab('admin')}
          >
            <Text style={[styles.tabText, activeTab === 'admin' && styles.tabTextActive]}>Command</Text>
          </TouchableOpacity>
        </View>

        <Animated.View layout={Layout.springify()} style={styles.form}>
          <View style={styles.inputLabelContainer}>
            <Text style={styles.inputLabel}>OFFICIAL IDENTIFIER (EMAIL)</Text>
          </View>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#a0a0a0" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              onChangeText={setEmail}
              value={email}
              placeholder="operator@rescuenet.org"
              placeholderTextColor="#a0a0a0"
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputLabelContainer}>
            <Text style={styles.inputLabel}>SECURE PASSCODE</Text>
          </View>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#a0a0a0" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              onChangeText={setPassword}
              value={password}
              placeholder="••••••••"
              placeholderTextColor="#a0a0a0"
              secureTextEntry
            />
          </View>

          {isAdmin && isRegistering && (
            <Animated.View entering={FadeInDown} style={[styles.inputContainer, { borderColor: '#ff4d4d' }]}>
              <Ionicons name="medal-outline" size={20} color="#ff4d4d" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                onChangeText={setAdminCode}
                value={adminCode}
                placeholder="STRATEGIC CLEARANCE CODE"
                placeholderTextColor="#ff4d4d"
                secureTextEntry
              />
            </Animated.View>
          )}

          <View style={{ marginTop: 15 }}>
            <TacticalButton
              title={isRegistering ? 'INITIALIZE UNIT' : 'ESTABLISH UPLINK'}
              onPress={handleAuth}
              loading={loading}
              colors={['#1a1a1a', '#000000']}
            />
          </View>

          <TouchableOpacity style={styles.backButton} onPress={() => setIsRegistering(!isRegistering)}>
            <Text style={styles.backButtonText}>{isRegistering ? 'Already registered? Uplink instead' : 'New unit? Request registration'}</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.footer}>
           <Text style={styles.footerText}>ENCRYPTED CHANNEL SECURED BY RESCUENET</Text>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', justifyContent: 'center', padding: 25 },
  card: { padding: 20 },
  iconContainer: { alignItems: 'center', marginBottom: 20 },
  logoBadge: { 
    backgroundColor: '#000', 
    width: 90, 
    height: 90, 
    borderRadius: 25, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
    transform: [{ rotate: '45deg' }]
  },
  title: { fontSize: 36, fontWeight: '900', color: '#000000', textAlign: 'center', letterSpacing: -1, marginTop: 10 },
  subtitle: { fontSize: 11, textAlign: 'center', marginBottom: 30, color: '#ff4d4d', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#f0f2f5', borderRadius: 16, padding: 5, marginBottom: 30 },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  tabText: { fontSize: 12, fontWeight: '900', color: '#8a8a8a', textTransform: 'uppercase', letterSpacing: 1 },
  tabTextActive: { color: '#ffffff' },
  form: { minHeight: 200 },
  inputLabelContainer: { marginBottom: 8, paddingLeft: 4 },
  inputLabel: { fontSize: 10, fontWeight: '900', color: '#1a1a1a', letterSpacing: 1 },
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f8f9fa', 
    borderRadius: 16, 
    borderWidth: 1.5,
    borderColor: '#f0f2f5',
    marginBottom: 15,
    paddingHorizontal: 15
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, paddingVertical: 18, color: '#000000', fontSize: 16, fontWeight: '700' },
  backButton: { marginTop: 20, alignItems: 'center' },
  backButtonText: { color: '#8a8a8a', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  footer: { marginTop: 40, alignItems: 'center' },
  footerText: { color: '#d1d5db', fontSize: 10, fontWeight: '800', letterSpacing: 1 }
});
