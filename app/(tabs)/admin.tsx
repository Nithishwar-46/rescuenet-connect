import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl, Image } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { useToast } from '@/lib/toast-provider';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

interface UserEntry {
  id: string;
  full_name: string;
  avatar_url: string;
  role: string;
}

interface Stats {
  totalUsers: number;
  totalAdmins: number;
  totalWorkers: number;
  activeAlerts: number;
}

export default function AdminScreen() {
  const { role } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalAdmins: 0, totalWorkers: 0, activeAlerts: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    const { data: profiles } = await supabase.from('profiles').select('*');
    if (profiles) {
      setUsers(profiles.map(p => ({
        id: p.id,
        full_name: p.full_name || '',
        avatar_url: p.avatar_url || '',
        role: p.role || 'social_worker',
      })));

      const admins = profiles.filter(p => p.role === 'admin').length;
      setStats(prev => ({
        ...prev,
        totalUsers: profiles.length,
        totalAdmins: admins,
        totalWorkers: profiles.length - admins,
      }));
    }

    const { count } = await supabase.from('sos_alerts').select('id', { count: 'exact' }).eq('status', 'active');
    setStats(prev => ({ ...prev, activeAlerts: count || 0 }));

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleRole = (user: UserEntry) => {
    const newRole = user.role === 'admin' ? 'social_worker' : 'admin';
    const actionLabel = newRole === 'admin' ? 'Promote to Commander' : 'Reassign to Field';

    Alert.alert(
      actionLabel,
      `Change ${user.full_name || 'Unit'} to ${newRole === 'admin' ? 'Commander' : 'Field Operative'}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', user.id);
            if (error) showToast({ message: error.message, type: 'CRITICAL' });
            else {
              showToast({ message: "Strategic role reallocated.", type: 'SUCCESS' });
              fetchData();
            }
          },
        },
      ]
    );
  };

  if (role !== 'admin') {
    return (
      <View style={[styles.accessDenied, { backgroundColor: colors.background }]}>
        <Ionicons name="lock-closed" size={80} color={colors.border} />
        <Text style={[styles.accessTitle, { color: colors.text }]}>ACCESS RESTRICTED</Text>
        <Text style={[styles.accessSubtitle, { color: colors.secondary }]}>Strategic clearance required for session.</Text>
      </View>
    );
  }

  const renderStatCard = (icon: string, label: string, value: number) => (
    <View style={[styles.statCard, { backgroundColor: colors.surface, borderTopColor: colors.primary }]}>
      <Ionicons name={icon as any} size={24} color={colors.primary} />
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.secondary }]}>{label}</Text>
    </View>
  );

  const renderUser = ({ item, index }: { item: UserEntry; index: number }) => (
    <Animated.View layout={Layout.springify()} entering={FadeInDown.delay(index * 50)} style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Image source={{ uri: item.avatar_url || 'https://cdn-icons-png.flaticon.com/512/149/149071.png' }} style={styles.avatar} />
      <View style={styles.userInfo}>
        <Text style={[styles.userName, { color: colors.text }]}>{item.full_name || 'Anonymous Unit'}</Text>
        <View style={[styles.roleBadge, { backgroundColor: item.role === 'admin' ? colors.primary + '20' : colors.border }]}>
          <Text style={[styles.roleText, { color: item.role === 'admin' ? colors.primary : colors.secondary }]}>
            {item.role === 'admin' ? 'COMMANDER' : 'OPERATIVE'}
          </Text>
        </View>
      </View>
      <TouchableOpacity style={styles.toggleButton} onPress={() => toggleRole(item)}>
        <Ionicons
          name={item.role === 'admin' ? 'shield-outline' : 'shield-half'}
          size={24}
          color={item.role === 'admin' ? colors.secondary : colors.primary}
        />
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>COMMAND CONSOLE</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={item => item.id}
          ListHeaderComponent={
            <View style={{ marginBottom: 20 }}>
              <View style={styles.statsRow}>
                {renderStatCard('people', 'TOTAL UNITS', stats.totalUsers)}
                {renderStatCard('shield-checkmark', 'COMMANDERS', stats.totalAdmins)}
              </View>
              <View style={styles.statsRow}>
                {renderStatCard('walk', 'OPERATIVES', stats.totalWorkers)}
                {renderStatCard('warning', 'ACTIVE SOS', stats.activeAlerts)}
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Personnel Status</Text>
            </View>
          }
          renderItem={renderUser}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.primary} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingTop: 60, borderBottomWidth: 1, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: { flex: 1, borderRadius: 20, padding: 20, alignItems: 'center', borderTopWidth: 4, elevation: 4 },
  statValue: { fontSize: 32, fontWeight: '900', marginTop: 10 },
  statLabel: { fontSize: 10, fontWeight: '900', marginTop: 4, letterSpacing: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '900', marginTop: 25, marginBottom: 15, letterSpacing: 1.5, textTransform: 'uppercase' },
  userCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 24, marginBottom: 12, borderWidth: 1, elevation: 2 },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  roleText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  toggleButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  accessDenied: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  accessTitle: { fontSize: 22, fontWeight: '900', marginTop: 25, letterSpacing: 2 },
  accessSubtitle: { fontSize: 14, textAlign: 'center', marginTop: 10, fontWeight: '600' },
});
