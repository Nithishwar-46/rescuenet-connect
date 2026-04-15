import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

export default function DirectMessageScreen() {
  const { id } = useLocalSearchParams();
  const { userId } = useAuth();
  const { colors } = useTheme();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [receiverName, setReceiverName] = useState('Operating Unit');
  const [uploading, setUploading] = useState(false);
  const [stagedImage, setStagedImage] = useState<any>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    supabase.from('profiles').select('full_name').eq('id', id).single().then(({ data }) => {
        if (data) setReceiverName(data.full_name);
    });

    const fetchMessages = async () => {
      const { data } = await supabase.from('direct_messages').select('*').order('created_at', { ascending: true });
      if (data && userId) {
        const filtered = data.filter(m => (m.sender_id === userId && m.receiver_id === id) || (m.sender_id === id && m.receiver_id === userId));
        setMessages(filtered);
      }
    };
    if (userId) fetchMessages();

    const subscription = supabase.channel('public:direct_messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, payload => {
          fetchMessages();
      }).subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, [userId, id]);

  const executeSend = async () => {
    if (!input.trim() && !stagedImage) return;

    setUploading(true);
    let finalImageUrl = null;
    let currentInput = input.trim();

    if (stagedImage) {
       try {
         const fileName = `${Date.now()}_dm.jpeg`;
         const { error } = await supabase.storage.from('chat_images').upload(fileName, decode(stagedImage.base64), { contentType: 'image/jpeg' });
         if (error) throw error;
         const { data: publicData } = supabase.storage.from('chat_images').getPublicUrl(fileName);
         finalImageUrl = publicData.publicUrl;
       } catch (error: any) { 
         Alert.alert("Diagnostic Error", error.message); 
         setUploading(false);
         return;
       }
    }

    setInput('');
    setStagedImage(null);

    await supabase.from('direct_messages').insert([{ 
       sender_id: userId, receiver_id: id, content: currentInput, image_url: finalImageUrl 
    }]);

    setUploading(false);
  };

  const deleteMessage = async (msgId: string, createdAt: string) => {
      const hoursDiff = (new Date().getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
      if (hoursDiff > 1) { Alert.alert("Restricted", "Messages older than 1 hour cannot be retracted."); return; }
      Alert.alert("Retract Data", "Permanently delete this secure transmission?", [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: async () => {
              await supabase.from('direct_messages').delete().eq('id', msgId);
          }}
      ]);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.5, base64: true });
    if (!result.canceled && result.assets && result.assets[0].base64) {
       setStagedImage({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender_id === userId;
    return (
      <TouchableOpacity 
        onLongPress={() => isMe && deleteMessage(item.id, item.created_at)} 
        activeOpacity={0.8} 
        style={[styles.messageBubble, isMe ? [styles.myMessage, { backgroundColor: colors.primary }] : [styles.otherMessage, { backgroundColor: colors.surface, borderColor: colors.border }]]}
      >
        {item.image_url && <Image source={{ uri: item.image_url }} style={[styles.attachedImage, { backgroundColor: colors.background }]} />}
        {item.content ? <Text style={isMe ? styles.messageText : [styles.otherMessageText, { color: colors.text }]}>{item.content}</Text> : null}
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
           <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{receiverName}</Text>
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
         <View style={styles.stagedContainer}>
            <Image source={{ uri: stagedImage.uri }} style={[styles.stagedPreview, { borderColor: colors.primary }]} />
            <TouchableOpacity style={styles.removeStaged} onPress={() => setStagedImage(null)}>
               <Ionicons name="close-circle" size={26} color={colors.primary} />
            </TouchableOpacity>
         </View>
      )}

      <View style={[styles.inputBox, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TouchableOpacity style={styles.actionButton} onPress={pickImage} disabled={uploading}>
           <Ionicons name="camera" size={26} color={colors.secondary} />
        </TouchableOpacity>
        <View style={[styles.inputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <TextInput style={[styles.textInput, { color: colors.text }]} placeholder={stagedImage ? "Add a caption..." : "Message"} placeholderTextColor={colors.secondary} value={input} onChangeText={setInput} multiline />
        </View>
        <TouchableOpacity style={[styles.sendButton, { backgroundColor: colors.primary }, stagedImage && styles.tickButton]} onPress={() => executeSend()} disabled={uploading}>
          {uploading ? <ActivityIndicator size="small" color="#ffffff" /> : <Ionicons name={stagedImage ? "checkmark" : "send"} size={stagedImage ? 22 : 18} color="#ffffff" style={{ marginLeft: stagedImage ? 0 : 2 }} />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 60, borderBottomWidth: 1, elevation: 4 },
  backButton: { marginRight: 15 },
  headerTitle: { fontSize: 18, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  chatContainer: { padding: 15, paddingBottom: 40 },
  messageBubble: { padding: 14, borderRadius: 20, marginBottom: 12, maxWidth: '80%', elevation: 2 },
  myMessage: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  otherMessage: { alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1 },
  messageText: { color: '#ffffff', fontSize: 15, lineHeight: 22, fontWeight: '500' },
  otherMessageText: { fontSize: 15, lineHeight: 22, fontWeight: '500' },
  attachedImage: { width: 220, height: 220, borderRadius: 14, marginBottom: 8 },
  stagedContainer: { flexDirection: 'row', padding: 15, paddingBottom: 0, alignItems: 'center' },
  stagedPreview: { width: 70, height: 70, borderRadius: 10, borderWidth: 2 },
  removeStaged: { position: 'absolute', top: 5, right: '75%', backgroundColor: '#fff', borderRadius: 13 },
  inputBox: { flexDirection: 'row', padding: 15, paddingBottom: 30, alignItems: 'flex-end', borderTopWidth: 1 },
  actionButton: { padding: 8, marginRight: 2, justifyContent: 'center' },
  inputWrapper: { flex: 1, borderRadius: 24, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 12, marginRight: 10, maxHeight: 120 },
  textInput: { fontSize: 16, maxHeight: 90 },
  sendButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 5, marginBottom: 2 },
  tickButton: { backgroundColor: '#28a745' }
});
