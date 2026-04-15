import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
     async function getProfileData() {
         const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
         if (data) setProfile(data);
         setLoading(false);
     }
     getProfileData();
  }, [id]);

  const roleLabel = profile?.role === 'admin' ? 'COMMANDER' : 'FIELD OPERATIVE';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
           <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>UNIT DOSSIER</Text>
      </View>
      
      {loading ? <ActivityIndicator size="large" color={colors.primary} style={{marginTop: 50}} /> : (
         <Animated.View entering={FadeInDown} layout={Layout.springify()} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.avatarSection}>
              {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={[styles.avatar, { borderColor: colors.primary }]} />
              ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Ionicons name="shield-checkmark" size={60} color={colors.secondary} />
                  </View>
              )}
              <View style={[styles.roleBadge, { backgroundColor: profile?.role === 'admin' ? colors.primary : colors.border }]}>
                 <Text style={[styles.roleText, { color: profile?.role === 'admin' ? '#fff' : colors.primary }]}>{roleLabel}</Text>
              </View>
            </View>

            <Text style={[styles.name, { color: colors.text }]}>{profile?.full_name || 'Unit ' + (id as string).substring(0, 8)}</Text>
            <Text style={[styles.status, { color: colors.secondary }]}>ALLIANCE NETWORK • ACTIVE</Text>

            <View style={[styles.infoGrid, { borderTopColor: colors.border }]}>
               <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: colors.secondary }]}>CLEARANCE</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{profile?.role?.toUpperCase() || 'FIELD'}</Text>
               </View>
               <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: colors.secondary }]}>STATUS</Text>
                  <Text style={[styles.infoValue, { color: '#2ecc71' }]}>ONLINE</Text>
               </View>
            </View>

            <TouchableOpacity style={[styles.dmButton, { backgroundColor: colors.primary }]} onPress={() => router.push(`/dm/${id}` as any)}>
               <Ionicons name="chatbubble-ellipses" size={20} color="#ffffff" style={{marginRight: 10}} />
               <Text style={styles.dmText}>ESTABLISH SECURE LINK</Text>
            </TouchableOpacity>
         </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 60, borderBottomWidth: 1 },
  backButton: { marginRight: 20 },
  headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  card: { alignItems: 'center', padding: 30, margin: 24, borderRadius: 32, borderWidth: 1, elevation: 8, shadowOpacity: 0.1, shadowRadius: 20 },
  avatarSection: { alignItems: 'center', marginBottom: 25 },
  avatar: { width: 140, height: 140, borderRadius: 70, borderWidth: 4 },
  avatarPlaceholder: { width: 140, height: 140, borderRadius: 70, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderStyle: 'dashed' },
  roleBadge: { position: 'absolute', bottom: -5, paddingHorizontal: 15, paddingVertical: 6, borderRadius: 12, elevation: 4 },
  roleText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  name: { fontSize: 26, fontWeight: '900', marginBottom: 6, textAlign: 'center', letterSpacing: -0.5 },
  status: { fontSize: 12, fontWeight: '800', marginBottom: 35, letterSpacing: 1 },
  infoGrid: { width: '100%', flexDirection: 'row', paddingTop: 25, borderTopWidth: 1, marginBottom: 35 },
  infoItem: { flex: 1, alignItems: 'center' },
  infoLabel: { fontSize: 10, fontWeight: '900', marginBottom: 4, letterSpacing: 1 },
  infoValue: { fontSize: 16, fontWeight: '800' },
  dmButton: { width: '100%', flexDirection: 'row', paddingVertical: 18, borderRadius: 20, alignItems: 'center', justifyContent: 'center', elevation: 6 },
  dmText: { color: '#ffffff', fontSize: 14, fontWeight: '900', letterSpacing: 1.5 }
});
