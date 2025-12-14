import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Textarea } from '../components/ui/Textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/Dialog';
// Removed lucide-react and sonner
import { fetchLocations, createLocation, updateLocation, deleteLocation, NCLocation } from '../lib/locations.js';
import { fetchZones, createZone, updateZone, deleteZone } from '../lib/zones.js';

const DEFAULT_REGION = {
  latitude: 34.7595,
  longitude: 72.3588,
  latitudeDelta: 0.2,
  longitudeDelta: 0.2,
};

export default function Locations() {
  const navigation = useNavigation();
  const [locations, setLocations] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    center_lat: '40.7128',
    center_lng: '-74.0060',
    radius_meters: '500',
    morning_shift_start: '08:00',
    morning_shift_end: '20:00',
    night_shift_start: '20:00',
    night_shift_end: '08:00',
  });
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const mapRef = useRef(null);
  const [initialRegion, setInitialRegion] = useState(DEFAULT_REGION);
  const [selectedCoordinate, setSelectedCoordinate] = useState(null);
  const parsedRadius = parseInt(formData.radius_meters, 10);
  const mapRadius = Number.isFinite(parsedRadius) ? Math.max(parsedRadius, 25) : 0;
  
  // Zone management state
  const [zones, setZones] = useState({}); // { locationId: [zones] }
  const [zonesModalOpen, setZonesModalOpen] = useState(false);
  const [selectedLocationForZones, setSelectedLocationForZones] = useState(null);
  const [zoneFormData, setZoneFormData] = useState({
    name: '',
    description: '',
    center_lat: '40.7128',
    center_lng: '-74.0060',
    radius_meters: '100',
  });
  const [editingZoneId, setEditingZoneId] = useState(null);
  const zoneMapRef = useRef(null);
  const [zoneInitialRegion, setZoneInitialRegion] = useState(DEFAULT_REGION);
  const [zoneSelectedCoordinate, setZoneSelectedCoordinate] = useState(null);
  const zoneParsedRadius = parseInt(zoneFormData.radius_meters, 10);
  const zoneMapRadius = Number.isFinite(zoneParsedRadius) ? Math.max(zoneParsedRadius, 25) : 0;

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      center_lat: '40.7128',
      center_lng: '-74.0060',
      radius_meters: '500',
      morning_shift_start: '08:00',
      morning_shift_end: '20:00',
      night_shift_start: '20:00',
      night_shift_end: '08:00',
    });
    setEditingId(null);
    setInitialRegion(DEFAULT_REGION);
    setSelectedCoordinate(null);
  };

  useEffect(() => {
    loadLocations();
  }, []);

useEffect(() => {
  if (!isOpen || editingId) {
    return;
  }

  let cancelled = false;

  const focusOnCurrentLocation = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted' || cancelled) {
        return;
      }

      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (cancelled) {
        return;
      }

      const coordinate = {
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
      };

      setSelectedCoordinate(coordinate);
      setInitialRegion({
        ...coordinate,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
      setFormData((prev) => ({
        ...prev,
        center_lat: coordinate.latitude.toFixed(6),
        center_lng: coordinate.longitude.toFixed(6),
      }));

      requestAnimationFrame(() => {
        mapRef.current?.animateToRegion(
          {
            ...coordinate,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          },
          200,
        );
      });
    } catch (error) {
      console.warn('Failed to fetch current location for map picker:', error);
    }
  };

  focusOnCurrentLocation();

  return () => {
    cancelled = true;
  };
}, [isOpen, editingId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const lat = parseFloat(formData.center_lat);
    const lng = parseFloat(formData.center_lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const region = {
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
      setInitialRegion(region);
      setSelectedCoordinate({ latitude: lat, longitude: lng });
      requestAnimationFrame(() => {
        mapRef.current?.animateToRegion(region, 200);
      });
    } else {
      setInitialRegion(DEFAULT_REGION);
      setSelectedCoordinate(null);
      requestAnimationFrame(() => {
        mapRef.current?.animateToRegion(DEFAULT_REGION, 200);
      });
    }
  }, [isOpen, formData.center_lat, formData.center_lng]);

  const loadLocations = async () => {
    try {
      const data = await fetchLocations();
      setLocations(data);
      // Load zones for all locations
      const zonesData = {};
      for (const location of data) {
        try {
          const locationZones = await fetchZones(location.id);
          zonesData[location.id] = locationZones;
        } catch (error) {
          console.error(`Error loading zones for location ${location.id}:`, error);
          zonesData[location.id] = [];
        }
      }
      setZones(zonesData);
    } catch (error) {
      console.error('Error loading locations:', error);
    }
  };
  
  const loadZonesForLocation = async (locationId) => {
    try {
      const locationZones = await fetchZones(locationId);
      setZones(prev => ({ ...prev, [locationId]: locationZones }));
      return locationZones;
    } catch (error) {
      console.error('Error loading zones:', error);
      throw error;
    }
  };

  const handleSubmit = async () => { // Removed e: React.FormEvent and e.preventDefault()
    try {
      const locationData = {
        ...formData,
        description: formData.description || undefined,
        center_lat: parseFloat(formData.center_lat),
        center_lng: parseFloat(formData.center_lng),
        radius_meters: parseInt(formData.radius_meters),
      };

      if (editingId) {
        await updateLocation(editingId, locationData);
        Alert.alert('Success', 'Location updated successfully!');
      } else {
        await createLocation(locationData);
        Alert.alert('Success', 'Location added successfully!');
      }

      await loadLocations();
      setIsOpen(false);
    } catch (error) {
      console.error('Error saving location:', error);
      const errorMessage = error.message && error.message.includes('Location not found')
        ? 'Location not found. It may have been deleted.'
        : 'Failed to save location. Please check your input and try again.';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleEdit = (location) => {
    setFormData({
      name: location.name || '',
      code: location.code || '',
      description: location.description || '',
      center_lat: location.center_lat ? location.center_lat.toString() : '40.7128',
      center_lng: location.center_lng ? location.center_lng.toString() : '-74.0060',
      radius_meters: location.radius_meters ? location.radius_meters.toString() : '500',
      morning_shift_start: location.morning_shift_start || '09:00',
      morning_shift_end: location.morning_shift_end || '17:00',
      night_shift_start: location.night_shift_start || '22:00',
      night_shift_end: location.night_shift_end || '06:00',
    });
    setEditingId(location.id);
    setIsOpen(true);
  };

  const handleDelete = async (id) => {
    Alert.alert( // Replaced confirm
      'Delete Location',
      'Are you sure you want to delete this location?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLocation(id);
              await loadLocations();
            } catch (error) {
              console.error('Error deleting location:', error);
              const errorMessage = error.message && error.message.includes('Object not found')
                ? 'Location not found. It may have already been deleted.'
                : 'Failed to delete location.';
              Alert.alert('Error', errorMessage);
            }
          },
        },
      ]
    );
  };

  const applyCoordinateToForm = (coordinate) => {
    setFormData((prev) => ({
      ...prev,
      center_lat: coordinate.latitude.toFixed(6),
      center_lng: coordinate.longitude.toFixed(6),
    }));
  };

  const handleMapPress = (event) => {
    const coordinate = event.nativeEvent.coordinate;
    setSelectedCoordinate(coordinate);
    applyCoordinateToForm(coordinate);
    mapRef.current?.animateToRegion(
      {
        ...coordinate,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      200,
    );
  };

  const handleMarkerDragEnd = (event) => {
    const coordinate = event.nativeEvent.coordinate;
    setSelectedCoordinate(coordinate);
    applyCoordinateToForm(coordinate);
  };

  // Zone management functions
  const fetchCurrentLocationForZone = async () => {
    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to automatically fetch your current location');
        return null;
      }

      // Get current position
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const { latitude, longitude } = position.coords;
      
      // Update form data
      setZoneFormData((prev) => ({
        ...prev,
        center_lat: latitude.toFixed(6),
        center_lng: longitude.toFixed(6),
      }));

      // Update map region
      const region = {
        latitude,
        longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
      setZoneInitialRegion(region);
      setZoneSelectedCoordinate({ latitude, longitude });

      // Animate map to current location
      requestAnimationFrame(() => {
        zoneMapRef.current?.animateToRegion(region, 500);
      });

      return { latitude, longitude };
    } catch (error) {
      console.error('Error fetching current location:', error);
      Alert.alert('Error', 'Failed to fetch current location. Please enter coordinates manually.');
      return null;
    }
  };

  const resetZoneForm = async (shouldFetchLocation = true) => {
    setZoneFormData({
      name: '',
      description: '',
      center_lat: '40.7128', // Temporary default, will be updated by fetchCurrentLocationForZone
      center_lng: '-74.0060', // Temporary default, will be updated by fetchCurrentLocationForZone
      radius_meters: '100',
    });
    setEditingZoneId(null);
    
    // Fetch current location automatically
    if (shouldFetchLocation) {
      const location = await fetchCurrentLocationForZone();
      // If location fetch failed, fallback to location's center or default
      if (!location && selectedLocationForZones) {
        const region = {
          latitude: selectedLocationForZones.center_lat || 40.7128,
          longitude: selectedLocationForZones.center_lng || -74.0060,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        };
        setZoneFormData((prev) => ({
          ...prev,
          center_lat: region.latitude.toString(),
          center_lng: region.longitude.toString(),
        }));
        setZoneInitialRegion(region);
        setZoneSelectedCoordinate({ latitude: region.latitude, longitude: region.longitude });
      }
    } else if (selectedLocationForZones) {
      // Fallback to location's center if not fetching current location
      const region = {
        latitude: selectedLocationForZones.center_lat || 40.7128,
        longitude: selectedLocationForZones.center_lng || -74.0060,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
      setZoneFormData((prev) => ({
        ...prev,
        center_lat: region.latitude.toString(),
        center_lng: region.longitude.toString(),
      }));
      setZoneInitialRegion(region);
      setZoneSelectedCoordinate({ latitude: region.latitude, longitude: region.longitude });
    }
  };

  const handleOpenZonesModal = async (location) => {
    setSelectedLocationForZones(location);
    setZonesModalOpen(true);
    // Fetch current location when opening modal
    await resetZoneForm(true);
  };

  const handleCloseZonesModal = () => {
    setZonesModalOpen(false);
    setSelectedLocationForZones(null);
    resetZoneForm();
  };

  const handleZoneSubmit = async () => {
    if (!selectedLocationForZones) return;
    
    // Validate required fields
    if (!zoneFormData.name || !zoneFormData.center_lat || !zoneFormData.center_lng || !zoneFormData.radius_meters) {
      Alert.alert('Error', 'Please fill in all required fields (Name, Latitude, Longitude, Radius)');
      return;
    }
    
    try {
      const zoneData = {
        name: zoneFormData.name.trim(),
        location_id: selectedLocationForZones.id,
        description: (zoneFormData.description || '').trim(),
        center_lat: parseFloat(zoneFormData.center_lat),
        center_lng: parseFloat(zoneFormData.center_lng),
        radius_meters: parseInt(zoneFormData.radius_meters, 10),
      };

      // Validate parsed values
      if (isNaN(zoneData.center_lat) || isNaN(zoneData.center_lng) || isNaN(zoneData.radius_meters)) {
        Alert.alert('Error', 'Invalid coordinates or radius. Please enter valid numbers.');
        return;
      }

      if (zoneData.radius_meters <= 0) {
        Alert.alert('Error', 'Radius must be greater than 0');
        return;
      }

      console.log('Creating zone with data:', zoneData);

      if (editingZoneId) {
        await updateZone(editingZoneId, zoneData);
        Alert.alert('Success', 'Zone updated successfully!');
      } else {
        const result = await createZone(zoneData);
        console.log('Zone creation result:', result);
        Alert.alert('Success', 'Zone added successfully!');
      }

      // Reload zones for this location
      await loadZonesForLocation(selectedLocationForZones.id);
      resetZoneForm();
    } catch (error) {
      console.error('Error saving zone:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      const errorMessage = error.response?.data?.error || error.message || 'Failed to save zone';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleZoneEdit = (zone) => {
    setZoneFormData({
      name: zone.name || '',
      description: zone.description || '',
      center_lat: zone.center_lat ? zone.center_lat.toString() : '40.7128',
      center_lng: zone.center_lng ? zone.center_lng.toString() : '-74.0060',
      radius_meters: zone.radius_meters ? zone.radius_meters.toString() : '100',
    });
    setEditingZoneId(zone.id);
    
    // Use zone's existing coordinates for the map
    const region = {
      latitude: zone.center_lat || 40.7128,
      longitude: zone.center_lng || -74.0060,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
    setZoneInitialRegion(region);
    setZoneSelectedCoordinate({ latitude: region.latitude, longitude: region.longitude });
    
    // Animate map to zone's location
    requestAnimationFrame(() => {
      zoneMapRef.current?.animateToRegion(region, 500);
    });
  };

  const handleZoneDelete = async (zoneId) => {
    Alert.alert(
      'Delete Zone',
      'Are you sure you want to delete this zone?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteZone(zoneId);
              if (selectedLocationForZones) {
                await loadZonesForLocation(selectedLocationForZones.id);
              }
              Alert.alert('Success', 'Zone deleted successfully');
            } catch (error) {
              console.error('Error deleting zone:', error);
              Alert.alert('Error', error.message || 'Failed to delete zone');
            }
          },
        },
      ]
    );
  };

  const applyZoneCoordinateToForm = (coordinate) => {
    setZoneFormData((prev) => ({
      ...prev,
      center_lat: coordinate.latitude.toFixed(6),
      center_lng: coordinate.longitude.toFixed(6),
    }));
  };

  const handleZoneMapPress = (event) => {
    const coordinate = event.nativeEvent.coordinate;
    setZoneSelectedCoordinate(coordinate);
    applyZoneCoordinateToForm(coordinate);
    zoneMapRef.current?.animateToRegion(
      {
        ...coordinate,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      200,
    );
  };

  const handleZoneMarkerDragEnd = (event) => {
    const coordinate = event.nativeEvent.coordinate;
    setZoneSelectedCoordinate(coordinate);
    applyZoneCoordinateToForm(coordinate);
  };

  return (
    <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>NC Locations</Text>
          <Text style={styles.subtitle}>Manage neighborhood council areas with geofencing</Text>
        </View>
      <Button style={styles.addLocationButton} onPress={() => {
        resetForm();
        setIsOpen(true);
      }}>
        <Text style={styles.addLocationButtonText}>Add Location</Text>
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            resetForm();
          }
        }}>
          <DialogContent style={styles.dialogContent}>
            <ScrollView
              style={styles.formScroll}
              contentContainerStyle={styles.formScrollContent}
              showsVerticalScrollIndicator
              bounces
            >
              <View style={styles.form}>
              <View style={styles.formRow}>
                <View style={styles.formField}>
                  <Label style={styles.label}>Location Name *</Label>
                  <Input
                    style={styles.input}
                    value={formData.name}
                    onChangeText={(text) => setFormData({ ...formData, name: text })}
                    placeholder="NC-01 Downtown"
                  />
                </View>
                <View style={[styles.formField, styles.formFieldLast]}>
                  <Label style={styles.label}>Location Code *</Label>
                  <Input
                    style={styles.input}
                    value={formData.code}
                    onChangeText={(text) => setFormData({ ...formData, code: text })}
                    placeholder="NC-01"
                  />
                </View>
              </View>

              {/* <View style={styles.formField}>
                <Label style={styles.label}>Description</Label>
                <Textarea
                  style={styles.textarea}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.nativeEvent.text })}
                  placeholder="Downtown business district"
                  // rows={2} // rows prop is not directly supported in React Native TextInput, will be handled by height in style
                />
              </View> */}

              <View style={styles.shiftSection}>
                <View>
                  <Label style={styles.shiftTitle}>Morning Shift</Label>
                  <View style={styles.formRow}>
                    <View style={styles.formField}>
                      <Label style={styles.label}>Start Time</Label>
                      <Input style={styles.input} value={formData.morning_shift_start} onChangeText={(text) => setFormData({ ...formData, morning_shift_start: text })} />
                    </View>
                    <View style={[styles.formField, styles.formFieldLast]}>
                      <Label style={styles.label}>End Time</Label>
                      <Input style={styles.input} value={formData.morning_shift_end} onChangeText={(text) => setFormData({ ...formData, morning_shift_end: text })} />
                    </View>
                  </View>
                </View>

                <View>
                  <Label style={styles.shiftTitle}>Night Shift</Label>
                  <View style={styles.formRow}>
                    <View style={styles.formField}>
                      <Label style={styles.label}>Start Time</Label>
                      <Input style={styles.input} value={formData.night_shift_start} onChangeText={(text) => setFormData({ ...formData, night_shift_start: text })} />
                    </View>
                    <View style={[styles.formField, styles.formFieldLast]}>
                      <Label style={styles.label}>End Time</Label>
                      <Input style={styles.input} value={formData.night_shift_end} onChangeText={(text) => setFormData({ ...formData, night_shift_end: text })} />
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formField}>
                  <Label style={styles.label}>Latitude *</Label>
                  <Input
                    style={styles.input}
                    value={formData.center_lat}
                    onChangeText={(text) => setFormData({ ...formData, center_lat: text })}
                    placeholder="40.7128"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.formField}>
                  <Label style={styles.label}>Longitude *</Label>
                  <Input
                    style={styles.input}
                    value={formData.center_lng}
                    onChangeText={(text) => setFormData({ ...formData, center_lng: text })}
                    placeholder="-74.0060"
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.formField, styles.formFieldLast]}>
                  <Label style={styles.label}>Radius (meters) *</Label>
                  <Input
                    style={styles.input}
                    value={formData.radius_meters}
                    onChangeText={(text) => setFormData({ ...formData, radius_meters: text })}
                    placeholder="500"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.mapPickerSection}>
                <Text style={styles.mapSectionTitle}>Pick location on map</Text>
                <Text style={styles.mapSectionSubtitle}>
                  Tap anywhere to drop a marker or drag the existing pin. The latitude and longitude
                  fields update automatically whenever you move the pin.
                </Text>
                <View style={styles.mapWrapper}>
                  <MapView
                    key={`location-map-${editingId ?? 'new'}`}
                    ref={mapRef}
                    style={styles.map}
                    initialRegion={initialRegion}
                    onPress={handleMapPress}
                    showsUserLocation
                  >
                    {selectedCoordinate && (
                      <>
                        <Marker
                          coordinate={selectedCoordinate}
                          draggable
                          onDragEnd={handleMarkerDragEnd}
                        />
                        {mapRadius > 0 && (
                          <Circle
                            center={selectedCoordinate}
                            radius={mapRadius}
                            strokeColor="rgba(37, 99, 235, 0.6)"
                            fillColor="rgba(59, 130, 246, 0.15)"
                          />
                        )}
                      </>
                    )}
                  </MapView>
                </View>
                <View style={styles.mapActions}>
                  <Text style={styles.mapSelectionText}>
                    {selectedCoordinate
                      ? `${selectedCoordinate.latitude.toFixed(5)}, ${selectedCoordinate.longitude.toFixed(5)}`
                      : 'Tap the map to place a marker.'}
                  </Text>
                </View>
              </View>

              <View style={styles.formActions}>
                <Button variant="outline" onPress={() => setIsOpen(false)}>
                  <Text>Cancel</Text>
                </Button>
                <Button onPress={handleSubmit}>
                  <Text>{editingId ? 'Update' : 'Save'} Location</Text>
                </Button>
              </View>
              </View>
            </ScrollView>
          </DialogContent>
        </Dialog>

      {/* Zone Management Modal */}
      <Dialog open={zonesModalOpen} onOpenChange={(open) => {
          if (!open) {
            handleCloseZonesModal();
          }
        }}>
        <DialogContent style={styles.dialogContent}>
          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formScrollContent}
            showsVerticalScrollIndicator
            bounces
          >
            <View style={styles.form}>
              <Text style={styles.modalTitle}>
                Manage Zones - {selectedLocationForZones?.name || ''}
              </Text>
              
              {/* Zones List */}
              <View style={styles.zonesListSection}>
                <Text style={styles.sectionTitle}>Zones ({zones[selectedLocationForZones?.id]?.length || 0})</Text>
                {selectedLocationForZones && zones[selectedLocationForZones.id]?.length === 0 ? (
                  <Text style={styles.emptyZonesText}>No zones created yet. Add your first zone below.</Text>
                ) : (
                  selectedLocationForZones && zones[selectedLocationForZones.id]?.map((zone) => (
                    <Card key={zone.id} style={styles.zoneCard}>
                      <CardContent style={styles.zoneCardContent}>
                        <View style={styles.zoneInfo}>
                          <Text style={styles.zoneName}>{zone.name}</Text>
                          {zone.description && (
                            <Text style={styles.zoneDescription}>{zone.description}</Text>
                          )}
                          <View style={styles.zoneDetails}>
                            <Text style={styles.zoneDetailText}>
                              {zone.center_lat.toFixed(4)}, {zone.center_lng.toFixed(4)}
                            </Text>
                            <Text style={styles.zoneDetailText}>Radius: {zone.radius_meters}m</Text>
                          </View>
                        </View>
                        <View style={styles.zoneActions}>
                          <Button
                            variant="outline"
                            size="sm"
                            onPress={() => handleZoneEdit(zone)}
                          >
                            <Text style={styles.editButtonText}>Edit</Text>
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onPress={() => handleZoneDelete(zone.id)}
                          >
                            <Text style={styles.deleteButtonText}>Delete</Text>
                          </Button>
                        </View>
                      </CardContent>
                    </Card>
                  ))
                )}
              </View>

              {/* Add/Edit Zone Form */}
              <View style={styles.zoneFormSection}>
                <Text style={styles.sectionTitle}>
                  {editingZoneId ? 'Edit Zone' : 'Add New Zone'}
                </Text>
                
                <View style={styles.formField}>
                  <Label style={styles.label}>Zone Name *</Label>
                  <Input
                    style={styles.input}
                    value={zoneFormData.name}
                    onChangeText={(text) => setZoneFormData({ ...zoneFormData, name: text })}
                    placeholder="Zone A, North Area, etc."
                  />
                </View>

                <View style={styles.formField}>
                  <Label style={styles.label}>Description</Label>
                  <Input
                    style={styles.input}
                    value={zoneFormData.description}
                    onChangeText={(text) => setZoneFormData({ ...zoneFormData, description: text })}
                    placeholder="Optional description"
                  />
                </View>

                <View style={styles.formRow}>
                  <View style={styles.formField}>
                    <Label style={styles.label}>Latitude *</Label>
                    <Input
                      style={styles.input}
                      value={zoneFormData.center_lat}
                      onChangeText={(text) => setZoneFormData({ ...zoneFormData, center_lat: text })}
                      placeholder="40.7128"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.formField}>
                    <Label style={styles.label}>Longitude *</Label>
                    <Input
                      style={styles.input}
                      value={zoneFormData.center_lng}
                      onChangeText={(text) => setZoneFormData({ ...zoneFormData, center_lng: text })}
                      placeholder="-74.0060"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.formField, styles.formFieldLast]}>
                    <Label style={styles.label}>Radius (m) *</Label>
                    <Input
                      style={styles.input}
                      value={zoneFormData.radius_meters}
                      onChangeText={(text) => setZoneFormData({ ...zoneFormData, radius_meters: text })}
                      placeholder="100"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.formField}>
                  <Button
                    variant="outline"
                    onPress={fetchCurrentLocationForZone}
                    style={styles.currentLocationButton}
                  >
                    <Text style={styles.currentLocationButtonText}>📍 Use Current Location</Text>
                  </Button>
                </View>

                <View style={styles.mapPickerSection}>
                  <Text style={styles.mapSectionTitle}>Pick zone location on map</Text>
                  <Text style={styles.mapSectionSubtitle}>
                    Tap anywhere to drop a marker or drag the existing pin. The latitude and longitude
                    fields update automatically whenever you move the pin.
                  </Text>
                  <View style={styles.mapWrapper}>
                    <MapView
                      key={`zone-map-${editingZoneId ?? 'new'}-${selectedLocationForZones?.id}`}
                      ref={zoneMapRef}
                      style={styles.map}
                      initialRegion={zoneInitialRegion}
                      onPress={handleZoneMapPress}
                      showsUserLocation
                    >
                      {zoneSelectedCoordinate && (
                        <>
                          <Marker
                            coordinate={zoneSelectedCoordinate}
                            draggable
                            onDragEnd={handleZoneMarkerDragEnd}
                          />
                          {zoneMapRadius > 0 && (
                            <Circle
                              center={zoneSelectedCoordinate}
                              radius={zoneMapRadius}
                              strokeColor="rgba(34, 197, 94, 0.6)"
                              fillColor="rgba(34, 197, 94, 0.15)"
                            />
                          )}
                        </>
                      )}
                    </MapView>
                  </View>
                  <View style={styles.mapActions}>
                    <Text style={styles.mapSelectionText}>
                      {zoneSelectedCoordinate
                        ? `${zoneSelectedCoordinate.latitude.toFixed(5)}, ${zoneSelectedCoordinate.longitude.toFixed(5)}`
                        : 'Tap the map to place a marker.'}
                    </Text>
                  </View>
                </View>

                <View style={styles.zoneFormActions}>
                  <TouchableOpacity 
                    style={[styles.zoneCloseButton, styles.zoneActionButton, styles.zoneCloseButtonContainer]}
                    onPress={handleCloseZonesModal}
                  >
                    <Text style={styles.zoneCloseButtonText}>Close</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.zoneFormActionsRight}>
                    {editingZoneId && (
                      <TouchableOpacity 
                        style={[styles.zoneCancelButton, styles.zoneActionButton]}
                        onPress={resetZoneForm}
                      >
                        <Text style={styles.zoneCancelButtonText}>Cancel Edit</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity 
                      style={[
                        styles.zoneAddButton, 
                        styles.zoneActionButton,
                        (!zoneFormData.name || !zoneFormData.center_lat || !zoneFormData.center_lng || !zoneFormData.radius_meters) && styles.zoneButtonDisabled
                      ]}
                      onPress={handleZoneSubmit}
                      disabled={!zoneFormData.name || !zoneFormData.center_lat || !zoneFormData.center_lng || !zoneFormData.radius_meters}
                    >
                      <Text style={styles.zoneAddButtonText}>
                        {editingZoneId ? 'Update' : 'Add'} Zone
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </DialogContent>
      </Dialog>

      {locations.length === 0 ? (
        <Card style={styles.card}>
          <CardContent style={styles.noLocationsCardContent}>
            <Text style={styles.noLocationsText}>No locations added yet</Text>
            </CardContent>
        </Card>
      ) : (
        <View style={styles.locationsGrid}>
          {locations.map((location) => (
            <Card key={location.id} style={styles.locationCard}>
              <CardHeader style={styles.cardHeader}>
                <CardTitle style={styles.locationCardTitle}>
                  {location.name}
                </CardTitle>
                <CardDescription style={styles.cardDescription}>{location.code}</CardDescription>
              </CardHeader>
              <CardContent style={styles.cardContent}>
                {location.description && (
                  <Text style={styles.locationDescription}>{location.description}</Text>
                )}
                <View style={styles.locationDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Coordinates:</Text>
                    <Text style={styles.detailValue}>
                      {location.center_lat.toFixed(4)}, {location.center_lng.toFixed(4)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Radius:</Text>
                    <Text style={styles.detailValue}>{location.radius_meters}m</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Zones:</Text>
                    <Text style={styles.detailValue}>
                      {zones[location.id]?.length || 0} {zones[location.id]?.length === 1 ? 'zone' : 'zones'}
                    </Text>
                  </View>
                  <View style={styles.shiftTimes}>
                    <View style={styles.shiftTimeRow}>
                      <Text style={styles.shiftTimeLabel}>Morning:</Text>
                      <Text style={styles.shiftTimeValue}>{location.morning_shift_start || 'N/A'} - {location.morning_shift_end || 'N/A'}</Text>
                    </View>
                    <View style={styles.shiftTimeRow}>
                      <Text style={styles.shiftTimeLabel}>Night:</Text>
                      <Text style={styles.shiftTimeValue}>{location.night_shift_start || 'N/A'} - {location.night_shift_end || 'N/A'}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <Button
                    variant="outline"
                    size="sm"
                    style={styles.manageZonesButton}
                    onPress={() => handleOpenZonesModal(location)}
                  >
                    <Text style={styles.manageZonesButtonText}>Manage Zones</Text>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    style={styles.editButton}
                    onPress={() => handleEdit(location)}
                  >
                    <Text style={styles.editButtonText}>Edit</Text>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onPress={() => handleDelete(location.id)}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </Button>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      )}

      <Card style={styles.howToUseCard}>
        <CardHeader style={styles.cardHeader}>
          <CardTitle style={styles.cardTitle}>How to use</CardTitle>
        </CardHeader>
        <CardContent style={styles.howToUseContent}>
          <Text style={styles.howToUseText}>• <Text style={styles.boldText}>Add locations:</Text> Click "Add Location" to create new NC areas with center coordinates and radius</Text>
          <Text style={styles.howToUseText}>• <Text style={styles.boldText}>Geofencing:</Text> Attendance can only be marked when supervisors are within the defined radius</Text>
          <Text style={styles.howToUseText}>• <Text style={styles.boldText}>Edit locations:</Text> Update coordinates, radius, or deactivate areas as needed</Text>
          <Text style={styles.howToUseText}>• <Text style={styles.boldText}>Coordinates:</Text> Use Google Maps to find exact lat/lng coordinates for your areas</Text>
        </CardContent>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
    backgroundColor: '#f8f8f8',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  addLocationButton: {
    width: '100%',
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  addLocationButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  dialogContent: {
    // maxHeight: '90%',
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  formScroll: {
    // maxHeight: '90%',
    flexGrow: 0,
  },
  formScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    flexGrow: 1,
  },
  form: {
    paddingVertical: 0,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 16,
    justifyContent: 'space-between',
  },
  formField: {
    flex: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  formFieldLast: {
    marginRight: 0,
  },
  label: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    fontWeight: '500',
  },
  input: {
    height: 44,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  textarea: {
    height: 100,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  shiftSection: {
    marginBottom: 16,
  },
  shiftTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  mapPickerSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  mapSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  mapSectionSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 18,
  },
  mapWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  map: {
    height: 220,
    width: '100%',
  },
  mapActions: {
    marginTop: 12,
  },
  mapSelectionText: {
    fontSize: 13,
    color: '#444',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 16,
  },
  cardHeader: {
    padding: 16,
    paddingBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  cardContent: {
    padding: 16,
    paddingTop: 8,
  },
  noLocationsCardContent: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noLocationsText: {
    textAlign: 'center',
    color: '#999',
    marginBottom: 16,
  },
  addFirstLocationButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  locationsGrid: {
    flexDirection: 'column', // Changed to column for mobile layout
    gap: 24,
  },
  locationCard: {
    marginBottom: 0, // Override default card margin
  },
  locationCardTitle: {
    // Removed invalid styles for Text component
  },
  locationDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  locationDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: {
    color: '#666',
  },
  detailValue: {
    fontWeight: 'bold',
  },
  shiftTimes: {
    marginTop: 8,
  },
  shiftTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  shiftTimeLabel: {
    color: '#666',
  },
  shiftTimeValue: {
    fontWeight: 'bold',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  editButton: {
    flex: 1,
  },
  editButtonText: {
    color: '#007bff',
    marginLeft: 4,
  },
  deleteButtonText: {
    color: 'white',
  },
  howToUseCard: {
    marginTop: 24,
  },
  howToUseContent: {
    paddingVertical: 16,
  },
  howToUseText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  boldText: {
    fontWeight: 'bold',
  },
  manageZonesButton: {
    flex: 1,
    marginRight: 8,
  },
  manageZonesButtonText: {
    color: '#22c55e',
    marginLeft: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  zonesListSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  emptyZonesText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  zoneCard: {
    marginBottom: 12,
    backgroundColor: '#f9fafb',
  },
  zoneCardContent: {
    padding: 12,
  },
  zoneInfo: {
    marginBottom: 12,
  },
  zoneName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  zoneDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  zoneDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  zoneDetailText: {
    fontSize: 12,
    color: '#666',
  },
  zoneActions: {
    flexDirection: 'row',
    gap: 8,
  },
  zoneFormSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  zoneFormActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginTop: 8,
    width: '100%',
    flexWrap: 'wrap',
    gap: 8,
  },
  zoneFormActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  zoneActionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 90,
    maxWidth: 150,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
    flexGrow: 0,
  },
  zoneCloseButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  zoneCloseButtonContainer: {
    flexShrink: 1,
    flexGrow: 0,
  },
  zoneCloseButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  zoneCancelButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  zoneCancelButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  zoneAddButton: {
    backgroundColor: '#22c55e',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  zoneAddButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  zoneButtonDisabled: {
    backgroundColor: '#d1d5db',
    opacity: 0.6,
  },
  currentLocationButton: {
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  currentLocationButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
