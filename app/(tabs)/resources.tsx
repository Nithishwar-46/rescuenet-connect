import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, TextInput, Modal, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { useToast } from '@/lib/toast-provider';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

type ResourceCategory = 'Medical' | 'Fuel' | 'Vehicle' | 'Food' | 'Water' | 'Power';

interface Resource {
  id: string;
  name: string;
  category: ResourceCategory;
  quantity: number;
  unit: string;
  status: 'Available' | 'Low' | 'Critical';
  last_updated_by: string;
  updated_at: string;
}

export default function ResourcesScreen() {
  const { colors } = useTheme();
  const { userId, role } = useAuth();
  const { showToast } = useToast();
  
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingResource, setEditingResource] = useState<Partial<Resource> | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<ResourceCategory | 'All'>('All');

  const categories: ResourceCategory[] = ['Medical', 'Fuel', 'Vehicle', 'Food', 'Water', 'Power'];

  const fetchResources = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('resources').select('*').order('name');
    if (error) {
      // If table doesn't exist, we'll use mock data for demonstration
      if (error.code === '42P01') {
        setResources(getMockResources());
      } else {
        showToast({ message: error.message, type: 'CRITICAL' });
      }
    } else {
      setResources(data as Resource[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchResources();

    const subscription = supabase.channel('public:resources')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resources' }, () => {
        fetchResources();
      }).subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

  const getMockResources = (): Resource[] => [
    { id: '1', name: 'Trauma Kits', category: 'Medical', quantity: 45, unit: 'units', status: 'Available', last_updated_by: 'Admin', updated_at: new Date().toISOString() },
    { id: '2', name: 'Diesel Fuel', category: 'Fuel', quantity: 120, unit: 'liters', status: 'Low', last_updated_by: 'Admin', updated_at: new Date().toISOString() },
    { id: '3', name: 'Ambulance Unit 04', category: 'Vehicle', quantity: 1, unit: 'unit', status: 'Available', last_updated_by: 'Admin', updated_at: new Date().toISOString() },
    { id: '4', name: 'Emergency Rations', category: 'Food', quantity: 500, unit: 'packs', status: 'Available', last_updated_by: 'Admin', updated_at: new Date().toISOString() },
    { id: '5', name: 'Potable Water', category: 'Water', quantity: 50, unit: 'cans', status: 'Critical', last_updated_by: 'Admin', updated_at: new Date().toISOString() },
  ];

  const handleUpdate = async () => {
    if (!editingResource?.name || editingResource.quantity === undefined) return;

    if (editingResource.id) {
       // Update existing
       const { error } = await supabase.from('resources').update({
         ...editingResource,
         last_updated_by: userId,
         updated_at: new Date().toISOString()
       }).eq('id', editingResource.id);
       
       if (error) showToast({ message: error.message, type: 'CRITICAL' });
       else showToast({ message: "Asset inventory updated.", type: 'SUCCESS' });
    } else {
       // Insert new
       const { error } = await supabase.from('resources').insert([{
         ...editingResource,
         last_updated_by: userId,
         updated_at: new Date().toISOString()
       }]);
       
       if (error) showToast({ message: error.message, type: 'CRITICAL' });
       else showToast({ message: "New asset registered.", type: 'SUCCESS' });
    }
    
    setModalVisible(false);
    setEditingResource(null);
    fetchResources();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Critical': return '#ff4d4d';
      case 'Low': return '#ff9f43';
      default: return '#28c76f';
    }
  };

  const filteredResources = categoryFilter === 'All' 
    ? resources 
    : resources.filter(r => r.category === categoryFilter);

  const renderItem = ({ item }: { item: Resource }) => (
    <Animated.View layout={Layout.springify()} entering={FadeInDown} style={[styles.resourceCard, { backgroundColor: colors.surface, borderLeftColor: getStatusColor(item.status) }]}>
      <View style={styles.resourceHeader}>
        <View>
          <Text style={[styles.resourceName, { color: colors.text }]}>{item.name}</Text>
          <View style={[styles.categoryBadge, { backgroundColor: colors.background }]}>
             <Text style={[styles.categoryText, { color: colors.secondary }]}>{item.category}</Text>
          </View>
        </View>
        <View style={styles.quantityContainer}>
          <Text style={[styles.quantityText, { color: getStatusColor(item.status) }]}>{item.quantity}</Text>
          <Text style={[styles.unitText, { color: colors.secondary }]}>{item.unit}</Text>
        </View>
      </View>
      
      <View style={styles.resourceFooter}>
        <Text style={[styles.updatedText, { color: colors.secondary }]}>Updated by {item.last_updated_by.substring(0, 8)}</Text>
        <TouchableOpacity 
          style={[styles.editButton, { borderColor: colors.border }]} 
          onPress={() => { setEditingResource(item); setModalVisible(true); }}
        >
          <Ionicons name="create-outline" size={16} color={colors.primary} />
          <Text style={[styles.editButtonText, { color: colors.primary }]}>LOG UPDATE</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Strategic Inventory</Text>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={() => { setEditingResource({ category: 'Medical', status: 'Available' }); setModalVisible(true); }}>
           <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBar}>
           <TouchableOpacity 
             style={[styles.filterTab, categoryFilter === 'All' && { backgroundColor: colors.primary }]} 
             onPress={() => setCategoryFilter('All')}
           >
              <Text style={[styles.filterTabText, categoryFilter === 'All' && { color: '#fff' }]}>ALL ASSETS</Text>
           </TouchableOpacity>
           {categories.map(cat => (
             <TouchableOpacity 
               key={cat}
               style={[styles.filterTab, categoryFilter === cat && { backgroundColor: colors.primary }]} 
               onPress={() => setCategoryFilter(cat)}
             >
                <Text style={[styles.filterTabText, categoryFilter === cat && { color: '#fff' }]}>{cat.toUpperCase()}</Text>
             </TouchableOpacity>
           ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      ) : (
        <FlatList
          data={filteredResources}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
               <Ionicons name="cube-outline" size={64} color={colors.border} />
               <Text style={[styles.emptyText, { color: colors.secondary }]}>No priority assets identified.</Text>
            </View>
          }
        />
      )}

      {/* Resource Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
           <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>MISSION DATA UPDATE</Text>
              
              <Text style={[styles.label, { color: colors.secondary }]}>ASSET DESIGNATION</Text>
              <TextInput 
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={editingResource?.name}
                onChangeText={text => setEditingResource(prev => ({ ...prev, name: text }))}
                placeholder="Resource Name"
                placeholderTextColor={colors.secondary}
              />

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={[styles.label, { color: colors.secondary }]}>QUANTITY</Text>
                  <TextInput 
                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                    value={editingResource?.quantity?.toString()}
                    onChangeText={text => setEditingResource(prev => ({ ...prev, quantity: parseInt(text) || 0 }))}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.secondary }]}>UNIT</Text>
                  <TextInput 
                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                    value={editingResource?.unit}
                    onChangeText={text => setEditingResource(prev => ({ ...prev, unit: text }))}
                  />
                </View>
              </View>

              <Text style={[styles.label, { color: colors.secondary, marginTop: 15 }]}>SITUATIONAL STATUS</Text>
              <View style={styles.statusGrid}>
                 {['Available', 'Low', 'Critical'].map(s => (
                   <TouchableOpacity 
                     key={s}
                     style={[styles.statusOption, editingResource?.status === s && { backgroundColor: getStatusColor(s), borderColor: getStatusColor(s) }]}
                     onPress={() => setEditingResource(prev => ({ ...prev, status: s as any }))}
                   >
                      <Text style={[styles.statusOptionText, editingResource?.status === s && { color: '#fff' }]}>{s.toUpperCase()}</Text>
                   </TouchableOpacity>
                 ))}
              </View>

              <View style={styles.modalButtons}>
                 <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                    <Text style={[styles.cancelButtonText, { color: colors.secondary }]}>CANCEL</Text>
                 </TouchableOpacity>
                 <TouchableOpacity style={[styles.saveButtonModal, { backgroundColor: colors.primary }]} onPress={handleUpdate}>
                    <Text style={styles.saveButtonTextModal}>SYNCHRONIZE</Text>
                 </TouchableOpacity>
              </View>
           </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingTop: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  addButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  filterSection: { paddingVertical: 15 },
  filterBar: { paddingHorizontal: 20 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10, backgroundColor: 'rgba(0,0,0,0.05)' },
  filterTabText: { fontSize: 10, fontWeight: '900', color: '#8a8a8a', letterSpacing: 1 },
  listContainer: { padding: 20, paddingBottom: 100 },
  resourceCard: { borderRadius: 16, padding: 20, marginBottom: 15, borderLeftWidth: 6, elevation: 4, shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  resourceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  resourceName: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  categoryText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  quantityContainer: { alignItems: 'flex-end' },
  quantityText: { fontSize: 26, fontWeight: '900' },
  unitText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  resourceFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.1)' },
  updatedText: { fontSize: 10, fontWeight: '700' },
  editButton: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  editButtonText: { fontSize: 10, fontWeight: '900', marginLeft: 4 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 20, fontSize: 15, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 24, padding: 25 },
  modalTitle: { fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 25, letterSpacing: 1 },
  label: { fontSize: 10, fontWeight: '900', marginBottom: 8, letterSpacing: 1 },
  input: { borderRadius: 12, padding: 15, fontSize: 16, borderWidth: 1, marginBottom: 15 },
  row: { flexDirection: 'row' },
  statusGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  statusOption: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', marginRight: 5 },
  statusOptionText: { fontSize: 10, fontWeight: '900' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  cancelButton: { flex: 1, padding: 18, alignItems: 'center' },
  cancelButtonText: { fontWeight: '900' },
  saveButtonModal: { flex: 1, padding: 18, borderRadius: 14, alignItems: 'center' },
  saveButtonTextModal: { color: '#fff', fontWeight: '900', letterSpacing: 1 }
});
