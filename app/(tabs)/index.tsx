import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, Dimensions } from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');

export default function DashboardScreen() {
  const { userId, role, profile } = useAuth();
  const { colors } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    myReports: 0,
    adminUnits: 0,
    workerUnits: 0,
    activeAlerts: 0,
  });

  const fetchData = useCallback(async () => {
    if (!userId) return;

    try {
      const { count: myCount } = await supabase.from('sos_alerts').select('id', { count: 'exact', head: true }).eq('user_id', userId);
      const { count: adminCount } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin');
      const { count: workerCount } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'social_worker');
      const { count: activeCount } = await supabase.from('sos_alerts').select('id', { count: 'exact', head: true }).eq('status', 'active');

      setStats({
        myReports: myCount || 0,
        adminUnits: adminCount || 0,
        workerUnits: workerCount || 0,
        activeAlerts: activeCount || 0,
      });
    } catch (error) {
      console.error('Dashboard data fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
    const subscription = supabase.channel('dashboard:sos_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_alerts' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Syncing Tactical Data...</Text>
      </View>
    );
  }

  const isAdmin = role === 'admin';

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.welcomeText, { color: colors.textSecondary }]}>Unit Connection: Active</Text>
          <Text style={[styles.nameText, { color: colors.text }]}>{profile?.full_name || 'Commander'}</Text>
        </View>
        <View style={[styles.roleBadge, { borderTopColor: colors.border }]}>
          <Text style={[styles.roleText, { color: colors.textSecondary }]}>
            {isAdmin ? 'ADMIN STRATEGIC COMMAND' : 'FIELD OPERATIONS'}
          </Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { width: width - 40, backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.statInfo}>
             <Ionicons name="document-text-outline" size={20} color={colors.primary} />
             <Text style={[styles.statLabel, { color: colors.textSecondary }]}>My Dispatched Reports</Text>
          </View>
          <Text style={[styles.statValue, { color: colors.text }]}>{stats.myReports}</Text>
        </View>

        <TouchableOpacity 
          style={[styles.statCard, { width: width / 2 - 25, backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push('/(tabs)/users' as any)}
        >
          <View style={styles.statInfo}>
             <Ionicons name="shield-outline" size={18} color={colors.primary} />
             <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Admins</Text>
          </View>
          <Text style={[styles.statValueSmall, { color: colors.text }]}>{stats.adminUnits}</Text>
          <View style={styles.interactHint}>
             <Text style={[styles.hintText, { color: colors.textSecondary }]}>VIEW ROSTER</Text>
             <Ionicons name="arrow-forward" size={10} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.statCard, { width: width / 2 - 25, backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push('/(tabs)/users' as any)}
        >
          <View style={styles.statInfo}>
             <Ionicons name="people-outline" size={18} color={colors.primary} />
             <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Field Workers</Text>
          </View>
          <Text style={[styles.statValueSmall, { color: colors.text }]}>{stats.workerUnits}</Text>
          <View style={styles.interactHint}>
             <Text style={[styles.hintText, { color: colors.textSecondary }]}>VIEW ROSTER</Text>
             <Ionicons name="arrow-forward" size={10} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.statCard, { width: width - 40, borderTopWidth: 4, borderTopColor: colors.primary, backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push('/(tabs)/notifications' as any)}
        >
          <View style={styles.statInfo}>
             <Ionicons name="pulse" size={24} color={colors.primary} />
             <Text style={[styles.statLabelLarge, { color: colors.text }]}>Active Distress Beacons</Text>
          </View>
          <View style={styles.distressValueContainer}>
             <Text style={[styles.statValueDistress, { color: colors.text }]}>{stats.activeAlerts}</Text>
             <TouchableOpacity style={[styles.navButton, { backgroundColor: colors.primary }]} onPress={() => router.push('/(tabs)/notifications' as any)}>
                 <Text style={styles.navButtonText}>INTERVENE NOW</Text>
                 <Ionicons name="chevron-forward" size={16} color="#ffffff" />
             </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Strategic Actions</Text>
      
      <TouchableOpacity 
        style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push('/(tabs)/map' as any)}
      >
        <View style={[styles.actionIcon, { backgroundColor: colors.primary }]}>
          <Ionicons name="map" size={26} color="#ffffff" />
        </View>
        <View style={styles.actionContent}>
          <Text style={[styles.actionTitle, { color: colors.text }]}>Tactical Map</Text>
          <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>Monitor deployed operatives</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.border} />
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push('/(tabs)/chat' as any)}
      >
        <View style={[styles.actionIcon, { backgroundColor: colors.primary }]}>
          <Ionicons name="chatbubbles" size={26} color="#ffffff" />
        </View>
        <View style={styles.actionContent}>
          <Text style={[styles.actionTitle, { color: colors.text }]}>Alliance Comms</Text>
          <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>Secure coordination channel</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.border} />
      </TouchableOpacity>

      <View style={styles.footerInfo}>
        <Ionicons name="shield-checkmark" size={16} color={colors.primary} style={{ marginRight: 6 }} />
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>Secure Alliance Network Active</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontWeight: '700', textTransform: 'uppercase', fontSize: 11 },
  header: { marginTop: 50, marginBottom: 35 },
  welcomeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 },
  nameText: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  roleBadge: { marginTop: 15, paddingVertical: 4, borderTopWidth: 1, width: '100%' },
  roleText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCard: { padding: 20, borderRadius: 16, marginBottom: 15, borderWidth: 1, shadowOpacity: 0.02, shadowOffset: { width: 0, height: 2 }, shadowRadius: 5, elevation: 1 },
  statInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  statLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginLeft: 8 },
  statLabelLarge: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginLeft: 10 },
  statValue: { fontSize: 36, fontWeight: '900' },
  statValueSmall: { fontSize: 24, fontWeight: '900' },
  statValueDistress: { fontSize: 48, fontWeight: '900', lineHeight: 54 },
  distressValueContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  navButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 10 },
  navButtonText: { color: '#ffffff', fontSize: 10, fontWeight: '800', marginRight: 5 },
  interactHint: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  hintText: { fontSize: 8, fontWeight: '800', marginRight: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '900', marginTop: 25, marginBottom: 18, textTransform: 'uppercase', letterSpacing: 1 },
  actionCard: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 16, marginBottom: 12, borderWidth: 1 },
  actionIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  actionContent: { flex: 1 },
  actionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  actionSubtitle: { fontSize: 12, fontWeight: '600' },
  footerInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 40, marginBottom: 60 },
  footerText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
});
