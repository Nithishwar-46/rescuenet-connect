import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme-context';
import { useToast } from '@/lib/toast-provider';
import * as Location from 'expo-location';
import Animated, { FadeInDown, Layout, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';

interface SOSAlert {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  details: string;
  status: string;
  created_at: string;
  target_expertise?: string;
  senderName?: string;
  locationName?: string;
}

export default function NotificationsScreen() {
  const { role, userId } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  
  const [alerts, setAlerts] = useState<SOSAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAlerts = useCallback(async () => {
    if (!userId) return;

    // Fetch user's expertise to filter targeted SOS alerts
    const { data: profData } = await supabase.from('profiles').select('expertise').eq('id', userId).single();
    const myExpertise: string[] = profData?.expertise || [];

    const { data, error } = await supabase
      .from('sos_alerts')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      showToast({ message: error.message, type: 'CRITICAL' });
      return;
    }

    if (data) {
      const relevantData = data.filter(a => {
         // Show if it's general, or if we have the targeted expertise
         if (!a.target_expertise || a.target_expertise === 'all') return true;
         // Always show our own tests/alerts regardless of our expertise
         if (a.user_id === userId) return true;
         // Otherwise, check if we have the expertise
         return myExpertise.includes(a.target_expertise);
      });

      const { data: profiles } = await supabase.from('profiles').select('id, full_name');
      const profMap: Record<string, string> = {};
      if (profiles) profiles.forEach(p => profMap[p.id] = p.full_name || 'Unknown Unit');

      const enriched: SOSAlert[] = await Promise.all(relevantData.map(async (a) => {
        let locName = `${a.latitude.toFixed(4)}, ${a.longitude.toFixed(4)}`;
        try {
           const geocode = await Location.reverseGeocodeAsync({ latitude: a.latitude, longitude: a.longitude });
           if (geocode.length > 0) {
              const place = geocode[0];
              const parts = [place.city || place.subregion, place.region].filter(Boolean);
              if (parts.length > 0) locName = parts.join(', ');
           }
        } catch (e) {
           console.warn("Geocode failed for", a.id);
        }
        return {
          ...a,
          senderName: profMap[a.user_id] || 'Unit ' + a.user_id.substring(0, 6),
          locationName: locName
        };
      }));
      setAlerts(enriched);
    }

    setLoading(false);
    setRefreshing(false);
  }, [userId]);

  useEffect(() => {
    fetchAlerts();
    const subscription = supabase.channel('notifications:sos_alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_alerts' }, () => {
        fetchAlerts();
      }).subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, [fetchAlerts]);

  const resolveAlert = (alertId: string) => {
    Alert.alert(
      "Confirm Rescue",
      "Mark this distress beacon as Rescued? It will be removed from all active command maps.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Rescue",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from('sos_alerts').update({ status: 'resolved' }).eq('id', alertId);
            if (error) showToast({ message: error.message, type: 'CRITICAL' });
            else showToast({ message: "Distress beacon resolved.", type: 'SUCCESS' });
          },
        },
      ]
    );
  };

  const deleteAlert = (alertId: string) => {
    Alert.alert(
      "Delete Alert",
      "Permanently delete this SOS alert?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from('sos_alerts').delete().eq('id', alertId);
            if (error) showToast({ message: error.message, type: 'CRITICAL' });
            else showToast({ message: "Transmission purged.", type: 'INFO' });
          },
        },
      ]
    );
  };

  const getTimeAgo = (dateStr: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  const PulsingDot = () => {
    const anim = useAnimatedStyle(() => ({
      opacity: withRepeat(withSequence(withTiming(0.3, { duration: 500 }), withTiming(1, { duration: 500 })), -1, true),
      transform: [{ scale: withRepeat(withSequence(withTiming(0.8, { duration: 500 }), withTiming(1.2, { duration: 500 })), -1, true) }]
    }));
    return <Animated.View style={[styles.pulseDot, anim]} />;
  };

  const renderAlert = ({ item, index }: { item: SOSAlert; index: number }) => {
    const isTargeted = item.target_expertise && item.target_expertise !== 'all';
    return (
      <Animated.View layout={Layout.springify()} entering={FadeInDown.delay(index * 100)} style={[styles.alertCard, { backgroundColor: colors.surface, borderLeftColor: isTargeted ? '#ff9f43' : colors.primary }]}>
        <View style={styles.alertHeader}>
          <View style={[styles.urgencyBadge, { backgroundColor: isTargeted ? '#ff9f43' : colors.primary }]}>
            <PulsingDot />
            <Text style={styles.urgencyText}>{isTargeted ? `TARGETED: ${item.target_expertise?.toUpperCase()}` : `INTERCEPTED DISTRESS`}</Text>
          </View>
          <Text style={[styles.timeText, { color: colors.secondary }]}>{getTimeAgo(item.created_at)}</Text>
        </View>

        <Text style={[styles.detailsText, { color: colors.text }]}>
          {item.details || 'Priority beacon activated. Awaiting intelligence.'}
        </Text>

        <View style={[styles.metaRow, { borderTopColor: colors.border }]}>
          <View style={styles.metaItem}>
            <Ionicons name="person" size={14} color={colors.primary} />
            <Text style={[styles.metaText, { color: colors.text }]}>{item.senderName}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="location" size={14} color={colors.primary} />
            <Text style={[styles.metaText, { color: colors.text }]}>
              {item.locationName}
            </Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.rescueButton, { backgroundColor: '#2ecc71' }]} onPress={() => resolveAlert(item.id)}>
            <Ionicons name="shield-checkmark" size={18} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.rescueText}>SECURE UNIT</Text>
          </TouchableOpacity>

          {(role === 'admin' || item.user_id === userId) && (
            <TouchableOpacity style={[styles.deleteButton, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => deleteAlert(item.id)}>
              <Ionicons name="trash-outline" size={18} color="#ff4d4d" />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Command Central</Text>
          <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.countText}>{alerts.length}</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
      ) : alerts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="shield-checkmark" size={100} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>ALL SECTORS SECURE</Text>
          <Text style={[styles.emptySubtitle, { color: colors.secondary }]}>No active distress signals globally.</Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={item => item.id}
          renderItem={renderAlert}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchAlerts(); }}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingTop: 60, borderBottomWidth: 1 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 22, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  countBadge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyTitle: { fontSize: 20, fontWeight: '900', marginTop: 20, letterSpacing: 2 },
  emptySubtitle: { fontSize: 14, marginTop: 8, fontWeight: '700' },
  alertCard: { borderRadius: 24, padding: 20, marginBottom: 20, borderLeftWidth: 8, elevation: 6, shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  alertHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  urgencyBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  urgencyText: { color: '#ffffff', fontSize: 10, fontWeight: '900', marginLeft: 6, letterSpacing: 1 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  timeText: { fontSize: 12, fontWeight: '900' },
  detailsText: { fontSize: 17, fontWeight: '800', lineHeight: 24, marginBottom: 18, letterSpacing: -0.2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', paddingTop: 15, borderTopWidth: 1 },
  metaItem: { flexDirection: 'row', alignItems: 'center', marginRight: 20, marginBottom: 4 },
  metaText: { fontSize: 13, fontWeight: '700', marginLeft: 6 },
  actionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 15 },
  rescueButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 16, elevation: 3 },
  rescueText: { color: '#ffffff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  deleteButton: { marginLeft: 12, width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 }
});
