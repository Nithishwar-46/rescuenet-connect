import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { useToast } from '@/lib/toast-provider';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { decode } from 'base64-arraybuffer';
import Animated, { FadeInRight, FadeInLeft, Layout } from 'react-native-reanimated';

const CHANNELS = [
  { id: 'global', name: 'Global Ops', icon: 'globe' },
  { id: 'regional', name: 'Regional Comms', icon: 'map' },
  { id: 'medical', name: 'Medical Division', icon: 'medkit' },
  { id: 'sar', name: 'Search & Rescue', icon: 'flashlight' },
  { id: 'fire', name: 'Fire Control', icon: 'flame' },
  { id: 'logistics', name: 'Logistics', icon: 'cube' },
];

export default function ChatScreen() {
  const { userId, role } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  
  const [activeChannel, setActiveChannel] = useState('global');
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [stagedImage, setStagedImage] = useState<any>(null);
  const flatListRef = useRef<FlatList>(null);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('channel', activeChannel)
      .order('created_at', { ascending: true });
      
    if (error) return;
    
    if (data) {
        const { data: profilesData } = await supabase.from('profiles').select('id, full_name, avatar_url');
        const profilesMap: any = {};
        if (profilesData) profilesData.forEach(p => profilesMap[p.id] = p);
        
        const merged = await Promise.all(data.map(async (m) => {
            let locName = m.pin_latitude ? `${m.pin_latitude.toFixed(4)}, ${m.pin_longitude.toFixed(4)}` : null;
            if (m.pin_latitude) {
               try {
                  const geocode = await Location.reverseGeocodeAsync({ latitude: m.pin_latitude, longitude: m.pin_longitude });
                  if (geocode.length > 0) {
                     const p = geocode[0];
                     const parts = [p.city || p.subregion, p.region].filter(Boolean);
                     if (parts.length > 0) locName = parts.join(', ');
                  }
               } catch (e) {}
            }
            return { 
               ...m, 
               locationName: locName,
               profiles: profilesMap[m.user_id] || {} 
            };
        }));
        
        setMessages(merged);
    }
  };

  useEffect(() => {
    fetchMessages();
    const subscription = supabase.channel(`public:messages:${activeChannel}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `channel=eq.${activeChannel}` }, () => {
         fetchMessages();
      }).subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, [activeChannel]);

  const executeLocationSend = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
         showToast({ message: "Strategic location access denied.", type: 'WARNING' });
         return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      await executeSend(undefined, loc.coords.latitude, loc.coords.longitude);
  };

  const executeSend = async (forcedUrl?: string, lat?: number, lng?: number) => {
    if (!input.trim() && !stagedImage && !lat && !forcedUrl) return;

    setUploading(true);
    let finalImageUrl = forcedUrl || null;
    let currentInput = input.trim();

    if (stagedImage) {
       try {
         const fileName = `${Date.now()}_grp.jpeg`;
         const { error } = await supabase.storage.from('chat_images').upload(fileName, decode(stagedImage.base64), { contentType: 'image/jpeg' });
         if (error) throw error;
         const { data: publicData } = supabase.storage.from('chat_images').getPublicUrl(fileName);
         finalImageUrl = publicData.publicUrl;
       } catch (error: any) { 
         showToast({ message: error.message, type: 'CRITICAL' });
         setUploading(false);
         return;
       }
    }

    setInput('');
    setStagedImage(null);

    const { error } = await supabase.from('messages').insert([{ 
        user_id: userId, 
        content: currentInput,
        image_url: finalImageUrl,
        pin_latitude: lat || null,
        pin_longitude: lng || null,
        channel: activeChannel
    }]);

    if (error) showToast({ message: "Transmission failed.", type: 'CRITICAL' });
    setUploading(false);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.5, base64: true });
    if (!result.canceled && result.assets && result.assets[0].base64) {
       setStagedImage({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
    }
  };

  const deleteMessage = async (msgId: string) => {
      Alert.alert("Retract Data", "Permanently delete this transmission?", [
          { text: "Cancel", style: "cancel" },
          { text: "Purge", style: "destructive", onPress: async () => {
              const { error } = await supabase.from('messages').delete().eq('id', msgId);
              if (!error) showToast({ message: "Transmission retracted.", type: 'INFO' });
              else showToast({ message: error.message, type: 'CRITICAL' });
          }}
      ]);
  };

  const renderMessage = ({ item, index }: { item: any, index: number }) => {
    const isMe = item.user_id === userId;
    const canDelete = isMe || role === 'admin';
    const profile = item.profiles || {};
    const senderName = profile.full_name || 'Unit ' + item.user_id.substring(0, 5);
    const avatar = profile.avatar_url;
    const time = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <Animated.View 
        entering={isMe ? FadeInRight.delay(50) : FadeInLeft.delay(50)}
        layout={Layout.springify()}
        style={[styles.messageWrapper, isMe ? styles.myWrapper : styles.otherWrapper]}
      >
        <TouchableOpacity 
          onLongPress={() => canDelete && deleteMessage(item.id)} 
          activeOpacity={0.9} 
          style={[styles.messageBubble, isMe ? [styles.myMessage, { backgroundColor: colors.primary }] : [styles.otherMessage, { backgroundColor: colors.surface, borderColor: colors.border }]]}
        >
          {!isMe && (
             <View style={styles.otherHeader}>
                <Image source={{ uri: avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png' }} style={styles.miniAvatar} />
                <Text style={[styles.senderName, { color: colors.primary }]}>{senderName}</Text>
             </View>
          )}
          
          {item.image_url && <Image source={{ uri: item.image_url }} style={styles.attachedImage} />}
          
          {item.locationName && (
             <View style={[styles.locationPin, { backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)' }]}>
                <Ionicons name="location" size={16} color={isMe ? "#ffffff" : colors.primary} />
                <Text style={[styles.locationText, { color: isMe ? "#ffffff" : colors.text }]}>{item.locationName}</Text>
             </View>
          )}

          {item.content ? (
            <Text style={[styles.messageText, { color: isMe ? "#ffffff" : colors.text }]}>
              {item.content}
            </Text>
          ) : null}
          
          <Text style={[styles.timeStamp, { color: isMe ? 'rgba(255,255,255,0.7)' : colors.secondary }]}>
            {time}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.encryptionHeader}>
           <Ionicons name="lock-closed" size={12} color={colors.primary} />
           <Text style={[styles.headerStatus, { color: colors.primary }]}>SECURE UPLINK ACTIVE</Text>
        </View>
        <Text style={[styles.headerTitle, { color: colors.text }]}>ALLIANCE CHANNELS</Text>
      </View>

      <View style={[styles.channelScrollContainer, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.channelScroll}>
            {CHANNELS.map(ch => (
               <TouchableOpacity 
                 key={ch.id} 
                 style={[
                    styles.channelTab, 
                    { borderColor: colors.border, backgroundColor: colors.surface },
                    activeChannel === ch.id && { backgroundColor: colors.primary, borderColor: colors.primary }
                 ]} 
                 onPress={() => setActiveChannel(ch.id)}
               >
                  <Ionicons name={ch.icon as any} size={14} color={activeChannel === ch.id ? '#fff' : colors.secondary} />
                  <Text style={[styles.channelText, { color: activeChannel === ch.id ? '#fff' : colors.text }]}>{ch.name}</Text>
               </TouchableOpacity>
            ))}
        </ScrollView>
      </View>
      
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id?.toString() || Math.random().toString()}
        renderItem={renderMessage}
        contentContainerStyle={styles.chatContainer}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />
      
      {stagedImage && (
         <View style={[styles.stagedContainer, { backgroundColor: colors.surface }]}>
            <Image source={{ uri: stagedImage.uri }} style={[styles.stagedPreview, { borderColor: colors.primary }]} />
            <TouchableOpacity style={[styles.removeStaged, { backgroundColor: colors.primary }]} onPress={() => setStagedImage(null)}>
               <Ionicons name="close" size={16} color="#fff" />
            </TouchableOpacity>
            <Text style={[styles.stagedHint, { color: colors.text }]}>TRANSMISSION READY</Text>
         </View>
      )}

      <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.toolButton} onPress={pickImage} disabled={uploading}>
             <Ionicons name="image-outline" size={24} color={colors.secondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolButton} onPress={executeLocationSend} disabled={uploading}>
             <Ionicons name="map-outline" size={24} color={colors.secondary} />
          </TouchableOpacity>
        </View>
        
        <View style={[styles.inputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <TextInput
            style={[styles.textInput, { color: colors.text }]}
            placeholder={`Message ${CHANNELS.find(c => c.id === activeChannel)?.name}...`}
            placeholderTextColor={colors.secondary}
            value={input}
            onChangeText={setInput}
            multiline
          />
        </View>
        
        <TouchableOpacity style={[styles.sendButton, { backgroundColor: colors.primary }]} onPress={() => executeSend()} disabled={uploading}>
          {uploading ? <ActivityIndicator size="small" color="#ffffff" /> : <Ionicons name="paper-plane" size={20} color="#ffffff" />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingTop: 60, alignItems: 'center' },
  encryptionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  headerStatus: { fontSize: 10, fontWeight: '900', marginLeft: 4, letterSpacing: 1 },
  headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  channelScrollContainer: { borderBottomWidth: 1, paddingVertical: 10 },
  channelScroll: { paddingHorizontal: 15, gap: 10, alignItems: 'center' },
  channelTab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 36, borderRadius: 18, borderWidth: 1, elevation: 1 },
  channelText: { fontSize: 12, fontWeight: '800', marginLeft: 6, letterSpacing: 0.5 },
  chatContainer: { padding: 20, paddingBottom: 60 },
  messageWrapper: { marginBottom: 12, width: '100%' },
  myWrapper: { alignItems: 'flex-end' },
  otherWrapper: { alignItems: 'flex-start' },
  messageBubble: { padding: 15, borderRadius: 24, maxWidth: '85%', elevation: 4, shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { height: 4, width: 0 } },
  myMessage: { borderBottomRightRadius: 4 },
  otherMessage: { borderBottomLeftRadius: 4, borderWidth: 1 },
  otherHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  miniAvatar: { width: 22, height: 22, borderRadius: 11, marginRight: 8 },
  senderName: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  messageText: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  attachedImage: { width: 240, height: 240, borderRadius: 16, marginBottom: 10 },
  locationPin: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12, marginBottom: 8 },
  locationText: { fontSize: 12, fontWeight: '800', marginLeft: 6 },
  timeStamp: { fontSize: 10, fontWeight: '700', alignSelf: 'flex-end', marginTop: 6 },
  stagedContainer: { flexDirection: 'row', padding: 15, alignItems: 'center', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  stagedPreview: { width: 60, height: 60, borderRadius: 12, borderWidth: 2 },
  removeStaged: { position: 'absolute', top: 10, left: 65, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  stagedHint: { marginLeft: 20, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  inputContainer: { flexDirection: 'row', padding: 15, paddingBottom: 35, alignItems: 'flex-end', borderTopWidth: 1 },
  actionButtons: { flexDirection: 'row', marginRight: 5 },
  toolButton: { padding: 10 },
  inputWrapper: { flex: 1, borderRadius: 20, borderWidth: 1, paddingHorizontal: 15, paddingVertical: 10, marginRight: 10, maxHeight: 120 },
  textInput: { fontSize: 15, fontWeight: '700' },
  sendButton: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', elevation: 6 }
});
