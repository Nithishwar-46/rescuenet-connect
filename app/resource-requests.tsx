import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { useToast } from '@/lib/toast-provider';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Location from 'expo-location';
import { TacticalButton } from '@/components/ui/tactical-button';

type ResourceRequest = {
  id: string;
  sender_id: string;
  target_id: string;
  resource_name: string;
  quantity: number;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
  sender: {
    full_name: string;
    agency_name: string;
    avatar_url: string;
  };
  target?: {
    full_name: string;
    agency_name: string;
  };
  locationName?: string;
  isMyRequest?: boolean;
};

export default function ResourceRequestsScreen() {
  const { userId } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    if (!userId) return;
    setLoading(true);
    
    // Fetch both sent and received requests
    const { data, error } = await supabase
      .from('resource_requests')
      .select(`
        *,
        sender:profiles!sender_id(full_name, agency_name, avatar_url),
        target:profiles!target_id(full_name, agency_name)
      `)
      .or(`target_id.eq.${userId},sender_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Fetch locations to provide distance context
      const { data: locData } = await supabase.from('locations').select('*');
      const locMap: any = {};
      if (locData) locData.forEach(l => locMap[l.user_id] = l);

      const enriched = await Promise.all(data.map(async (req: any) => {
        let locName = 'Unknown Location';
        const relationId = req.sender_id === userId ? req.target_id : req.sender_id;
        const targetLoc = locMap[relationId];

        if (targetLoc) {
           try {
             const geocode = await Location.reverseGeocodeAsync({ latitude: targetLoc.latitude, longitude: targetLoc.longitude });
             if (geocode.length > 0) {
                const p = geocode[0];
                const parts = [p.city || p.subregion, p.region].filter(Boolean);
                if (parts.length > 0) locName = parts.join(', ');
             } else {
                locName = `${targetLoc.latitude.toFixed(3)}, ${targetLoc.longitude.toFixed(3)}`;
             }
           } catch(e) {
             locName = `${targetLoc.latitude.toFixed(3)}, ${targetLoc.longitude.toFixed(3)}`;
           }
        }
        
        return {
          ...req,
          isMyRequest: req.sender_id === userId,
          locationName: locName
        };
      }));

      setRequests(enriched);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
    
    const subscription = supabase.channel('resource_requests_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resource_requests' }, () => {
        fetchRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [userId]);

  const handleStatusUpdate = async (id: string, status: 'approved' | 'denied') => {
    const { error } = await supabase
      .from('resource_requests')
      .update({ status })
      .eq('id', id);

    if (error) {
      showToast({ message: "Update Failed: " + error.message, type: 'CRITICAL' });
    } else {
      showToast({ message: `Request ${status.toUpperCase()} successfully.`, type: 'SUCCESS' });
      fetchRequests();
    }
  };

  const deleteRequest = async (id: string) => {
    Alert.alert("Retract Request", "Permanently delete your resource request?", [
       { text: "Cancel", style: "cancel" },
       { text: "Retract", style: "destructive", onPress: async () => {
           const { error } = await supabase.from('resource_requests').delete().eq('id', id);
           if (!error) showToast({ message: "Request retracted.", type: 'INFO' });
           else showToast({ message: "Failed: " + error.message, type: 'CRITICAL' });
       }}
    ]);
  };

  const renderItem = ({ item }: { item: ResourceRequest }) => {
    const isPending = item.status === 'pending';
    const statusColor = item.status === 'approved' ? '#2ecc71' : item.status === 'denied' ? '#ff4d4d' : colors.secondary;

    return (
      <Animated.View entering={FadeInDown} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftWidth: 5, borderLeftColor: item.isMyRequest ? colors.primary : colors.secondary }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
          <Text style={[styles.agencyName, { color: colors.text }]}>
             {item.isMyRequest ? `REQUEST TO: ${item.target?.agency_name || 'UNIT'}` : `FROM: ${item.sender?.agency_name || 'INACTIVE UNIT'}`}
          </Text>
          <Text style={[styles.timestamp, { color: colors.secondary }]}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>

        <Text style={[styles.requestTitle, { color: colors.text }]}>
          {item.resource_name.toUpperCase()} <Text style={{ color: colors.primary }}>x{item.quantity}</Text>
        </Text>
        
        <View style={styles.intelRow}>
           <Ionicons name="person" size={12} color={colors.secondary} />
           <Text style={[styles.senderName, { color: colors.secondary }]}>
              {item.isMyRequest ? `Sent by you` : `Requested by ${item.sender?.full_name}`}
           </Text>
        </View>

        <View style={[styles.intelRow, { marginBottom: 15 }]}>
           <Ionicons name="location" size={12} color={colors.primary} />
           <Text style={[styles.senderName, { color: colors.text }]}>Location: {item.locationName}</Text>
        </View>

        {isPending && !item.isMyRequest && (
          <View style={styles.actionRow}>
            <View style={{ flex: 1 }}>
              <TacticalButton
                title="DENY"
                onPress={() => handleStatusUpdate(item.id, 'denied')}
                colors={['#1a1a1a', '#000000']}
                style={{ height: '100%' }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TacticalButton
                title="APPROVE"
                onPress={() => handleStatusUpdate(item.id, 'approved')}
                colors={[colors.primary, '#005bb5']}
                style={{ height: '100%' }}
              />
            </View>
          </View>
        )}
        
        <View style={styles.badgeRow}>
           {!isPending && (
              <View style={[styles.statusBadge, { borderColor: statusColor, backgroundColor: statusColor + '15' }]}>
                 <Text style={[styles.statusBadgeText, { color: statusColor }]}>{item.status.toUpperCase()}</Text>
              </View>
           )}
           
           {item.isMyRequest && (
              <TouchableOpacity 
                style={[styles.statusBadge, { borderColor: '#ff4d4d', backgroundColor: '#ff4d4d15', marginLeft: !isPending ? 10 : 0 }]}
                onPress={() => deleteRequest(item.id)}
              >
                 <Text style={[styles.statusBadgeText, { color: '#ff4d4d' }]}>RETRACT</Text>
              </TouchableOpacity>
           )}
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Professional Collab</Text>
        <Text style={[styles.subtitle, { color: colors.secondary }]}>Review and manage inter-agency resource / assets requests.</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={requests}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
               <Ionicons name="people-outline" size={60} color={colors.border} />
               <Text style={[styles.emptyText, { color: colors.secondary }]}>NO ACTIVE COLLABORATIONS</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 30, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: '900', letterSpacing: 0.5 },
  subtitle: { fontSize: 13, fontWeight: '600', marginTop: 10, lineHeight: 18 },
  listContent: { padding: 20 },
  card: { borderRadius: 20, padding: 20, marginBottom: 15, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  statusIndicator: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  agencyName: { flex: 1, fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  timestamp: { fontSize: 10, fontWeight: '700' },
  requestTitle: { fontSize: 18, fontWeight: '900', marginBottom: 8 },
  intelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  senderName: { fontSize: 12, fontWeight: '700', marginLeft: 6 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  statusBadgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 12, fontWeight: '900', marginTop: 20, letterSpacing: 1 }
});
