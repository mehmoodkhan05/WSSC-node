import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';

import { useAuth } from '../contexts/AuthContext';
import {
  fetchProfiles,
  fetchManagers,
  fetchGeneralManagers,
  checkUserCanDelete,
  deleteUser,
} from '../lib/staff';
// Parse import removed - using REST API via apiClient
import {
  ROLE,
  ROLE_OPTIONS,
  normalizeRole,
  hasFullControl,
  getRoleLabel,
} from '../lib/roles';
import { useDepartments } from '../hooks/useDepartments';
import { JOBS } from '../lib/jobs';
import { GRADES } from '../lib/grades';
import SimpleDropdown from '../components/ui/SimpleDropdown';

const UsersScreen = () => {
  const { profile } = useAuth();
  const { departments: DEPARTMENTS } = useDepartments(); // Fetch departments from API
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [empNo, setEmpNo] = useState('');
  const [empCnic, setEmpCnic] = useState('');
  const [empFname, setEmpFname] = useState('');
  const [empDeptt, setEmpDeptt] = useState('');
  const [empJob, setEmpJob] = useState('');
  const [empGrade, setEmpGrade] = useState('');
  const [empCell1, setEmpCell1] = useState('');
  const [empCell2, setEmpCell2] = useState('');
  const [empFlg, setEmpFlg] = useState('');
  const [empMarried, setEmpMarried] = useState('');
  const [empGender, setEmpGender] = useState('');
  const [shiftDays, setShiftDays] = useState('6');
  const [shiftTime, setShiftTime] = useState('day');
  const [shiftStartTime, setShiftStartTime] = useState('09:00');
  const [shiftEndTime, setShiftEndTime] = useState('17:00');
  const [role, setRole] = useState(ROLE.STAFF);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUserForRole, setSelectedUserForRole] = useState(null);
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [managers, setManagers] = useState([]);
  const [generalManagers, setGeneralManagers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [userDeletability, setUserDeletability] = useState({});

  const normalizedRole = normalizeRole(profile?.role) || ROLE.STAFF;
  const canManageUsers = hasFullControl(normalizedRole) || normalizedRole === ROLE.CEO;

  const load = async () => {
    setLoading(true);
    try {
      const [list, managers, generalManagers] = await Promise.all([
        fetchProfiles(),
        fetchManagers(),
        fetchGeneralManagers(),
      ]);
      setProfiles(list || []);
      setManagers(managers || []);
      setGeneralManagers(generalManagers || []);
      // Check deletability for all users
      checkAllUsersDeletability(list || []);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const checkAllUsersDeletability = async (usersList) => {
    const deletabilityMap = {};
    for (const user of usersList) {
      try {
        const result = await checkUserCanDelete(user.user_id);
        deletabilityMap[user.user_id] = result;
      } catch (error) {
        console.error(`Error checking deletability for user ${user.user_id}:`, error);
        deletabilityMap[user.user_id] = { canDelete: false, reason: 'Unable to verify' };
      }
    }
    setUserDeletability(deletabilityMap);
  };

  const handleDelete = async (userId) => {
    const deletability = userDeletability[userId];
    if (!deletability?.canDelete) {
      Alert.alert('Cannot Delete', deletability?.reason || 'User has associated data and cannot be deleted');
      return;
    }

    Alert.alert(
      'Delete User',
      'Are you sure you want to delete this user? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUser(userId);
              Alert.alert('Success', 'User deleted successfully');
              await load();
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to delete user');
            }
          },
        },
      ]
    );
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!email || !password || !fullName) {
      Alert.alert('Error', 'Please fill all required fields (Email, Password, Full Name)');
      return;
    }
    try {
      const { adminCreateUser } = require('../lib/auth');
      const response = await adminCreateUser(
        email,
        password,
        fullName,
        role,
        {
          empNo: empNo || null,
          empCnic: empCnic || null,
          empFname: empFname || null,
          empDeptt: empDeptt || null,
          empJob: empJob || null,
          empGrade: empGrade || null,
          empCell1: empCell1 || null,
          empCell2: empCell2 || null,
          empFlg: empFlg || null,
          empMarried: empMarried || null,
          empGender: empGender || null,
          shiftDays: parseInt(shiftDays) || 6,
          shiftTime: shiftTime || 'day',
          shiftStartTime: shiftStartTime || '09:00',
          shiftEndTime: shiftEndTime || '17:00',
        }
      );
      Alert.alert('Success', 'User created');
      // Reset all fields
      setEmail('');
      setPassword('');
      setFullName('');
      setEmpNo('');
      setEmpCnic('');
      setEmpFname('');
      setEmpDeptt('');
      setEmpJob('');
      setEmpGrade('');
      setEmpCell1('');
      setEmpCell2('');
      setEmpFlg('');
      setEmpMarried('');
      setEmpGender('');
      setShiftDays('6');
      setShiftTime('day');
      setShiftStartTime('09:00');
      setShiftEndTime('17:00');
      setRole(ROLE.STAFF);
      await load();
      return response;
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to create user');
    }
  };

  const handleRoleChange = async (user_id, value) => {
    try {
      const { updateUserRole } = require('../lib/auth');
      await updateUserRole(user_id, value);
      Alert.alert('Success', 'Role updated');
      await load();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to update role');
    }
  };

  const openRoleModal = (user) => {
    setSelectedUserForRole(user);
    setShowRoleModal(true);
  };

  const closeRoleModal = () => {
    setShowRoleModal(false);
    setSelectedUserForRole(null);
  };

  const selectRole = async (newRole) => {
    if (selectedUserForRole) {
      // If editing user, update role in form, otherwise update directly
      if (showEditModal && editingUser && selectedUserForRole.user_id === editingUser.user_id) {
        setRole(newRole);
        closeRoleModal();
      } else {
        await handleRoleChange(selectedUserForRole.user_id, newRole);
        closeRoleModal();
      }
    }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFullName(user.full_name || '');
    setEmpNo(user.emp_no || '');
    setEmpCnic(user.emp_cnic || '');
    setEmpFname(user.emp_fname || '');
    setEmpDeptt(user.emp_deptt || user.department || '');
    setEmpJob(user.emp_job || '');
    setEmpGrade(user.emp_grade || '');
    setEmpCell1(user.emp_cell1 || '');
    setEmpCell2(user.emp_cell2 || '');
    setEmpFlg(user.emp_flg || '');
    setEmpMarried(user.emp_married || '');
    setEmpGender(user.emp_gender || '');
    setShiftDays(user.shift_days?.toString() || '6');
    setShiftTime(user.shift_time || 'day');
    setShiftStartTime(user.shift_start_time || '09:00');
    setShiftEndTime(user.shift_end_time || '17:00');
    setRole(user.role || ROLE.STAFF);
    setPassword(''); // Don't pre-fill password
    setIsActive(user.is_active !== false); // Default to true if not set
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setShowEditModal(false);
    // Reset form fields
    setFullName('');
    setEmpNo('');
    setEmpCnic('');
    setEmpFname('');
    setEmpDeptt('');
    setEmpJob('');
    setEmpGrade('');
    setEmpCell1('');
    setEmpCell2('');
    setEmpFlg('');
    setEmpMarried('');
    setEmpGender('');
    setRole(ROLE.STAFF);
    setPassword('');
    setIsActive(true);
  };

  const handleUpdate = async () => {
    if (!editingUser || !fullName) {
      Alert.alert('Error', 'Please fill all required fields (Full Name)');
      return;
    }
    try {
      const { updateUserProfile } = require('../lib/staff');
      const payload = {
        full_name: fullName,
        role: role,
        empNo,
        empCnic,
        empFname,
        empDeptt,
        empJob,
        empGrade,
        empCell1,
        empCell2,
        empFlg,
        empMarried,
        empGender,
        shiftDays: shiftDays ? parseInt(shiftDays, 10) : undefined,
        shiftTime,
        shiftStartTime,
        shiftEndTime,
        isActive,
      };

      if (password && password.trim() !== '') {
        payload.password = password;
      }

      const response = await updateUserProfile(editingUser.user_id, payload);
      Alert.alert('Success', 'User updated successfully');
      closeEditModal();
      await load();
      return response;
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to update user');
    }
  };

  // Filter users with search functionality
  const filteredUsers = profiles.filter(user =>
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination calculations
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  // Reset to page 1 when search query changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const renderUser = ({ item }) => {
    const isUserActive = item.is_active !== false; // Default to true if not set
    const deletability = userDeletability[item.user_id];
    const canDelete = deletability?.canDelete;
    
    return (
      <View style={[styles.userItem, !isUserActive && styles.userItemInactive]}>
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={[styles.userName, !isUserActive && styles.userNameInactive]}>
              {item.full_name || '—'}
            </Text>
            {!isUserActive && (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveBadgeText}>Inactive</Text>
              </View>
            )}
          </View>
          <Text style={styles.userEmail}>{item.email}</Text>
          <View style={styles.roleContainer}>
            <Text style={styles.roleLabel}>Role:</Text>
            <TouchableOpacity
              style={styles.roleButton}
              onPress={() => openRoleModal(item)}
            >
              <Text style={styles.roleButtonText}>{getRoleLabel(item.role)}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.userActions}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => openEditModal(item)}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.deleteButton, 
              !canDelete && styles.deleteButtonDisabled
            ]}
            onPress={() => handleDelete(item.user_id)}
            disabled={!canDelete}
          >
            <Text style={[
              styles.deleteButtonText,
              !canDelete && styles.deleteButtonTextDisabled
            ]}>
              {canDelete ? 'Delete' : 'In Use'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (!canManageUsers) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Access denied. Executive access only.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Create User</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Full Name *</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Jane Doe"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Employee Number</Text>
          <TextInput
            style={styles.input}
            value={empNo}
            onChangeText={setEmpNo}
            placeholder="Employee Number"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>CNIC</Text>
          <TextInput
            style={styles.input}
            value={empCnic}
            onChangeText={setEmpCnic}
            placeholder="12345-1234567-1"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Father Name</Text>
          <TextInput
            style={styles.input}
            value={empFname}
            onChangeText={setEmpFname}
            placeholder="Father's Name"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Email *</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="user@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Password *</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Department</Text>
          <SimpleDropdown
            options={[
              { label: 'Select Department', value: '' },
              ...DEPARTMENTS.map(dept => ({ label: dept.label, value: dept.id }))
            ]}
            selectedValue={empDeptt}
            onValueChange={setEmpDeptt}
            placeholder="Select Department"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Job</Text>
          <SimpleDropdown
            options={[
              { label: 'Select Job', value: '' },
              ...JOBS.map(job => ({ label: `${job.label} (${job.jobId})`, value: job.id }))
            ]}
            selectedValue={empJob}
            onValueChange={setEmpJob}
            placeholder="Select Job"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Grade</Text>
          <SimpleDropdown
            options={[
              { label: 'Select Grade', value: '' },
              ...GRADES.map(grade => ({ label: grade.label, value: grade.id }))
            ]}
            selectedValue={empGrade}
            onValueChange={setEmpGrade}
            placeholder="Select Grade"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Cell Phone 1</Text>
          <TextInput
            style={styles.input}
            value={empCell1}
            onChangeText={setEmpCell1}
            placeholder="+92 300 1234567"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Cell Phone 2</Text>
          <TextInput
            style={styles.input}
            value={empCell2}
            onChangeText={setEmpCell2}
            placeholder="+92 300 1234567"
            keyboardType="phone-pad"
          />
        </View>

        {/* <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Flag</Text>
          <TextInput
            style={styles.input}
            value={empFlg}
            onChangeText={setEmpFlg}
            placeholder="Flag"
          />
        </View> */}

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Married Status</Text>
          <SimpleDropdown
            options={[
              { label: 'Select Status', value: '' },
              { label: 'Yes', value: 'Yes' },
              { label: 'No', value: 'No' },
              { label: 'Single', value: 'Single' },
              { label: 'Married', value: 'Married' },
            ]}
            selectedValue={empMarried}
            onValueChange={setEmpMarried}
            placeholder="Select Married Status"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Gender</Text>
          <SimpleDropdown
            options={[
              { label: 'Select Gender', value: '' },
              { label: 'Male', value: 'Male' },
              { label: 'Female', value: 'Female' },
              { label: 'Other', value: 'Other' },
            ]}
            selectedValue={empGender}
            onValueChange={setEmpGender}
            placeholder="Select Gender"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Shift Days *</Text>
          <SimpleDropdown
            options={[
              { label: '5 Days (Sat & Sun Off)', value: '5' },
              { label: '6 Days (Sun Off)', value: '6' },
            ]}
            selectedValue={shiftDays}
            onValueChange={setShiftDays}
            placeholder="Select Shift Days"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Shift Time *</Text>
          <SimpleDropdown
            options={[
              { label: 'Day Shift (09:00 - 17:00)', value: 'day' },
              { label: 'Night Shift (21:00 - 05:00)', value: 'night' },
            ]}
            selectedValue={shiftTime}
            onValueChange={(value) => {
              setShiftTime(value);
              // Auto-populate shift times based on selection
              if (value === 'day') {
                setShiftStartTime('09:00');
                setShiftEndTime('17:00');
              } else if (value === 'night') {
                setShiftStartTime('21:00');
                setShiftEndTime('05:00');
              }
            }}
            placeholder="Select Shift Time"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Shift Start Time</Text>
          <TextInput
            style={styles.input}
            value={shiftStartTime}
            onChangeText={setShiftStartTime}
            placeholder="HH:MM (e.g., 09:00)"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Shift End Time</Text>
          <TextInput
            style={styles.input}
            value={shiftEndTime}
            onChangeText={setShiftEndTime}
            placeholder="HH:MM (e.g., 17:00)"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Role *</Text>
          <TouchableOpacity
            style={styles.roleButton}
            onPress={() => setShowCreateRoleModal(true)}
          >
          <Text style={styles.roleButtonText}>{getRoleLabel(role)}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.createButton, (!email || !password || !fullName) && styles.disabledButton]}
          onPress={handleCreate}
          disabled={!email || !password || !fullName || loading}
        >
          <Text style={styles.createButtonText}>Create User</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>All Users</Text>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by name or email..."
            placeholderTextColor="#999"
          />
        </View>

        {profiles.length === 0 ? (
          <Text style={styles.emptyText}>No users yet</Text>
        ) : filteredUsers.length === 0 ? (
          <Text style={styles.emptyText}>No users found</Text>
        ) : (
          <>
            <View style={styles.usersListContainer}>
              {paginatedUsers.map((item) => (
                <View key={item.user_id.toString()}>
                  {renderUser({ item })}
                </View>
              ))}
            </View>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <View style={styles.paginationContainer}>
                <TouchableOpacity
                  style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
                  onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <Text style={[styles.paginationButtonText, currentPage === 1 && styles.paginationButtonTextDisabled]}>
                    Previous
                  </Text>
                </TouchableOpacity>

                <View style={styles.paginationInfo}>
                  <Text style={styles.paginationText}>
                    Page {currentPage} of {totalPages}
                  </Text>
                  <Text style={styles.paginationSubtext}>
                    ({filteredUsers.length} total users)
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.paginationButton, currentPage === totalPages && styles.paginationButtonDisabled]}
                  onPress={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  <Text style={[styles.paginationButtonText, currentPage === totalPages && styles.paginationButtonTextDisabled]}>
                    Next
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>

      <Modal
        visible={showRoleModal}
        transparent={true}
        animationType="slide"
        onRequestClose={closeRoleModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Role</Text>
            {ROLE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={styles.modalOption}
                onPress={() => selectRole(option.value)}
              >
                <Text style={styles.modalOptionText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={closeRoleModal}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCreateRoleModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCreateRoleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Role</Text>
            {ROLE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={styles.modalOption}
                onPress={() => {
                  setRole(option.value);
                  setShowCreateRoleModal(false);
                }}
              >
                <Text style={styles.modalOptionText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowCreateRoleModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="slide"
        onRequestClose={closeEditModal}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeEditModal}
        >
          <View 
            style={styles.modalContentLarge}
            onStartShouldSetResponder={() => true}
          >
            <ScrollView style={styles.modalScrollView}>
              <Text style={styles.modalTitle}>Edit User</Text>
              <Text style={styles.modalSubtitle}>
                Editing: {editingUser?.email || 'User'}
              </Text>
              <Text style={styles.modalNote}>
                Note: Email cannot be changed
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Full Name *</Text>
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Jane Doe"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Employee Number</Text>
                <TextInput
                  style={styles.input}
                  value={empNo}
                  onChangeText={setEmpNo}
                  placeholder="Employee Number"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>CNIC</Text>
                <TextInput
                  style={styles.input}
                  value={empCnic}
                  onChangeText={setEmpCnic}
                  placeholder="12345-1234567-1"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Father Name</Text>
                <TextInput
                  style={styles.input}
                  value={empFname}
                  onChangeText={setEmpFname}
                  placeholder="Father's Name"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email (Read Only)</Text>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={editingUser?.email || ''}
                  editable={false}
                  placeholder="Email cannot be changed"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password (Leave blank to keep current)</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter new password or leave blank"
                  secureTextEntry
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Department</Text>
                <SimpleDropdown
                  options={[
                    { label: 'Select Department', value: '' },
                    ...DEPARTMENTS.map(dept => ({ label: dept.label, value: dept.id }))
                  ]}
                  selectedValue={empDeptt}
                  onValueChange={setEmpDeptt}
                  placeholder="Select Department"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Job</Text>
                <SimpleDropdown
                  options={[
                    { label: 'Select Job', value: '' },
                    ...JOBS.map(job => ({ label: `${job.label} (${job.jobId})`, value: job.id }))
                  ]}
                  selectedValue={empJob}
                  onValueChange={setEmpJob}
                  placeholder="Select Job"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Grade</Text>
                <SimpleDropdown
                  options={[
                    { label: 'Select Grade', value: '' },
                    ...GRADES.map(grade => ({ label: grade.label, value: grade.id }))
                  ]}
                  selectedValue={empGrade}
                  onValueChange={setEmpGrade}
                  placeholder="Select Grade"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Cell Phone 1</Text>
                <TextInput
                  style={styles.input}
                  value={empCell1}
                  onChangeText={setEmpCell1}
                  placeholder="+92 300 1234567"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Cell Phone 2</Text>
                <TextInput
                  style={styles.input}
                  value={empCell2}
                  onChangeText={setEmpCell2}
                  placeholder="+92 300 1234567"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Flag</Text>
                <TextInput
                  style={styles.input}
                  value={empFlg}
                  onChangeText={setEmpFlg}
                  placeholder="Flag"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Married Status</Text>
                <SimpleDropdown
                  options={[
                    { label: 'Select Status', value: '' },
                    { label: 'Yes', value: 'Yes' },
                    { label: 'No', value: 'No' },
                    { label: 'Single', value: 'Single' },
                    { label: 'Married', value: 'Married' },
                  ]}
                  selectedValue={empMarried}
                  onValueChange={setEmpMarried}
                  placeholder="Select Married Status"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Gender</Text>
                <SimpleDropdown
                  options={[
                    { label: 'Select Gender', value: '' },
                    { label: 'Male', value: 'Male' },
                    { label: 'Female', value: 'Female' },
                    { label: 'Other', value: 'Other' },
                  ]}
                  selectedValue={empGender}
                  onValueChange={setEmpGender}
                  placeholder="Select Gender"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Shift Days</Text>
                <SimpleDropdown
                  options={[
                    { label: '5 Days (Sat & Sun Off)', value: '5' },
                    { label: '6 Days (Sun Off)', value: '6' },
                  ]}
                  selectedValue={shiftDays}
                  onValueChange={setShiftDays}
                  placeholder="Select Shift Days"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Shift Time</Text>
                <SimpleDropdown
                  options={[
                    { label: 'Day Shift (09:00 - 17:00)', value: 'day' },
                    { label: 'Night Shift (21:00 - 05:00)', value: 'night' },
                  ]}
                  selectedValue={shiftTime}
                  onValueChange={(value) => {
                    setShiftTime(value);
                    if (value === 'day') {
                      setShiftStartTime('09:00');
                      setShiftEndTime('17:00');
                    } else if (value === 'night') {
                      setShiftStartTime('21:00');
                      setShiftEndTime('05:00');
                    }
                  }}
                  placeholder="Select Shift Time"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Shift Start Time</Text>
                <TextInput
                  style={styles.input}
                  value={shiftStartTime}
                  onChangeText={setShiftStartTime}
                  placeholder="HH:MM (e.g., 09:00)"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Shift End Time</Text>
                <TextInput
                  style={styles.input}
                  value={shiftEndTime}
                  onChangeText={setShiftEndTime}
                  placeholder="HH:MM (e.g., 17:00)"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Role *</Text>
                <SimpleDropdown
                  options={[
                    { label: 'Select Role', value: '' },
                    ...ROLE_OPTIONS.map(option => ({ label: option.label, value: option.value }))
                  ]}
                  selectedValue={role}
                  onValueChange={setRole}
                  placeholder="Select Role"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Status</Text>
                <View style={styles.statusToggleContainer}>
                  <TouchableOpacity
                    style={[styles.statusToggle, isActive && styles.statusToggleActive]}
                    onPress={() => setIsActive(true)}
                  >
                    <Text style={[styles.statusToggleText, isActive && styles.statusToggleTextActive]}>
                      Active
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.statusToggle, !isActive && styles.statusToggleInactive]}
                    onPress={() => setIsActive(false)}
                  >
                    <Text style={[styles.statusToggleText, !isActive && styles.statusToggleTextInactive]}>
                      Inactive
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.statusNote}>
                  Inactive users will not appear in any activities
                </Text>
              </View>

              <View style={styles.modalButtonRow}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={closeEditModal}
                >
                  <Text style={styles.modalButtonCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSave, (!fullName) && styles.disabledButton]}
                  onPress={handleUpdate}
                  disabled={!fullName || loading}
                >
                  <Text style={styles.modalButtonSaveText}>Update User</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 15,
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    paddingTop: 40,
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
  section: {
    backgroundColor: 'white',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  inputContainer: {
    marginTop: 5,
    marginBottom: 16,
  },
  inputLabel: {
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
  },

  createButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  userNameInactive: {
    color: '#999',
    textDecorationLine: 'line-through',
  },
  inactiveBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  inactiveBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  userItemInactive: {
    opacity: 0.7,
    backgroundColor: '#f9f9f9',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  roleButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  roleButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteButtonDisabled: {
    backgroundColor: '#e5e7eb',
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  deleteButtonTextDisabled: {
    color: '#9ca3af',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#ff3b30',
    textAlign: 'center',
    marginTop: 50,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#333',
  },
  modalCancel: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 10,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  modalContentLarge: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '70%',
  },
  modalScrollView: {
    // maxHeight: '80%',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalNote: {
    fontSize: 12,
    color: '#ff9500',
    marginBottom: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  inputDisabled: {
    backgroundColor: '#f0f0f0',
    color: '#999',
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f0f0f0',
  },
  modalButtonSave: {
    backgroundColor: '#007AFF',
  },
  modalButtonCancelText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  modalButtonSaveText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  statusToggleContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f9f9f9',
  },
  statusToggle: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  statusToggleActive: {
    backgroundColor: '#22c55e',
  },
  statusToggleInactive: {
    backgroundColor: '#ef4444',
  },
  statusToggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  statusToggleTextActive: {
    color: 'white',
  },
  statusToggleTextInactive: {
    color: 'white',
  },
  statusNote: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
  flatListContent: {
    paddingBottom: 20,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  usersListContainer: {
    // No maxHeight needed - ScrollView handles scrolling
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginTop: 8,
  },
  paginationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#007AFF',
    minWidth: 80,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: '#ccc',
  },
  paginationButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  paginationButtonTextDisabled: {
    color: '#999',
  },
  paginationInfo: {
    alignItems: 'center',
    flex: 1,
  },
  paginationText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  paginationSubtext: {
    fontSize: 12,
    color: '#666',
  },
});

export default UsersScreen;
