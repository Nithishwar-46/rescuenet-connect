import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { router } from 'expo-router';
import { TacticalButton } from '@/components/ui/tactical-button';

const CACHE_KEY_ALERTS = 'rescuenet_map_alerts';
const CACHE_KEY_UNITS = 'rescuenet_map_units';

const EXPERTISE_FILTERS = [
  { id: 'all', label: 'All Units', icon: 'apps' },
  { id: 'medical', label: 'Medical', icon: 'medkit' },
  { id: 'sar', label: 'Search & Rescue', icon: 'flashlight' },
  { id: 'fire', label: 'Fire & Safety', icon: 'flame' },
  { id: 'logistics', label: 'Logistics', icon: 'cube' },
  { id: 'comms', label: 'Communications', icon: 'radio' },
  { id: 'security', label: 'Security', icon: 'shield' },
];

const EMERGENCY_RED = '#ff4d4d';

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  var R = 6371; // Radius of the earth in km
  var dLat = (lat2-lat1) * (Math.PI/180);
  var dLon = (lon2-lon1) * (Math.PI/180);
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; 
}

export default function MapScreen() {
  const { userId, profile: authProfile } = useAuth();
  const { colors } = useTheme();
  const webViewRef = useRef<WebView>(null);
  
  const [hasLocation, setHasLocation] = useState(false);
  const [sosModalVisible, setSosModalVisible] = useState(false);
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  
  const [sosDetails, setSosDetails] = useState('');
  const [sosTargetExpertise, setSosTargetExpertise] = useState('all');
  const [requestTarget, setRequestTarget] = useState<string | null>(null);
  const [requestResource, setRequestResource] = useState('');
  const [requestQuantity, setRequestQuantity] = useState('1');
  
  const [loadingSOS, setLoadingSOS] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [selectedSOSLocation, setSelectedSOSLocation] = useState<{lat: number, lng: number} | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [alliedUnits, setAlliedUnits] = useState<any[]>([]);
  const [selectedFilter, setSelectedFilter] = useState('all');

  const loadFromCache = async () => {
    try {
      const cachedAlerts = await AsyncStorage.getItem(CACHE_KEY_ALERTS);
      const cachedUnits = await AsyncStorage.getItem(CACHE_KEY_UNITS);
      if (cachedAlerts) setAlerts(JSON.parse(cachedAlerts));
      if (cachedUnits) setAlliedUnits(JSON.parse(cachedUnits));
    } catch (e) {
      console.warn("Cache Retrieval Failure", e);
    }
  };

  useEffect(() => {
    let locationSubscription: any = null;
    loadFromCache();

    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        locationSubscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 5 },
          async (loc: Location.LocationObject) => {
            setHasLocation(true);
            setCurrentLocation(loc);
            
            if (webViewRef.current) {
              webViewRef.current.injectJavaScript(`
                if (window.updateMarker) window.updateMarker(${loc.coords.latitude}, ${loc.coords.longitude});
                true;
              `);
            }

            if (userId) {
               await supabase.from('locations').upsert({
                  user_id: userId,
                  latitude: loc.coords.latitude,
                  longitude: loc.coords.longitude,
                  updated_at: new Date().toISOString()
               });
               await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', userId);
            }
          }
        );
      } catch (error: any) {
        console.warn("GPS Error", error.message);
      }
    })();

    const fetchAlerts = async (loc?: Location.LocationObject) => {
       const userLoc = loc || currentLocation;
       const { data, error } = await supabase.from('sos_alerts').select('*').eq('status', 'active');
       if (data && !error) {
         let filtered = data;
         if (userLoc) {
            filtered = filtered.filter(a => {
               if (a.user_id === userId) return true;
               const dist = getDistanceFromLatLonInKm(userLoc.coords.latitude, userLoc.coords.longitude, a.latitude, a.longitude);
               return dist <= 25;
            });
         }
         if (authProfile) {
            filtered = filtered.filter(a => {
               if (a.user_id === userId) return true;
               if (a.target_expertise !== 'all' && (authProfile as any).role !== 'admin') {
                  const hasSkill = (authProfile as any).expertise?.includes(a.target_expertise);
                  if (!hasSkill) return false;
               }
               return true;
            });
         }
         setAlerts(filtered);
         await AsyncStorage.setItem(CACHE_KEY_ALERTS, JSON.stringify(filtered));
       }
    };
    fetchAlerts();

    const fetchActiveUnits = async () => {
         const { data: locData, error: locErr } = await supabase.from('locations').select('*');
         if (!locData || locErr) return;
         
         const { data: profData } = await supabase.from('profiles').select('id, full_name, agency_name, expertise, avatar_url, last_seen');
         const profMap: any = {};
         if (profData) profData.forEach(p => profMap[p.id] = p);
         
         const others = locData.filter(l => l.user_id !== userId).map(l => ({
             ...l,
             profile: profMap[l.user_id] || {}
         }));
         setAlliedUnits(others);
         await AsyncStorage.setItem(CACHE_KEY_UNITS, JSON.stringify(others));
    };
    fetchActiveUnits();

    const sosSubscription = supabase.channel('map_sos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_alerts' }, () => fetchAlerts())
      .subscribe();

    const locSubscription = supabase.channel('map_locs')
       .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, () => fetchActiveUnits())
       .subscribe();

    return () => {
      if (locationSubscription) locationSubscription.remove();
      supabase.removeChannel(sosSubscription);
      supabase.removeChannel(locSubscription);
    };
  }, [userId, authProfile, currentLocation]);

  const formatDistance = (dateString: string | null | undefined) => {
    if (!dateString) return 'NEVER';
    const diff = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
    if (diff < 60) return `${diff}S AGO`;
    if (diff < 3600) return `${Math.floor(diff / 60)}M AGO`;
    return '1H+ AGO';
  };

  const updateMapMarkers = () => {
    if (!webViewRef.current) return;
    
    const filteredUnits = selectedFilter === 'all' 
      ? alliedUnits 
      : alliedUnits.filter(u => u.profile?.expertise?.includes(selectedFilter));

    const unitsJS = filteredUnits.map(unit => {
        const profile = unit.profile || {};
        const safeName = (profile.full_name || 'Unit ' + unit.user_id.substring(0, 4)).replace(/"/g, '\\"');
        const safeAgency = (profile.agency_name || 'Independent').replace(/"/g, '\\"');
        const expertiseStr = (profile.expertise || []).join(' | ').toUpperCase();
        const lastSeen = formatDistance(profile.last_seen);
        return `window.updateAlliedMarker("${unit.user_id}", ${unit.latitude}, ${unit.longitude}, "${safeName}", "${profile.avatar_url || ''}", "${safeAgency}", "${expertiseStr}", "${lastSeen}");`;
    }).join('\n');

    const alertsJS = alerts.map(a => {
        const safeDetails = (a.details || 'Emergency Deploy!').replace(/"/g, '\\"').replace(/\n/g, '\\n');
        return `window.addSosMarker("${a.id}", ${a.latitude}, ${a.longitude}, "${safeDetails}", "${a.target_expertise || 'all'}");`;
    }).join('\n');

    webViewRef.current.injectJavaScript(`
      if (window.clearDynamicMarkers) window.clearDynamicMarkers();
      ${unitsJS}
      ${alertsJS}
      true;
    `);
  };

  useEffect(() => {
    updateMapMarkers();
  }, [alliedUnits, alerts, selectedFilter]);

  const onMessage = (event: any) => {
      const msg = event.nativeEvent.data;
      if (msg.startsWith('resolve_sos:')) {
          const alertId = msg.split(':')[1];
          Alert.alert("Resolve Help Request", "Mark this alert as completed?", [
              { text: "Cancel" },
              { text: "Resolve", style: "destructive", onPress: async () => {
                  await supabase.from('sos_alerts').update({ status: 'resolved' }).eq('id', alertId);
              }}
          ]);
      } else if (msg.startsWith('request_support:')) {
          const targetId = msg.split(':')[1];
          setRequestTarget(targetId);
          setRequestModalVisible(true);
      } else if (msg.startsWith('target:')) {
          const coords = msg.replace('target:', '').split(',');
          setSelectedSOSLocation({ lat: parseFloat(coords[0]), lng: parseFloat(coords[1]) });
      } else if (msg === 'clear_target') {
          setSelectedSOSLocation(null);
      }
  };

  const dispatchSOS = async () => {
      const targetLat = selectedSOSLocation ? selectedSOSLocation.lat : currentLocation?.coords.latitude;
      const targetLng = selectedSOSLocation ? selectedSOSLocation.lng : currentLocation?.coords.longitude;

      if (!targetLat || !targetLng) return;
      setLoadingSOS(true);
      let addressStr = '';
      try {
        const geocode = await Location.reverseGeocodeAsync({ latitude: targetLat, longitude: targetLng });
        if (geocode.length > 0) {
           const place = geocode[0];
           addressStr = [place.name, place.street, place.city, place.region, place.country].filter(Boolean).join(', ');
        }
      } catch (e) {}
      
      const finalDetails = addressStr ? `Location: ${addressStr}\n\n${sosDetails || 'Urgent Assistance Needed'}` : (sosDetails || 'Urgent Assistance Needed');

      const { error } = await supabase.from('sos_alerts').insert([{
          user_id: userId,
          latitude: targetLat,
          longitude: targetLng,
          details: finalDetails,
          status: 'active',
          target_expertise: sosTargetExpertise
      }]);

      setLoadingSOS(false);
      if (!error) {
         setSosModalVisible(false);
         setSosDetails('');
         setSosTargetExpertise('all');
         setSelectedSOSLocation(null);
         webViewRef.current?.injectJavaScript(`if (window.clearTargetMarker) window.clearTargetMarker(); true;`);
         Alert.alert("Alert Dispatched", "Targeted distress signal is now live.");
      }
  };

  const handleResourceRequest = async () => {
    if (!requestTarget || !requestResource.trim()) return;
    setLoadingSOS(true);
    
    const { error } = await supabase.from('resource_requests').insert([{
      sender_id: userId,
      target_id: requestTarget,
      resource_name: requestResource,
      quantity: parseInt(requestQuantity) || 1,
      status: 'pending'
    }]);

    setLoadingSOS(false);
    if (!error) {
      setRequestModalVisible(false);
      setRequestResource('');
      setRequestQuantity('1');
      Alert.alert("Request Dispatched", "Professional assistance requested.");
    } else {
      Alert.alert("Failed", error.message);
    }
  };

  const getLeafletMap = () => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { padding:0; margin:0; }
        #map { height:100vh; width:100vw; background: #f3f4f6; }
        .sos-pulse {
            width: 40px; height: 40px; background: ${EMERGENCY_RED}; border-radius: 50%;
            border: 3px solid #fff; box-shadow: 0 0 15px rgba(255,77,77,0.6);
            display: flex; justify-content: center; align-items: center;
            color: #fff; font-weight: 900; font-size: 20px;
            animation: pulse 1.5s infinite;
        }
        @keyframes pulse { 0% { transform: scale(0.9); } 50% { transform: scale(1.1); } 100% { transform: scale(0.9); } }
        .popup-content { text-align: center; font-family: sans-serif; min-width: 160px; }
        .popup-header { font-weight: 900; color: #1a1a1a; font-size: 14px; margin-bottom: 4px; }
        .popup-agency { font-weight: 700; color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
        .popup-expertise { font-size: 10px; color: ${colors.primary}; font-weight: 800; margin: 4px 0; border-top: 1px solid #eee; padding-top: 4px; }
        .popup-ping { font-size: 9px; color: #999; font-weight: 700; margin-bottom: 8px; }
        .avatar-img { width: 45px; height: 45px; border-radius: 22.5px; margin-bottom: 5px; border: 2px solid ${colors.primary}; }
        .req-btn { width: 100%; padding: 8px; background: ${colors.primary}; color: #fff; border: none; border-radius: 6px; font-weight: 900; font-size: 10px; cursor: pointer; letter-spacing: 0.5px; }
        .resolve-btn { width: 100%; padding: 10px; background: ${EMERGENCY_RED}; color: #fff; border: none; border-radius: 8px; font-weight: 900; margin-top: 10px; cursor: pointer; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var bounds = L.latLngBounds(L.latLng(6.0, 68.0), L.latLng(36.0, 98.0));
        var map = L.map('map', { zoomControl: false, attributionControl: false, maxBounds: bounds, minZoom: 5, maxBoundsViscosity: 1.0 }).setView([20.5937, 78.9629], 5);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);

        var userMarker = null;
        var alliedMarkers = {};
        var sosMarkers = {};

        window.updateMarker = function(lat, lng) {
            var icon = L.divIcon({ html: '<div style="width:16px;height:16px;background:${colors.primary};border-radius:50%;border:4px solid #fff;box-shadow:0 0 10px ${colors.primary}66;"></div>', iconSize: [24,24], iconAnchor: [12,12] });
            if (!userMarker) {
                userMarker = L.marker([lat, lng], { icon: icon }).addTo(map);
                map.setView([lat, lng], 15);
            } else {
                userMarker.setLatLng([lat, lng]);
            }
        };

        window.updateAlliedMarker = function(id, lat, lng, name, avatar, agency, expertise, ping) {
            var icon = L.divIcon({ html: '<div style="width:16px;height:16px;background:#2ecc71;border-radius:50%;border:3px solid #fff;box-shadow:0 0 10px rgba(46,204,113,0.5);"></div>', iconSize: [22,22], iconAnchor: [11,11] });
            var marker = L.marker([lat, lng], { icon: icon }).addTo(map);
            var img = avatar ? '<img src="'+avatar+'" class="avatar-img"/>' : '<div style="width:45px;height:45px;border-radius:22.5px;background:#f0f0f0;margin:0 auto 5px;display:flex;align-items:center;justify-content:center;color:#ccc;border:2px solid #eee">👤</div>';
            var btn = '<button class="req-btn" onclick="window.ReactNativeWebView.postMessage(\\'request_support:'+id+'\\')">SEND COLLAB REQUEST</button>';
            marker.bindPopup('<div class="popup-content">' + img + '<div class="popup-header">'+name+'</div><div class="popup-agency">'+agency+'</div><div class="popup-expertise">'+expertise+'</div><div class="popup-ping">ACTIVE: '+ping+'</div>' + btn + '</div>');
            alliedMarkers[id] = marker;
        };

        window.addSosMarker = function(id, lat, lng, details, target) {
            var icon = L.divIcon({ className: '', html: '<div class="sos-pulse">!</div>', iconSize: [40,40], iconAnchor: [20,20] });
            var marker = L.marker([lat, lng], { icon: icon }).addTo(map);
            var btn = '<button class="resolve-btn" onclick="window.ReactNativeWebView.postMessage(\\'resolve_sos:'+id+'\\')">RESOLVE HELP ALERT</button>';
            marker.bindPopup('<div class="popup-content"><div style="color:${EMERGENCY_RED};font-weight:900;margin-bottom:5px">⚠️ EMERGENCY ALERT</div><div style="font-size:10px;font-weight:800;color:#666;margin-bottom:5px">TARGET: '+target.toUpperCase()+'</div><p style="font-size:13px;margin:0">'+details+'</p>'+btn+'</div>');
            sosMarkers[id] = marker;
        };

        window.clearDynamicMarkers = function() {
            Object.values(alliedMarkers).forEach(m => map.removeLayer(m));
            Object.values(sosMarkers).forEach(m => map.removeLayer(m));
            alliedMarkers = {};
            sosMarkers = {};
        };

        var targetMarker = null;
        map.on('click', function(e) {
            if (!targetMarker) {
                targetMarker = L.marker(e.latlng, { icon: L.divIcon({ html: '<div style="width:24px;height:24px;border-radius:50%;border:3px dashed ${EMERGENCY_RED};background:rgba(255,77,77,0.1)"></div>', iconSize:[24,24], iconAnchor:[12,12] }) }).addTo(map);
            } else {
                targetMarker.setLatLng(e.latlng);
            }
            window.ReactNativeWebView.postMessage('target:' + e.latlng.lat + ',' + e.latlng.lng);
        });

        window.clearTargetMarker = function() {
            if (targetMarker) { map.removeLayer(targetMarker); targetMarker = null; }
            window.ReactNativeWebView.postMessage('clear_target');
        };
      </script>
    </body>
    </html>
  `;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <WebView
        ref={webViewRef}
        style={styles.map}
        source={{ html: getLeafletMap() }}
        onMessage={onMessage}
        scrollEnabled={false}
      />

      <Animated.View entering={FadeInUp.delay(500)} style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {EXPERTISE_FILTERS.map(filter => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterChip,
                { backgroundColor: selectedFilter === filter.id ? colors.primary : colors.surface, borderColor: colors.border }
              ]}
              onPress={() => setSelectedFilter(filter.id)}
            >
              <Ionicons name={filter.icon as any} size={16} color={selectedFilter === filter.id ? '#fff' : colors.secondary} />
              <Text style={[styles.filterLabel, { color: selectedFilter === filter.id ? '#fff' : colors.text }]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>

      <TouchableOpacity 
        style={[styles.collabFab, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push('/resource-requests')}
      >
        <Ionicons name="people" size={24} color={colors.primary} />
      </TouchableOpacity>

      {selectedSOSLocation && (
        <View style={[styles.targetBanner, { backgroundColor: EMERGENCY_RED }]}>
           <Text style={styles.targetText}>SOS LOCATION TARGETED</Text>
           <TouchableOpacity onPress={() => {
              webViewRef.current?.injectJavaScript(`window.clearTargetMarker(); true;`);
           }}>
             <Ionicons name="close-circle" size={20} color="#fff" />
           </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={[styles.sosButton, { backgroundColor: EMERGENCY_RED }]} onPress={() => setSosModalVisible(true)}>
        <Ionicons name="alert-circle" size={32} color="#ffffff" />
      </TouchableOpacity>

      <Modal visible={sosModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
           <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                 <Ionicons name="warning" size={36} color={EMERGENCY_RED} />
                 <Text style={[styles.modalTitle, { color: colors.text }]}>SEND HELP SIGNAL</Text>
                 <Text style={[styles.modalSub, { color: colors.secondary }]}>Dispatches coordinate alert to specialized active units.</Text>
              </View>
              
              <View style={styles.reqInputGroup}>
                <Text style={[styles.reqLabel, { color: colors.secondary }]}>NATURE OF EMERGENCY</Text>
                <TextInput 
                   style={[styles.detailsInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                   placeholder="Briefly describe the situation..."
                   placeholderTextColor={colors.secondary}
                   multiline
                   value={sosDetails}
                   onChangeText={setSosDetails}
                />
              </View>
              
              <View style={styles.reqInputGroup}>
                <Text style={[styles.reqLabel, { color: colors.secondary, marginTop: 5 }]}>TARGET REQUIRED SPECIALIST(S)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {EXPERTISE_FILTERS.map(f => (
                     <TouchableOpacity 
                        key={f.id} 
                        style={[styles.smallFilterChip, { backgroundColor: sosTargetExpertise === f.id ? EMERGENCY_RED : colors.background, borderColor: colors.border }]}
                        onPress={() => setSosTargetExpertise(f.id)}
                     >
                        <Text style={{ fontSize: 11, fontWeight: '800', color: sosTargetExpertise === f.id ? '#ffffff' : colors.text }}>{f.label.toUpperCase()}</Text>
                     </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.modalButtons}>
                 <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.border }]} onPress={() => setSosModalVisible(false)}>
                    <Text style={[styles.modalBtnText, { color: colors.text }]}>CANCEL</Text>
                 </TouchableOpacity>
                 <View style={{ flex: 1 }}>
                    <TacticalButton
                      title="DISPATCH"
                      onPress={dispatchSOS}
                      loading={loadingSOS}
                      colors={[EMERGENCY_RED, '#cc0000']}
                      style={{ height: '100%' }}
                    />
                 </View>
              </View>
           </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={requestModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
           <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                 <Ionicons name="people" size={36} color={colors.primary} />
                 <Text style={[styles.modalTitle, { color: colors.text }]}>AGENCY COLLAB</Text>
                 <Text style={[styles.modalSub, { color: colors.secondary }]}>Request professional support or resources.</Text>
              </View>
              
              <View style={styles.reqInputGroup}>
                <Text style={[styles.reqLabel, { color: colors.secondary }]}>SUPPORT NEEDED</Text>
                <TextInput 
                  style={[styles.smallInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder="e.g. Logistics backup, supplies"
                  placeholderTextColor={colors.secondary}
                  value={requestResource}
                  onChangeText={setRequestResource}
                />
              </View>

              <View style={styles.reqInputGroup}>
                <Text style={[styles.reqLabel, { color: colors.secondary }]}>QUANTITY / SCALE</Text>
                <TextInput 
                  style={[styles.smallInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder="1 unit"
                  placeholderTextColor={colors.secondary}
                  value={requestQuantity}
                  onChangeText={setRequestQuantity}
                />
              </View>

              <View style={styles.modalButtons}>
                 <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.border }]} onPress={() => setRequestModalVisible(false)}>
                    <Text style={[styles.modalBtnText, { color: colors.text }]}>CLOSE</Text>
                 </TouchableOpacity>
                 <View style={{ flex: 1 }}>
                    <TacticalButton
                      title="SEND"
                      onPress={handleResourceRequest}
                      loading={loadingSOS}
                      colors={[colors.primary, '#005bb5']}
                      style={{ height: '100%' }}
                    />
                 </View>
              </View>
           </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  filterContainer: { position: 'absolute', top: 50, left: 0, right: 0, height: 60 },
  filterScroll: { paddingHorizontal: 15, gap: 10, alignItems: 'center' },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 40, borderRadius: 12, borderWidth: 1, elevation: 3 },
  filterLabel: { fontSize: 12, fontWeight: '800', marginLeft: 8 },
  smallFilterChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  collabFab: { position: 'absolute', top: 120, right: 20, width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', borderWidth: 1, elevation: 5 },
  targetBanner: { position: 'absolute', top: 180, left: 20, right: 20, paddingHorizontal: 20, height: 50, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 5 },
  targetText: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  sosButton: { position: 'absolute', bottom: 40, right: 20, width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', elevation: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25, paddingBottom: 40, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  modalHeader: { alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 1, textAlign: 'center' },
  modalSub: { fontSize: 12, fontWeight: '600', marginTop: 5, textAlign: 'center', lineHeight: 18 },
  detailsInput: { height: 80, borderRadius: 12, padding: 15, fontSize: 14, fontWeight: '600', borderWidth: 1, textAlignVertical: 'top' },
  reqInputGroup: { marginBottom: 15 },
  reqLabel: { fontSize: 10, fontWeight: '900', marginBottom: 8, letterSpacing: 1 },
  smallInput: { height: 50, borderRadius: 10, paddingHorizontal: 15, fontSize: 14, fontWeight: '600', borderWidth: 1 },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalBtn: { flex: 1, height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  modalBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' }
});
