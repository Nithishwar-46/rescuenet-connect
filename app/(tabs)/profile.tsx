import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { useToast } from '@/lib/toast-provider';
import Animated, { FadeInDown } from 'react-native-reanimated';

const EXPERTISE_TAGS = [
  { id: 'medical', label: 'Medical', icon: 'medkit' },
  { id: 'sar', label: 'Search & Rescue', icon: 'flashlight' },
  { id: 'fire', label: 'Fire & Safety', icon: 'flame' },
  { id: 'logistics', label: 'Logistics', icon: 'cube' },
  { id: 'comms', label: 'Communications', icon: 'radio' },
  { id: 'security', label: 'Security', icon: 'shield' },
];

export default function ProfileScreen() {
  const { userId, role, profile: authProfile, refreshProfile } = useAuth();
  const { theme, colors, setTheme, customColor } = useTheme();
  const { showToast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [phoneContact, setPhoneContact] = useState('');
  const [selectedExpertise, setSelectedExpertise] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const agencySwatches = ['#007AFF', '#0A84FF', '#5856D6', '#2ecc71', '#34495e', '#6b7280'];

  useEffect(() => {
    if (authProfile) {
      setFullName(authProfile.full_name || '');
      setAgencyName((authProfile as any).agency_name || '');
      setPhoneContact((authProfile as any).phone_contact || '');
      setSelectedExpertise((authProfile as any).expertise || []);
      setAvatarUrl(authProfile.avatar_url || '');
      setLoading(false);
    }
  }, [authProfile]);

  const toggleExpertise = (id: string) => {
    setSelectedExpertise(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const updateProfile = async () => {
    if (!userId) return;
    setLoading(true);
    const { error } = await supabase.from('profiles').update({ 
      full_name: fullName, 
      agency_name: agencyName,
      phone_contact: phoneContact,
      expertise: selectedExpertise,
      avatar_url: avatarUrl,
      last_seen: new Date().toISOString()
    }).eq('id', userId);

    if (error) showToast({ message: "Update Failed: " + error.message, type: 'CRITICAL' });
    else {
      showToast({ message: "Agency Credentials Synchronized.", type: 'SUCCESS' });
      await refreshProfile();
    }
    setLoading(false);
  };

  const uploadAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true });
    if (!result.canceled && result.assets && result.assets[0].base64) {
       setUploading(true);
       try {
         const fileName = `avatars/${userId}_${Date.now()}.jpeg`;
         const { error } = await supabase.storage.from('avatars').upload(fileName, decode(result.assets[0].base64!), { contentType: 'image/jpeg' });
         if (error) throw error;
         const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
         setAvatarUrl(data.publicUrl);
         
         const { error: profileError } = await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', userId);
         if (profileError) throw profileError;
         
         await refreshProfile();
         showToast({ message: "Agency Identification Primary updated.", type: 'SUCCESS' });
       } catch (error: any) { 
         showToast({ message: "Upload Error: " + error.message, type: 'CRITICAL' }); 
       } finally { 
         setUploading(false); 
       }
    }
  };

  const handleLogout = () => {
      supabase.auth.signOut().then(() => {
        showToast({ message: "Session Terminated.", type: 'INFO' });
      });
  };

  const formatDistance = (dateString: string | null | undefined) => {
    if (!dateString) return 'NEVER';
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return `${diff}S AGO`;
    if (diff < 3600) return `${Math.floor(diff / 60)}M AGO`;
    return date.toLocaleDateString();
  };

  const isAdmin = role === 'admin';
  const roleLabel = isAdmin ? 'AGENCY COMMANDER' : 'PROFESSIONAL RESPONDER';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Agency Profile</Text>
          <TouchableOpacity onPress={() => setShowSettings(!showSettings)}>
             <Ionicons name={showSettings ? "close" : "settings-sharp"} size={26} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView contentContainerStyle={styles.formContainer}>
        {loading ? <ActivityIndicator size="large" color={colors.primary} style={{marginTop: 50}} /> : (
          <>
            {!showSettings ? (
              <Animated.View entering={FadeInDown}>
                <View style={styles.avatarSection}>
                  <TouchableOpacity onPress={uploadAvatar} disabled={uploading} style={styles.avatarWrapper}>
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={[styles.avatarImage, { borderColor: colors.primary }]} />
                    ) : (
                      <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                         <Ionicons name="business" size={60} color={colors.secondary} />
                         <View style={[styles.cameraBadge, { backgroundColor: colors.primary }]}>
                            <Ionicons name="camera" size={16} color="#fff" />
                         </View>
                      </View>
                    )}
                    {uploading && <ActivityIndicator size="large" color={colors.primary} style={styles.uploadingSpinner} />}
                  </TouchableOpacity>
                  
                  <View style={[styles.roleBadge, { backgroundColor: colors.border }]}>
                    <Ionicons name={isAdmin ? 'shield-checkmark' : 'person'} size={14} color={colors.primary} style={{ marginRight: 6 }} />
                    <Text style={[styles.roleText, { color: colors.primary }]}>{roleLabel}</Text>
                  </View>

                  <Text style={[styles.pingStatus, { color: colors.secondary }]}>
                    LAST SYNC: <Text style={{ color: colors.primary, fontWeight: '900' }}>{formatDistance((authProfile as any)?.last_seen)}</Text>
                  </Text>
                </View>

                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.secondary }]}>REPRESENTATIVE NAME</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                        value={fullName}
                        onChangeText={setFullName}
                        placeholder="John Doe"
                    />
                    </View>

                    <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.secondary }]}>AGENCY / ORGANIZATION</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                        value={agencyName}
                        onChangeText={setAgencyName}
                        placeholder="Organization Name"
                    />
                    </View>

                    <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.secondary }]}>PROFESSIONAL CONTACT</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                        value={phoneContact}
                        onChangeText={setPhoneContact}
                        placeholder="+1 000 000 0000"
                        keyboardType="phone-pad"
                    />
                    </View>
                </View>

                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 15 }]}>
                    <Text style={[styles.label, { color: colors.secondary }]}>SPECIALIZED EXPERTISE</Text>
                    <View style={styles.expertiseGrid}>
                        {EXPERTISE_TAGS.map((tag) => (
                        <TouchableOpacity
                            key={tag.id}
                            style={[
                            styles.tag,
                            { backgroundColor: selectedExpertise.includes(tag.id) ? colors.primary : colors.background, borderColor: colors.border }
                            ]}
                            onPress={() => toggleExpertise(tag.id)}
                        >
                            <Ionicons name={tag.icon as any} size={14} color={selectedExpertise.includes(tag.id) ? '#fff' : colors.secondary} />
                            <Text style={[styles.tagText, { color: selectedExpertise.includes(tag.id) ? '#fff' : colors.text }]}>{tag.label}</Text>
                        </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={updateProfile} disabled={loading}>
                  <Text style={styles.saveButtonText}>Sync Agency Data</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                   <Ionicons name="log-out-outline" size={18} color="#ff4d4d" style={{marginRight: 8}} />
                   <Text style={[styles.logoutText, { color: '#ff4d4d' }]}>Terminate Session</Text>
                </TouchableOpacity>
              </Animated.View>
            ) : (
              <Animated.View entering={FadeInDown}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Application Identity</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.secondary }]}>Customize the interface color signature to match your agency branding.</Text>
                
                <View style={styles.themeGrid}>
                  <TouchableOpacity 
                    style={[styles.themeCard, { backgroundColor: colors.surface }, theme === 'agency_blue' && { borderColor: colors.primary, borderWidth: 2 }]} 
                    onPress={() => setTheme('agency_blue')}
                  >
                    <View style={[styles.themePreview, { backgroundColor: '#007AFF' }]} />
                    <Text style={[styles.themeName, { color: colors.text }]}>AGENCY BLUE</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.themeCard, { backgroundColor: colors.surface }, theme === 'monochrome' && { borderColor: colors.primary, borderWidth: 2 }]} 
                    onPress={() => setTheme('monochrome')}
                  >
                    <View style={[styles.themePreview, { backgroundColor: '#1a1a1a' }]} />
                    <Text style={[styles.themeName, { color: colors.text }]}>PROFESSIONAL DARK</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.themeCard, { backgroundColor: colors.surface }, theme === 'custom' && { borderColor: colors.primary, borderWidth: 2 }]} 
                    onPress={() => setTheme('custom')}
                  >
                    <View style={[styles.themePreview, { backgroundColor: customColor }]}>
                       <Ionicons name="color-palette" size={24} color="#fff" />
                    </View>
                    <Text style={[styles.themeName, { color: colors.text }]}>CUSTOM BRAND</Text>
                  </TouchableOpacity>
                </View>

                {theme === 'custom' && (
                  <Animated.View entering={FadeInDown} style={styles.customColorSection}>
                    <Text style={[styles.label, { color: colors.text }]}>Agency Color Signature</Text>
                    <View style={styles.swatchGrid}>
                      {agencySwatches.map((swatch) => (
                        <TouchableOpacity 
                          key={swatch} 
                          style={[styles.swatch, { backgroundColor: swatch }, customColor === swatch && { borderWidth: 3, borderColor: colors.text }]} 
                          onPress={() => setTheme('custom', swatch)}
                        />
                      ))}
                    </View>
                  </Animated.View>
                )}

                <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary, marginTop: 30 }]} onPress={() => setShowSettings(false)}>
                  <Text style={styles.saveButtonText}>Apply Changes</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingTop: 60, borderBottomWidth: 1 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '900', letterSpacing: 0.5 },
  formContainer: { padding: 20, paddingBottom: 60 },
  avatarSection: { alignItems: 'center', marginVertical: 20 },
  avatarWrapper: { elevation: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  avatarImage: { width: 110, height: 110, borderRadius: 55, borderWidth: 4 },
  avatarPlaceholder: { width: 110, height: 110, borderRadius: 55, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderStyle: 'dashed' },
  cameraBadge: { position: 'absolute', bottom: 2, right: 2, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  uploadingSpinner: { position: 'absolute', top: 35 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 15, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  roleText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  pingStatus: { fontSize: 10, fontWeight: '700', marginTop: 12, letterSpacing: 0.5 },
  card: { padding: 20, borderRadius: 20, borderWidth: 1 },
  label: { fontSize: 10, fontWeight: '900', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  inputGroup: { marginBottom: 20 },
  input: { borderRadius: 12, padding: 16, fontSize: 15, borderWidth: 1.5, fontWeight: '600' },
  expertiseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  tagText: { fontSize: 11, fontWeight: '800', marginLeft: 6 },
  saveButton: { borderRadius: 18, padding: 20, alignItems: 'center', marginTop: 25, elevation: 4 },
  saveButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  logoutButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 30, padding: 15 },
  logoutText: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  
  sectionTitle: { fontSize: 20, fontWeight: '900', marginBottom: 8 },
  sectionSubtitle: { fontSize: 13, marginBottom: 25, lineHeight: 20, fontWeight: '600' },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  themeCard: { width: '48%', padding: 15, borderRadius: 18, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: 'transparent', elevation: 2 },
  themePreview: { width: '100%', height: 45, borderRadius: 10, marginBottom: 10, justifyContent: 'center', alignItems: 'center' },
  themeName: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  
  customColorSection: { marginTop: 15 },
  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 10 },
  swatch: { width: 45, height: 45, borderRadius: 12 }
});
