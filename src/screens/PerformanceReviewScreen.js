import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Image,
  RefreshControl,
  TextInput,
  Linking,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuth } from '../contexts/AuthContext';
import { getProfile } from '../lib/auth';
import { fetchStaff, fetchSupervisors, fetchManagers, fetchGeneralManagers } from '../lib/staff';
import { fetchAssignments } from '../lib/assignments';
import { fetchLocations } from '../lib/locations';
import { fetchPerformanceReviews, createPerformanceReview, deletePerformanceReview, uploadPerformancePhotos, generatePerformancePDF, updatePerformanceReviewPDF } from '../lib/performance';
import { PARSE_CLASSES } from '../lib/apiClient';
import { fetchAttendanceReport } from '../lib/attendance';
import SimpleDropdown from '../components/ui/SimpleDropdown';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import {
  ROLE,
  normalizeRole,
  hasManagementPrivileges,
  hasFieldLeadershipPrivileges,
} from '../lib/roles';

const categories = [
  // Sanitation Department
  { value: 'solid-waste-collection', label: 'Solid Waste Collection', department: 'sanitation' },
  { value: 'street-sweeping', label: 'Street Sweeping', department: 'sanitation' },
  { value: 'drain-cleaning', label: 'Drain Cleaning', department: 'sanitation' },
  { value: 'sanitary-inspection', label: 'Sanitary Inspection', department: 'sanitation' },
  
  // Water Supply Department
  { value: 'water-supply-maintenance', label: 'Water Supply Maintenance', department: 'water_supply' },
  { value: 'pipeline-repair', label: 'Pipeline Repair', department: 'water_supply' },
  { value: 'valve-operation', label: 'Valve Operation', department: 'water_supply' },
  { value: 'water-quality-check', label: 'Water Quality Check', department: 'water_supply' },
  { value: 'tubewell-operation', label: 'Tubewell Operation', department: 'water_supply' },
  
  // Commercial Department
  { value: 'billing-collection', label: 'Billing & Collection', department: 'commercial' },
  { value: 'meter-reading', label: 'Meter Reading', department: 'commercial' },
  { value: 'customer-complaint', label: 'Customer Complaint Handling', department: 'commercial' },
  { value: 'connection-inspection', label: 'Connection Inspection', department: 'commercial' },
  
  // Administration Department
  { value: 'office-administration', label: 'Office Administration', department: 'administration' },
  { value: 'security-duty', label: 'Security Duty', department: 'administration' },
  { value: 'vehicle-maintenance', label: 'Vehicle Maintenance', department: 'administration' },
  { value: 'fleet-management', label: 'Fleet Management', department: 'administration' },
  
  // General (cross-department)
  { value: 'equipment-operation', label: 'Equipment Operation', department: 'all' },
  { value: 'field-inspection', label: 'Field Inspection', department: 'all' },
  { value: 'emergency-response', label: 'Emergency Response', department: 'all' },
  { value: 'other', label: 'Other', department: 'all' },
];

const PerformanceReviewScreen = () => {
  const { profile } = useAuth();
  
  // Form states
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [photo1, setPhoto1] = useState(null);
  const [photo2, setPhoto2] = useState(null);
  const [photo3, setPhoto3] = useState(null);
  const [photo4, setPhoto4] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Navigation states
  const [userFolders, setUserFolders] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [dateFolders, setDateFolders] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [reportPhotoUrls, setReportPhotoUrls] = useState({});
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState(null);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reportToDelete, setReportToDelete] = useState(null);
  const [locations, setLocations] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [supervisorsList, setSupervisorsList] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingPdfId, setGeneratingPdfId] = useState(null);

  const currentUserId = currentUser?.user_id ?? currentUser?.id ?? currentUser?.objectId ?? null;
  const currentRole = normalizeRole(currentUser?.role) || ROLE.STAFF;
  const currentUserDepartment = currentUser?.department || null;
  const currentUserDepartments = currentUser?.departments || [];
  const isSupervisorOnly = currentRole === ROLE.SUPERVISOR;
  const isManagerRole = currentRole === ROLE.MANAGER;
  const isGeneralManagerRole = currentRole === ROLE.GENERAL_MANAGER;
  const isCEOOrSuperAdmin = currentRole === ROLE.CEO || currentRole === ROLE.SUPER_ADMIN;
  const hasOrgWideAccess = isCEOOrSuperAdmin; // Only CEO/SuperAdmin sees everything
  const canSubmitReports = currentRole === ROLE.STAFF || currentRole === ROLE.SUPERVISOR;
  const canDeleteReports = hasManagementPrivileges(currentRole);

  useEffect(() => {
    loadInitialData();
  }, []);

useEffect(() => {
  if (currentUser) {
    fetchUserFolders();
  }
}, [currentUser, fetchUserFolders]);

  const loadInitialData = async () => {
    try {
      const userProfile = await getProfile();
      setCurrentUser(userProfile);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const fetchUserFolders = useCallback(async () => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      const [locs, allStaff, supervisors, managers, generalManagers, assignments] = await Promise.all([
        fetchLocations(),
        fetchStaff(),
        fetchSupervisors(),
        fetchManagers(),
        fetchGeneralManagers(),
        fetchAssignments()
      ]);
      
      setLocations(locs || []);
      setStaffList(allStaff || []);
      setSupervisorsList(supervisors || []);

      // Normalize staff objects with department info
      const allStaffNormalized = (allStaff || []).map(s => ({
        user_id: s.user_id || '',
        name: s.name || s.full_name || (s.email ? s.email.split('@')[0] : 'Staff'),
        email: s.email || null,
        department: s.department || null,
        manager_id: s.manager_id || null,
      }));

      // Normalize supervisors with department and manager info
      const supervisorsNormalized = (supervisors || []).map(s => ({
        user_id: s.user_id || '',
        name: s.full_name || s.name || (s.email ? s.email.split('@')[0] : 'Supervisor'),
        email: s.email || null,
        department: s.department || null,
        manager_id: s.manager_id || null,
      }));

      // Fetch performance reviews - always fetch all for proper filtering
      let reviews = [];
      try {
        reviews = await fetchPerformanceReviews();
      } catch (error) {
        console.error('Error fetching reviews:', error);
      }

      // Create maps for user lookup
      const staffMap = new Map(allStaffNormalized.map(s => [s.user_id, s]));
      const supervisorMap = new Map(supervisorsNormalized.map(s => [s.user_id, s]));

      // Build set of staff assigned to each supervisor
      const staffBySupervisor = new Map();
      (assignments || []).forEach(a => {
        if (a.is_active && a.supervisor_id && a.staff_id) {
          if (!staffBySupervisor.has(a.supervisor_id)) {
            staffBySupervisor.set(a.supervisor_id, new Set());
          }
          staffBySupervisor.get(a.supervisor_id).add(a.staff_id);
        }
      });

      // Build set of supervisors assigned to each manager
      const supervisorsByManager = new Map();
      supervisorsNormalized.forEach(s => {
        if (s.manager_id) {
          if (!supervisorsByManager.has(s.manager_id)) {
            supervisorsByManager.set(s.manager_id, new Set());
          }
          supervisorsByManager.get(s.manager_id).add(s.user_id);
        }
      });

      // Determine which user IDs this user can see based on their role
      let visibleUserIds = new Set();

      if (isCEOOrSuperAdmin) {
        // CEO/Super Admin sees ALL folders
        allStaffNormalized.forEach(s => visibleUserIds.add(s.user_id));
        supervisorsNormalized.forEach(s => visibleUserIds.add(s.user_id));
        (managers || []).forEach(m => visibleUserIds.add(m.user_id));
        (generalManagers || []).forEach(gm => visibleUserIds.add(gm.user_id));
      } else if (isGeneralManagerRole) {
        // GM sees all users from their assigned department(s)
        const gmDepts = currentUserDepartments.length > 0 ? currentUserDepartments : (currentUserDepartment ? [currentUserDepartment] : []);
        
        allStaffNormalized.forEach(s => {
          if (s.department && gmDepts.includes(s.department)) {
            visibleUserIds.add(s.user_id);
          }
        });
        supervisorsNormalized.forEach(s => {
          if (s.department && gmDepts.includes(s.department)) {
            visibleUserIds.add(s.user_id);
          }
        });
        (managers || []).forEach(m => {
          if (m.department && gmDepts.includes(m.department)) {
            visibleUserIds.add(m.user_id);
          }
        });
        // GM also sees their own folder
        visibleUserIds.add(currentUserId);
      } else if (isManagerRole) {
        // Manager sees their assigned supervisors and those supervisors' staff
        const mySupervisors = supervisorsByManager.get(currentUserId) || new Set();
        mySupervisors.forEach(supId => {
          visibleUserIds.add(supId); // Add supervisor
          const supStaff = staffBySupervisor.get(supId) || new Set();
          supStaff.forEach(staffId => visibleUserIds.add(staffId)); // Add supervisor's staff
        });
        // Manager also sees their own folder
        visibleUserIds.add(currentUserId);
      } else if (isSupervisorOnly) {
        // Supervisor sees only their assigned staff and their own folder
        const myStaff = staffBySupervisor.get(currentUserId) || new Set();
        myStaff.forEach(staffId => visibleUserIds.add(staffId));
        visibleUserIds.add(currentUserId); // Add self
      } else {
        // Staff sees only their own folder
        visibleUserIds.add(currentUserId);
      }

      // Initialize reportCounts for visible users
      const reportCounts = new Map();

      // Add all visible users to reportCounts
      visibleUserIds.forEach(userId => {
        const staff = staffMap.get(userId);
        const supervisor = supervisorMap.get(userId);
        const manager = (managers || []).find(m => m.user_id === userId);
        const gm = (generalManagers || []).find(g => g.user_id === userId);
        
        let name = 'Unknown';
        let role = 'staff';
        
        if (staff) {
          name = staff.name;
          role = 'staff';
        } else if (supervisor) {
          name = supervisor.name;
          role = 'supervisor';
        } else if (manager) {
          name = manager.full_name || manager.name || manager.email || 'Manager';
          role = 'manager';
        } else if (gm) {
          name = gm.full_name || gm.name || gm.email || 'General Manager';
          role = 'general_manager';
        }
        
        reportCounts.set(userId, { count: 0, role, name, locations: new Set() });
      });

      // Count reports per user (only for visible users)
      reviews.forEach((record) => {
        if (record.staff_id && visibleUserIds.has(record.staff_id)) {
          const existing = reportCounts.get(record.staff_id);
          if (existing) {
            existing.count += 1;
            if (record.location_id) {
              existing.locations.add(record.location_id);
            }
            reportCounts.set(record.staff_id, existing);
          }
        }
      });

      // Convert to UserFolder array
      const folders = Array.from(reportCounts.entries()).map(([user_id, data]) => ({
        user_id,
        name: data.name,
        role: data.role,
        reportCount: data.count,
        locations: Array.from(data.locations)
      }));

      setUserFolders(folders.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    } catch (error) {
      console.error('Error fetching user folders:', error);
      Alert.alert('Error', 'Failed to load user folders');
    } finally {
      setLoading(false);
    }
  }, [currentUser, isSupervisorOnly, isManagerRole, isGeneralManagerRole, isCEOOrSuperAdmin, currentUserId, currentUserDepartment, currentUserDepartments]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserFolders();
    setRefreshing(false);
  };

  const handlePickPhoto = async (photoNumber) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Sorry, we need camera roll permissions to select a photo!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];
        if (photoNumber === 1) setPhoto1(selectedImage.uri);
        else if (photoNumber === 2) setPhoto2(selectedImage.uri);
        else if (photoNumber === 3) setPhoto3(selectedImage.uri);
        else if (photoNumber === 4) setPhoto4(selectedImage.uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image from gallery');
    }
  };

  const handleRemovePhoto = (photoNumber) => {
    if (photoNumber === 1) setPhoto1(null);
    else if (photoNumber === 2) setPhoto2(null);
    else if (photoNumber === 3) setPhoto3(null);
    else if (photoNumber === 4) setPhoto4(null);
  };

  const handleUpload = async () => {
    const photosToUpload = [photo1, photo2, photo3, photo4].filter(Boolean);
    if (photosToUpload.length === 0) {
      Alert.alert('Error', 'Please choose at least one photo to upload');
      return;
    }
    if (!category) {
      Alert.alert('Error', 'Please select a category for the report');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Please provide a description for the report');
      return;
    }
    if (!currentUserId) {
      Alert.alert('Error', 'User profile not loaded');
      return;
    }

    setUploading(true);
    try {
      const staffId = currentUserId;

      // Upload photos
      const { paths } = await uploadPerformancePhotos(photosToUpload, staffId, date);

      // Determine supervisor_id and location_id from attendance if not explicitly selected
      let finalSupervisorId = null;
      let finalLocationId = null;

      try {
        // Query attendance for the selected date to get supervisor and location
        const attendanceRecords = await fetchAttendanceReport({
          dateFrom: date,
          dateTo: date,
          staffId: staffId
        });
        
        if (attendanceRecords && attendanceRecords.length > 0) {
          // Get the most recent record (first one after sorting)
          const record = attendanceRecords[0];
          if (record.supervisor_id) finalSupervisorId = record.supervisor_id;
          if (record.nc_location_id) finalLocationId = record.nc_location_id;
        }
      } catch (e) {
        console.warn('Error fetching attendance for supervisor/location:', e);
      }

      // Create performance review
      const createdReview = await createPerformanceReview({
        staff_id: staffId,
        supervisor_id: finalSupervisorId,
        location_id: finalLocationId,
        date,
        category,
        description: description.trim(),
        photo_path: paths[0] || null,
        photo2_path: paths[1] || null,
        photo3_path: paths[2] || null,
        photo4_path: paths[3] || null,
      });

      // Generate PDF after creation
      try {
        const staffMember = staffList.find(s => s.user_id === staffId);
        const supervisorMember = supervisorsList.find(s => s.user_id === finalSupervisorId);
        const location = locations.find(l => l.id === finalLocationId);

        const pdfPath = await generatePerformancePDF(createdReview.id, {
          staff_name: staffMember?.name || staffMember?.full_name || 'Unknown',
          supervisor_name: supervisorMember?.name || supervisorMember?.full_name || null,
          location_name: location?.name || location?.code || null,
          date,
          category,
          description: description.trim(),
          photo_path: paths[0] || null,
          photo2_path: paths[1] || null,
          photo3_path: paths[2] || null,
          photo4_path: paths[3] || null,
        });
        if (pdfPath) {
          try {
            await updatePerformanceReviewPDF(createdReview.id, pdfPath);
          } catch (updateError) {
            console.warn('Failed to update PDF path after creation:', updateError);
          }
        }
      } catch (pdfError) {
        console.error('Error generating PDF after creation:', pdfError);
        // Don't fail the whole operation if PDF generation fails
      }

      Alert.alert('Success', 'Performance report submitted successfully');

      // Reset form
      setPhoto1(null);
      setPhoto2(null);
      setPhoto3(null);
      setPhoto4(null);
      setCategory('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);

      // Refresh folders
      await fetchUserFolders();
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', error.message || 'Failed to submit performance report');
    } finally {
      setUploading(false);
    }
  };

  const handleUserClick = async (user) => {
    setSelectedUser(user);
    setSelectedDate(null);
    setLoading(true);

    try {
      // Fetch performance reviews for this user
      let reviews = [];
      if (user.role === 'supervisor') {
        // Supervisors might have submitted reports as 'staff_id' or been assigned as 'supervisor_id'
        const reviewsAsStaff = await fetchPerformanceReviews({ staffId: user.user_id });
        const reviewsAsSupervisor = await fetchPerformanceReviews({ supervisorId: user.user_id });
        reviews = [...reviewsAsStaff, ...reviewsAsSupervisor];
      } else {
        reviews = await fetchPerformanceReviews({ staffId: user.user_id });
      }

      // Group by date
      const dateGroups = new Map();
      reviews.forEach((record) => {
        const recordDate = record.date || '';
        if (!dateGroups.has(recordDate)) {
          dateGroups.set(recordDate, []);
        }
        dateGroups.get(recordDate).push(record);
      });

      // Convert to DateFolder array
      const folders = Array.from(dateGroups.entries()).map(([date, reports]) => ({
        date,
        formattedDate: new Date(date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        reports
      }));

      setDateFolders(folders);
    } catch (error) {
      console.error('Error loading date folders:', error);
      Alert.alert('Error', 'Failed to load date folders');
    } finally {
      setLoading(false);
    }
  };

  const handleDateClick = async (dateFolder) => {
    setSelectedDate(dateFolder);

    // Load photo URLs for all photos in the reports
    const urls = {};
    for (const report of dateFolder.reports) {
      const photoPaths = [report.photo_path, report.photo2_path, report.photo3_path, report.photo4_path].filter(Boolean);
      urls[report.id] = photoPaths; // Parse files are publicly accessible, use URLs directly
    }
    setReportPhotoUrls(urls);
  };

  const handleBackToUsers = () => {
    setSelectedUser(null);
    setSelectedDate(null);
    setDateFolders([]);
  };

  const handleBackToDates = () => {
    setSelectedDate(null);
  };

  const handlePdfAction = async (report, action) => {
    try {
      setGeneratingPdf(true);
      setGeneratingPdfId(report.id);
      
      // Generate PDF with report data
      const pdfUri = await generatePerformancePDF(report.id, {
        staff_name: report.staff_name,
        supervisor_name: report.supervisor_name,
        location_name: report.location_name,
        date: report.date,
        category: report.category,
        description: report.description,
        photo_path: report.photo_path,
        photo2_path: report.photo2_path,
        photo3_path: report.photo3_path,
        photo4_path: report.photo4_path,
      });

      // For web, generatePerformancePDF opens print dialog directly
      if (Platform.OS === 'web') {
        if (action === 'regenerate') {
          Alert.alert('Success', 'PDF opened in new window for printing/saving');
        }
        return;
      }

      // For mobile platforms
      if (!pdfUri) {
        Alert.alert('Error', 'Failed to generate PDF');
        return;
      }

      // Update local state with new PDF path
      if (selectedDate) {
        setSelectedDate(prev => prev ? {
          ...prev,
          reports: prev.reports.map(r => r.id === report.id ? { ...r, pdf_path: pdfUri } : r)
        } : null);
      }

      // Try to update the PDF path in backend (optional, may fail)
      try {
        await updatePerformanceReviewPDF(report.id, pdfUri);
      } catch (updateError) {
        console.warn('Failed to update PDF path in backend:', updateError);
      }

      if (action === 'regenerate') {
        Alert.alert('Success', 'PDF regenerated successfully');
        // Share the regenerated PDF
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(pdfUri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Share Performance Report PDF',
          });
        }
        return;
      }

      if (action === 'preview' || action === 'download') {
        // Share/Download the PDF
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(pdfUri, {
            mimeType: 'application/pdf',
            dialogTitle: action === 'preview' ? 'View Performance Report PDF' : 'Save Performance Report PDF',
          });
        } else {
          // Fallback: try to open with Linking
          try {
            const canOpen = await Linking.canOpenURL(pdfUri);
            if (canOpen) {
              await Linking.openURL(pdfUri);
            } else {
              Alert.alert('Success', `PDF saved to: ${pdfUri}`);
            }
          } catch (linkError) {
            Alert.alert('Success', `PDF saved to: ${pdfUri}`);
          }
        }
      }
    } catch (error) {
      console.error(`Error during PDF ${action}:`, error);
      Alert.alert('Error', error.message || `Failed to ${action} PDF`);
    } finally {
      setGeneratingPdf(false);
      setGeneratingPdfId(null);
    }
  };

  const confirmDelete = (report) => {
    setReportToDelete(report);
    setShowDeleteConfirm(true);
  };

  const handleDeleteReport = async () => {
    if (!reportToDelete || !reportToDelete.id) {
      Alert.alert('Error', 'No report selected for deletion');
      return;
    }

    setLoading(true);
    try {
      // Note: Photo and PDF file deletion is now handled by the backend
      // when the performance review is deleted. No need to manually delete files.

      // Delete the report record
      await deletePerformanceReview(reportToDelete.id);

      Alert.alert('Success', 'Performance report deleted successfully');
      setShowDeleteConfirm(false);
      setReportToDelete(null);

      // Refresh the view
      if (selectedUser) {
        await handleUserClick(selectedUser);
        // Check if the selected date folder is now empty
        const updatedDateFolder = dateFolders.find(df => df.date === selectedDate?.date);
        if (updatedDateFolder && updatedDateFolder.reports.length === 0) {
          setSelectedDate(null);
        }
      } else {
        await fetchUserFolders();
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      Alert.alert('Error', 'Failed to delete performance report');
    } finally {
      setLoading(false);
    }
  };

  // Show user folders if no user selected
  if (!selectedUser) {
    return (
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* <View style={styles.header}>
          <Text style={styles.title}>Performance Review</Text>
          <Text style={styles.subtitle}>Review performance reports organized by staff and supervisors</Text>
        </View> */}

        {canSubmitReports && (
          <Card style={styles.card}>
            <CardHeader>
              <CardTitle>Submit Performance Report</CardTitle>
              <CardDescription>Choose a date, category, description and up to 4 photos.</CardDescription>
            </CardHeader>
            <CardContent style={styles.cardContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Date</Text>
                <TextInput
                  style={styles.input}
                  value={date}
                  editable={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Category *</Text>
                <SimpleDropdown
                  options={[
                    { label: 'Select category', value: '' },
                    ...categories.map(cat => ({ label: cat.label, value: cat.value }))
                  ]}
                  selectedValue={category}
                  onValueChange={setCategory}
                  placeholder="Select category"
                  style={styles.dropdown}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Description *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe the work performed, issues encountered, or other relevant details..."
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Photo 1</Text>
                {photo1 ? (
                  <View style={styles.photoPreviewContainer}>
                    <Image source={{ uri: photo1 }} style={styles.photoPreview} />
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={() => handleRemovePhoto(1)}
                    >
                      <Text style={styles.removePhotoText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.photoButton}
                    onPress={() => handlePickPhoto(1)}
                  >
                    <Text style={styles.photoButtonText}>Select Photo</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Photo 2</Text>
                {photo2 ? (
                  <View style={styles.photoPreviewContainer}>
                    <Image source={{ uri: photo2 }} style={styles.photoPreview} />
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={() => handleRemovePhoto(2)}
                    >
                      <Text style={styles.removePhotoText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.photoButton}
                    onPress={() => handlePickPhoto(2)}
                  >
                    <Text style={styles.photoButtonText}>Select Photo</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Photo 3</Text>
                {photo3 ? (
                  <View style={styles.photoPreviewContainer}>
                    <Image source={{ uri: photo3 }} style={styles.photoPreview} />
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={() => handleRemovePhoto(3)}
                    >
                      <Text style={styles.removePhotoText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.photoButton}
                    onPress={() => handlePickPhoto(3)}
                  >
                    <Text style={styles.photoButtonText}>Select Photo</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Photo 4</Text>
                {photo4 ? (
                  <View style={styles.photoPreviewContainer}>
                    <Image source={{ uri: photo4 }} style={styles.photoPreview} />
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={() => handleRemovePhoto(4)}
                    >
                      <Text style={styles.removePhotoText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.photoButton}
                    onPress={() => handlePickPhoto(4)}
                  >
                    <Text style={styles.photoButtonText}>Select Photo</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[styles.submitButton, uploading && styles.submitButtonDisabled]}
                onPress={handleUpload}
                disabled={uploading}
              >
                <Text style={styles.submitButtonText}>
                  {uploading ? 'Submitting...' : 'Submit Report'}
                </Text>
              </TouchableOpacity>
            </CardContent>
          </Card>
        )}

        <Card style={styles.card}>
          <CardHeader>
            <CardTitle>User Folders</CardTitle>
            <CardDescription>Click on a user folder to view their performance reports by date.</CardDescription>
          </CardHeader>
          <CardContent style={styles.cardContent}>
            {loading ? (
              <Text style={styles.loadingText}>Loading user folders...</Text>
            ) : userFolders.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>📋</Text>
                <Text style={styles.emptyStateText}>No users with reports found.</Text>
              </View>
            ) : (
              <View style={styles.folderGrid}>
                {userFolders.map(user => (
                  <TouchableOpacity
                    key={`${user.role || 'user'}-${user.user_id}`}
                    style={styles.folderCard}
                    onPress={() => handleUserClick(user)}
                  >
                    <Text style={styles.folderIcon}>📁</Text>
                    <Text style={styles.folderName}>{user.name}</Text>
                    <Text style={styles.folderRole}>{user.role}</Text>
                    <Text style={styles.reportCount}>{user.reportCount} reports</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </CardContent>
        </Card>
      </ScrollView>
    );
  }

  // Show date folders if user selected but no date selected
  if (!selectedDate) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.breadcrumb}>
            <TouchableOpacity onPress={handleBackToUsers}>
              <Text style={styles.backButton}>← Back to Users</Text>
            </TouchableOpacity>
            <Text style={styles.breadcrumbText}> / {selectedUser.name}</Text>
          </View>
          <Text style={styles.title}>Date Folders</Text>
          <Text style={styles.subtitle}>Select a date to view reports</Text>
        </View>

        <Card style={styles.card}>
          <CardHeader>
            <CardTitle>Performance Dates</CardTitle>
            <CardDescription>Click on a date folder to view reports for that day.</CardDescription>
          </CardHeader>
          <CardContent style={styles.cardContent}>
            {loading ? (
              <Text style={styles.loadingText}>Loading dates...</Text>
            ) : dateFolders.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>📅</Text>
                <Text style={styles.emptyStateText}>No performance reports found for this user.</Text>
              </View>
            ) : (
              <View style={styles.folderGrid}>
                {dateFolders.map((dateFolder, index) => (
                  <TouchableOpacity
                    key={`${dateFolder.date || 'unknown'}-${index}`}
                    style={styles.folderCard}
                    onPress={() => handleDateClick(dateFolder)}
                  >
                    <Text style={styles.folderIcon}>📅</Text>
                    <Text style={styles.folderName}>{dateFolder.formattedDate}</Text>
                    <Text style={styles.reportCount}>{dateFolder.reports.length} reports</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </CardContent>
        </Card>
      </ScrollView>
    );
  }

  // Show reports for selected date
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.breadcrumb}>
          <TouchableOpacity onPress={handleBackToUsers}>
            <Text style={styles.backButton}>← Back to Users</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleBackToDates}>
            <Text style={styles.breadcrumbText}> / {selectedUser.name}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>Performance Reports</Text>
        <Text style={styles.subtitle}>Reports for {selectedUser.name} on {selectedDate.formattedDate}.</Text>
      </View>

      <Card style={styles.card}>
        <CardHeader>
          <CardTitle>Performance Reports</CardTitle>
          <CardDescription>View performance reports for this date.</CardDescription>
        </CardHeader>
        <CardContent style={styles.cardContent}>
          <View style={styles.reportGrid}>
            {selectedDate.reports.map(report => (
              <View key={report.id} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <Text style={styles.reportTitle}>
                    {categories.find(c => c.value === report.category)?.label || report.category}
                  </Text>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, generatingPdfId === report.id && styles.actionButtonDisabled]}
                      onPress={() => handlePdfAction(report, 'preview')}
                      disabled={generatingPdfId === report.id}
                    >
                      {generatingPdfId === report.id && generatingPdf ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Text style={styles.actionButtonText}>👁️</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, generatingPdfId === report.id && styles.actionButtonDisabled]}
                      onPress={() => handlePdfAction(report, 'download')}
                      disabled={generatingPdfId === report.id}
                    >
                      {generatingPdfId === report.id && generatingPdf ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Text style={styles.actionButtonText}>⬇️</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, generatingPdfId === report.id && styles.actionButtonDisabled]}
                      onPress={() => handlePdfAction(report, 'regenerate')}
                      disabled={generatingPdfId === report.id}
                    >
                      {generatingPdfId === report.id && generatingPdf ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Text style={styles.actionButtonText}>🔄</Text>
                      )}
                    </TouchableOpacity>
                    {canDeleteReports && (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={() => confirmDelete(report)}
                      >
                        <Text style={styles.actionButtonText}>🗑️</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <Text style={styles.reportDate}>
                  {report.date} • {report.location_name || 'Unknown Location'}
                </Text>
                <Text style={styles.reportDescription}>{report.description}</Text>

                {reportPhotoUrls[report.id] && reportPhotoUrls[report.id].length > 0 && (
                  <View style={styles.photoSection}>
                    <Text style={styles.photoLabel}>Photos:</Text>
                    <View style={styles.photoGrid}>
                      {reportPhotoUrls[report.id].map((url, index) => (
                        <TouchableOpacity
                          key={index}
                          onPress={() => setSelectedPhotoUrl(url)}
                        >
                          <Image
                            source={{ uri: url }}
                            style={styles.photoThumbnail}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        </CardContent>
      </Card>

      {/* Full Screen Photo Modal */}
      <Modal visible={!!selectedPhotoUrl} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSelectedPhotoUrl(null)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            {selectedPhotoUrl && (
              <Image
                source={{ uri: selectedPhotoUrl }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={showDeleteConfirm} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.confirmModalContent}>
            <Text style={styles.confirmTitle}>Confirm Deletion</Text>
            <Text style={styles.confirmMessage}>
              Are you sure you want to delete this performance report? This action cannot be undone.
              All associated photos and the PDF will also be permanently deleted.
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelButton]}
                onPress={() => {
                  setShowDeleteConfirm(false);
                  setReportToDelete(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.deleteConfirmButton]}
                onPress={handleDeleteReport}
                disabled={loading}
              >
                <Text style={styles.deleteConfirmButtonText}>
                  {loading ? 'Deleting...' : 'Delete Report'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    // marginTop: 15,
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: 'white',
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  backButton: {
    color: '#007AFF',
    fontSize: 16,
  },
  breadcrumbText: {
    color: '#666',
    fontSize: 16,
  },
  card: {
    backgroundColor: 'white',
    margin: 16,
    marginTop: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardContent: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    color: '#333',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  photoButton: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
  },
  photoButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  photoPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  photoPreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  removePhotoButton: {
    padding: 8,
  },
  removePhotoText: {
    color: '#dc3545',
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    textAlign: 'center',
    color: '#666',
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  folderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  folderCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  folderIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  folderName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  folderRole: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  reportCount: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  reportGrid: {
    gap: 16,
  },
  reportCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
  },
  actionButtonText: {
    fontSize: 14,
  },
  reportDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  reportDescription: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
  },
  photoSection: {
    marginTop: 12,
  },
  photoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  fullImage: {
    width: '100%',
    height: '80%',
    borderRadius: 8,
  },
  confirmModalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  confirmMessage: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  confirmButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
  deleteConfirmButton: {
    backgroundColor: '#dc3545',
  },
  deleteConfirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
});

export default PerformanceReviewScreen;
