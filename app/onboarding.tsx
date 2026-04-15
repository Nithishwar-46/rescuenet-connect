import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { router } from 'expo-router';

const EXPERTISE_TAGS = [
  { id: 'medical', label: 'Medical', icon: 'medkit' },
  { id: 'sar', label: 'Search & Rescue', icon: 'flashlight' },
  { id: 'fire', label: 'Fire & Safety', icon: 'flame' },
  { id: 'logistics', label: 'Logistics', icon: 'cube' },
  { id: 'comms', label: 'Communications', icon: 'radio' },
  { id: 'security', label: 'Security', icon: 'shield' },
];

export default function OnboardingScreen() {
  const { userId, refreshProfile } = useAuth();
  const { colors } = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [phoneContact, setPhoneContact] = useState('');
  const [selectedExpertise, setSelectedExpertise] = useState<string[]>([]);

  const toggleExpertise = (id: string) => {
    setSelectedExpertise(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleCompleteOnboarding = async () => {
    if (!fullName || !agencyName || !phoneContact) {
      alert("Please complete all agency credentials.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from('profiles').update({
      full_name: fullName,
      agency_name: agencyName,
      phone_contact: phoneContact,
      expertise: selectedExpertise,
      has_completed_onboarding: true,
      last_seen: new Date().toISOString()
    }).eq('id', userId);

    if (error) {
      alert(error.message);
    } else {
      await refreshProfile();
      router.replace('/(tabs)');
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeInUp} style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
            <Ionicons name="shield-checkmark" size={40} color="#fff" />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Agency Initialization</Text>
          <Text style={[styles.subtitle, { color: colors.secondary }]}>Setup your professional responder profile to coordinate with the global network.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200)} style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.secondary }]}>REPRESENTATIVE NAME</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. John Doe"
              placeholderTextColor={colors.secondary}
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.secondary }]}>AGENCY / ORGANIZATION</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="RescueNet Global, Red Cross, etc."
              placeholderTextColor={colors.secondary}
              value={agencyName}
              onChangeText={setAgencyName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.secondary }]}>CONTACT NUMBER</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="+1 000 000 0000"
              placeholderTextColor={colors.secondary}
              keyboardType="phone-pad"
              value={phoneContact}
              onChangeText={setPhoneContact}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.secondary }]}>UNIT EXPERTISE</Text>
            <View style={styles.expertiseGrid}>
              {EXPERTISE_TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag.id}
                  style={[
                    styles.tag,
                    { backgroundColor: selectedExpertise.includes(tag.id) ? colors.primary : colors.surface, borderColor: colors.border }
                  ]}
                  onPress={() => toggleExpertise(tag.id)}
                >
                  <Ionicons name={tag.icon as any} size={14} color={selectedExpertise.includes(tag.id) ? '#fff' : colors.secondary} />
                  <Text style={[styles.tagText, { color: selectedExpertise.includes(tag.id) ? '#fff' : colors.text }]}>{tag.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.button, { backgroundColor: colors.primary }]} 
            onPress={handleCompleteOnboarding}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Complete Activation</Text>}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 30, paddingTop: 80, paddingBottom: 50 },
  header: { alignItems: 'center', marginBottom: 40 },
  iconContainer: { width: 80, height: 80, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 20, elevation: 5 },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: 1 },
  subtitle: { fontSize: 14, textAlign: 'center', marginTop: 10, lineHeight: 20, fontWeight: '600' },
  form: { gap: 20 },
  inputGroup: { gap: 8 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  input: { height: 60, borderRadius: 15, paddingHorizontal: 20, fontSize: 16, borderWidth: 1, fontWeight: '600' },
  expertiseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 5 },
  tag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 45, borderRadius: 12, borderWidth: 1 },
  tagText: { fontSize: 12, fontWeight: '800', marginLeft: 8 },
  button: { height: 65, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginTop: 20, elevation: 5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1 }
});
