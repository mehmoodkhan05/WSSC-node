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
    morning_shift_start: '09:00',
    morning_shift_end: '17:00',
    night_shift_start: '22:00',
    night_shift_end: '06:00',
  });
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const mapRef = useRef(null);
  const [initialRegion, setInitialRegion] = useState(DEFAULT_REGION);
  const [selectedCoordinate, setSelectedCoordinate] = useState(null);
  const parsedRadius = parseInt(formData.radius_meters, 10);
  const mapRadius = Number.isFinite(parsedRadius) ? Math.max(parsedRadius, 25) : 0;

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      center_lat: '40.7128',
      center_lng: '-74.0060',
      radius_meters: '500',
      morning_shift_start: '09:00',
      morning_shift_end: '17:00',
      night_shift_start: '22:00',
      night_shift_end: '06:00',
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
    } catch (error) {
      console.error('Error loading locations:', error);
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
      {/* Removed the extra View tag here */}

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
    maxHeight: '90%',
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
});
