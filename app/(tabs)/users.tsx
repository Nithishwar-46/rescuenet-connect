import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function DirectoryScreen() {
  const { userId } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDirectory() {
      // 1. Fetch active unit IDs from locations to guarantee ALL units show!
      const { data: locData, error: locError } = await supabase.from('locations').select('user_id');
      if (locError) {
         Alert.alert("Directory Error", locError.message);
         setLoading(false);
         return;
      }

      if (locData) {
         const uniqueIds = Array.from(new Set(locData.map(l => l.user_id)));
         const otherIds = uniqueIds.filter(id => id !== userId);

         // 2. Fetch profiles for those IDs to attach names/avatars/roles
         const { data: profData } = await supabase.from('profiles').select('*');
         const profilesMap: any = {};
         if (profData) profData.forEach(p => profilesMap[p.id] = p);

         const finalUsers = otherIds.map(id => ({
             id,
             full_name: profilesMap[id]?.full_name || null,
             avatar_url: profilesMap[id]?.avatar_url || null,
             role: profilesMap[id]?.role || 'social_worker',
         }));

         setUsers(finalUsers);
      }
      setLoading(false);
    }
    loadDirectory();
  }, [userId]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Agency Formations</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#ff4d4d" style={{marginTop: 50}} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 30 }}
          renderItem={({ item }) => {
            const isAdmin = item.role === 'admin';
            return (
              <TouchableOpacity style={styles.userCard} onPress={() => router.push({ pathname: '/dm/[id]', params: { id: item.id } } as any)} activeOpacity={0.7}>
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                ) : (
                  <Ionicons name="person-circle" size={54} color="#d1d5db" style={{marginRight: 10}} />
                )}
                <View style={styles.textContainer}>
                   <Text style={styles.userName}>{item.full_name || 'Unit ' + item.id.substring(0, 6)}</Text>
                   <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                     <View style={[styles.roleBadge, { backgroundColor: isAdmin ? '#EDE7FF' : '#FFF0F0' }]}>
                       <Text style={[styles.roleTag, { color: isAdmin ? '#6C5CE7' : '#ff4d4d' }]}>
                         {isAdmin ? 'ADMIN' : 'SOCIAL WORKER'}
                       </Text>
                     </View>
                   </View>
                </View>
                <Ionicons name="chatbubbles" size={24} color="#007aff" style={{marginLeft: 'auto'}} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7fa' },
  header: { padding: 20, paddingTop: 60, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e8ecef', shadowColor: '#000', shadowOpacity: 0.03, shadowOffset: {height: 2, width:0}, elevation: 2 },
  headerTitle: { color: '#1a1a1a', fontSize: 20, fontWeight: '800', textAlign: 'center', letterSpacing: 0.2 },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', padding: 18, marginHorizontal: 15, marginTop: 15, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 3 },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15, backgroundColor: '#f0f2f5', borderWidth: 1, borderColor: '#e8ecef' },
  textContainer: { flex: 1, justifyContent: 'center' },
  userName: { color: '#1a1a1a', fontSize: 17, fontWeight: '700', marginBottom: 2 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  roleTag: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
});
