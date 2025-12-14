import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchSupervisors,
  fetchStaff,
  fetchManagers,
  fetchGeneralManagers,
  updateUserLeadership,
} from '../lib/staff';
import { fetchLocations } from '../lib/locations';
import { assignStaff, fetchAssignments, unassignStaff, assignSupervisorToLocation, fetchSupervisorLocations, unassignSupervisorFromLocation } from '../lib/assignments';
import { fetchZones } from '../lib/zones';
import SimpleDropdown from '../components/ui/SimpleDropdown';
import SearchableDropdown from '../components/ui/SearchableDropdown';
import {
  ROLE,
  normalizeRole,
  isAtLeastRole,
} from '../lib/roles';
import { ALL_DEPARTMENTS_OPTION, getDepartmentLabel } from '../lib/departments';
import { useDepartments } from '../hooks/useDepartments';

const arraysAreEqual = (a = [], b = []) => {
  if (a.length !== b.length) {
    return false;
  }
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
};

const AssignmentsScreen = () => {
  const { profile } = useAuth();
  const { departments: DEPARTMENTS } = useDepartments(); // Fetch departments from API
  const [supervisorId, setSupervisorId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [supervisors, setSupervisors] = useState([]);
  const [staff, setStaff] = useState([]);
  const [locations, setLocations] = useState([]);
  const [zones, setZones] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [supLocs, setSupLocs] = useState([]);
  const [supLocSupervisorId, setSupLocSupervisorId] = useState('');
  const [supLocLocationId, setSupLocLocationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [assignmentsPage, setAssignmentsPage] = useState(1);
  const [supLocsPage, setSupLocsPage] = useState(1);
  const [assignmentsSearchQuery, setAssignmentsSearchQuery] = useState('');
  const [supLocsSearchQuery, setSupLocsSearchQuery] = useState('');
  const itemsPerPage = 5;
  const [generalManagers, setGeneralManagers] = useState([]);
  const [managers, setManagers] = useState([]);
  const [gmAssignments, setGmAssignments] = useState({});
  const [supervisorManagerMap, setSupervisorManagerMap] = useState({});
  const [staffDepartmentFilter, setStaffDepartmentFilter] = useState(ALL_DEPARTMENTS_OPTION.id);
  const [selectedManagerForSupervisor, setSelectedManagerForSupervisor] = useState('');
  const [selectedSupervisorForManager, setSelectedSupervisorForManager] = useState('');
  const [savingGeneralManagers, setSavingGeneralManagers] = useState(false);
  const [assigningSupervisor, setAssigningSupervisor] = useState(false);
  const [managerDepartmentMap, setManagerDepartmentMap] = useState({});

  const handleSaveGeneralManagerAssignments = async () => {
    setSavingGeneralManagers(true);
    try {
      const gmToDepartments = new Map();
      Object.entries(gmAssignments).forEach(([deptId, gmId]) => {
        if (!gmId) return;
        if (!gmToDepartments.has(gmId)) {
          gmToDepartments.set(gmId, new Set());
        }
        gmToDepartments.get(gmId).add(deptId);
      });

      await Promise.all(
        generalManagers.map(async (gm) => {
          const desiredDepartments = Array.from(gmToDepartments.get(gm.user_id) || []);
          const currentDepartments = Array.isArray(gm.departments) ? gm.departments : [];
          if (!arraysAreEqual(desiredDepartments, currentDepartments)) {
            await updateUserLeadership(gm.user_id, { departments: desiredDepartments });
          }
        })
      );

      Alert.alert('Success', 'General manager departments updated');
      await loadAll();
    } catch (error) {
      console.error('Failed to update general managers:', error);
      Alert.alert('Error', error.message || 'Failed to update general manager departments');
    } finally {
      setSavingGeneralManagers(false);
    }
  };


  const handleAssignSupervisorToManager = async () => {
    if (!selectedManagerForSupervisor || !selectedSupervisorForManager) {
      Alert.alert('Error', 'Please choose both manager and supervisor');
      return;
    }

    setAssigningSupervisor(true);
    try {
      const department =
        managerDepartmentMap[selectedManagerForSupervisor] ||
        managers.find((manager) => manager.user_id === selectedManagerForSupervisor)?.department ||
        null;

      await updateUserLeadership(selectedSupervisorForManager, {
        managerId: selectedManagerForSupervisor,
        department,
      });

      Alert.alert('Success', 'Supervisor assigned to manager');
      setSelectedSupervisorForManager('');
      await loadAll();
    } catch (error) {
      console.error('Failed to assign supervisor to manager:', error);
      Alert.alert('Error', error.message || 'Failed to assign supervisor to manager');
    } finally {
      setAssigningSupervisor(false);
    }
  };

  const handleUnassignSupervisorFromManager = async (supervisorId) => {
    Alert.alert(
      'Remove Supervisor',
      'Are you sure you want to remove this supervisor from their manager?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateUserLeadership(supervisorId, {
                managerId: null,
                department: null,
              });
              await loadAll();
            } catch (error) {
              console.error('Failed to unassign supervisor:', error);
              Alert.alert('Error', error.message || 'Failed to unassign supervisor');
            }
          },
        },
      ]
    );
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sups, stf, locs, asg, sl, mgrs, gms] = await Promise.all([
        fetchSupervisors(),
        fetchStaff(),
        fetchLocations(),
        fetchAssignments(),
        fetchSupervisorLocations(),
        fetchManagers(),
        fetchGeneralManagers(),
      ]);

      setSupervisors(sups);
      setStaff(stf);
      setLocations(locs);
      setAssignments(asg);
      setSupLocs(sl);
      setManagers(mgrs);
      setGeneralManagers(gms);

      const gmMap = {};
      DEPARTMENTS.forEach((dept) => {
        const assignedGm = gms.find((gm) => Array.isArray(gm.departments) && gm.departments.includes(dept.id));
        if (assignedGm) {
          gmMap[dept.id] = assignedGm.user_id;
        }
      });
      setGmAssignments(gmMap);

      // Build manager department map from managers (department is set during user creation)
      const managerDeptMapLocal = {};
      mgrs.forEach((manager) => {
        if (manager.department) {
          managerDeptMapLocal[manager.user_id] = manager.department;
        }
      });
      setManagerDepartmentMap(managerDeptMapLocal);

      const supervisorMap = {};
      sups.forEach((supervisor) => {
        if (supervisor.manager_id) {
          supervisorMap[supervisor.user_id] = supervisor.manager_id;
        }
      });
      setSupervisorManagerMap(supervisorMap);

      if (selectedManagerForSupervisor && !mgrs.some((manager) => manager.user_id === selectedManagerForSupervisor)) {
        setSelectedManagerForSupervisor('');
        setSelectedSupervisorForManager('');
      }

      if (selectedSupervisorForManager && !sups.some((supervisor) => supervisor.user_id === selectedSupervisorForManager)) {
        setSelectedSupervisorForManager('');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load data');
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleAssign = async () => {
    if (!supervisorId || !staffId || !zoneId) {
      Alert.alert('Error', 'Please select all fields');
      return;
    }
    
    // For managers, validate that staff and supervisor belong to their department
    if (isManagerOnly && currentManagerDepartment) {
      const selectedStaff = staff.find((s) => s.user_id === staffId);
      const selectedSupervisor = supervisors.find((s) => s.user_id === supervisorId);
      
      if (selectedStaff && (selectedStaff.department || null) !== currentManagerDepartment) {
        Alert.alert('Error', 'You can only assign staff from your department');
        return;
      }
      
      if (selectedSupervisor) {
        const supervisorDept = selectedSupervisor.department || managerDepartmentMap[selectedSupervisor.manager_id] || null;
        if (supervisorDept !== currentManagerDepartment) {
          Alert.alert('Error', 'You can only assign to supervisors from your department');
          return;
        }
      }
    }
    
    try {
      await assignStaff({ supervisor_id: supervisorId, staff_id: staffId, zone_id: zoneId });

      // Only update managerId - department is set during user creation
      const supervisor = supervisors.find((s) => s.user_id === supervisorId);
      if (supervisor && supervisor.manager_id) {
        await updateUserLeadership(staffId, {
          managerId: supervisor.manager_id,
        });
      }

      Alert.alert('Success', 'Staff assigned successfully');
      setStaffId('');
      setZoneId('');
      setSupervisorId('');
      await loadAll();
    } catch (error) {
      const errorMessage = error.message || 'Failed to assign staff';
      Alert.alert('Error', errorMessage);
      console.error('Assignment error:', error);
    }
  };

  // Load zones when supervisor is selected
  useEffect(() => {
    const loadZonesForSupervisor = async () => {
      if (!supervisorId) {
        setZones([]);
        setZoneId('');
        return;
      }

      try {
        // Get locations assigned to this supervisor
        const supervisorLocationIds = supLocs
          .filter(sl => sl.supervisor_id === supervisorId)
          .map(sl => sl.nc_location_id);

        if (supervisorLocationIds.length === 0) {
          setZones([]);
          setZoneId('');
          return;
        }

        // Fetch zones for all locations assigned to this supervisor
        const allZones = [];
        for (const locationId of supervisorLocationIds) {
          try {
            const locationZones = await fetchZones(locationId);
            allZones.push(...locationZones);
          } catch (error) {
            console.error(`Error loading zones for location ${locationId}:`, error);
          }
        }

        setZones(allZones);
        if (allZones.length > 0 && !zoneId) {
          // Optionally set first zone as default
          // setZoneId(allZones[0].id);
        }
      } catch (error) {
        console.error('Error loading zones:', error);
        setZones([]);
      }
    };

    loadZonesForSupervisor();
  }, [supervisorId, supLocs]);

  const handleAssignSupLoc = async () => {
    if (!supLocSupervisorId || !supLocLocationId) {
      Alert.alert('Error', 'Please select supervisor and location');
      return;
    }
    
    // For managers, validate that supervisor belongs to their department
    if (isManagerOnly && currentManagerDepartment) {
      const selectedSupervisor = supervisors.find((s) => s.user_id === supLocSupervisorId);
      if (selectedSupervisor) {
        const supervisorDept = selectedSupervisor.department || managerDepartmentMap[selectedSupervisor.manager_id] || null;
        if (supervisorDept !== currentManagerDepartment) {
          Alert.alert('Error', 'You can only assign supervisors from your department');
          return;
        }
      }
    }
    
    try {
      await assignSupervisorToLocation({ supervisor_id: supLocSupervisorId, nc_location_id: supLocLocationId });
      Alert.alert('Success', 'Supervisor assigned to location');
      setSupLocSupervisorId('');
      setSupLocLocationId('');
      await loadAll();
    } catch (error) {
      const errorMessage = error.message || 'Failed to assign supervisor';
      Alert.alert('Error', errorMessage);
      console.error('Supervisor assignment error:', error);
    }
  };

  const handleRemoveSupLoc = async (id) => {
    const mapping = supLocs.find(m => m.id === id);
    const supervisorName = mapping ? supervisors.find((s) => s.user_id === mapping.supervisor_id)?.name || 'this supervisor' : 'this supervisor';
    const locationName = mapping ? locations.find((l) => l.id === mapping.nc_location_id)?.name || 'this location' : 'this location';

    Alert.alert(
      'Remove Supervisor-Location Mapping',
      `Are you sure you want to remove ${supervisorName} from ${locationName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await unassignSupervisorFromLocation(id);
              Alert.alert('Success', 'Supervisor unassigned from location');
              await loadAll();
            } catch (error) {
              Alert.alert('Error', 'Failed to unassign supervisor');
              console.error(error);
            }
          }
        }
      ]
    );
  };

  const handleUnassign = async (id) => {
    const assignment = assignments.find(a => a.id === id);
    const staffMember = assignment ? staff.find((s) => s.user_id === assignment.staff_id) : null;
    const staffName = staffMember 
      ? `${staffMember.name || staffMember.email || 'this staff member'}${staffMember.empNo ? ` (ID: ${staffMember.empNo})` : ''}`
      : 'this staff member';
    const supervisorName = assignment ? supervisors.find((s) => s.user_id === assignment.supervisor_id)?.name || 'this supervisor' : 'this supervisor';
    const locationName = assignment ? locations.find((l) => l.id === assignment.nc_location_id)?.name || 'this location' : 'this location';

    Alert.alert(
      'Remove Assignment',
      `Are you sure you want to remove the assignment of ${staffName} under ${supervisorName} at ${locationName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await unassignStaff(id);
              Alert.alert('Success', 'Staff unassigned successfully');
              await loadAll();
            } catch (error) {
              Alert.alert('Error', 'Failed to unassign staff');
              console.error(error);
            }
          }
        }
      ]
    );
  };

  // Get current user role and department early (needed for filtering)
  const currentUserId =
    profile?.user_id ||
    profile?.objectId ||
    profile?.id ||
    profile?.userId ||
    profile?.user?.id ||
    null;

  const currentRole = normalizeRole(profile?.role) || ROLE.STAFF;
  const isManagerOnly = currentRole === ROLE.MANAGER;
  
  // Get current manager's department
  const currentManagerDepartment = isManagerOnly
    ? (profile?.department || 
       managers.find((m) => m.user_id === currentUserId)?.department || 
       null)
    : null;

  // Filter assignments based on search query and department (for managers)
  const filteredAssignments = assignments.filter(assignment => {
    // For managers, only show assignments from their department
    if (isManagerOnly && currentManagerDepartment) {
      const assignmentStaff = staff.find((s) => s.user_id === assignment.staff_id);
      const assignmentSupervisor = supervisors.find((s) => s.user_id === assignment.supervisor_id);
      const staffDept = assignmentStaff?.department || null;
      const supervisorDept = assignmentSupervisor?.department || managerDepartmentMap[assignmentSupervisor?.manager_id] || null;
      
      // Only show if staff or supervisor belongs to manager's department
      if (staffDept !== currentManagerDepartment && supervisorDept !== currentManagerDepartment) {
        return false;
      }
    }
    
    if (!assignmentsSearchQuery) return true;
    const query = assignmentsSearchQuery.toLowerCase();
    const staffMember = staff.find((s) => s.user_id === assignment.staff_id);
    const staffName = staffMember 
      ? `${staffMember.name || staffMember.email || ''}${staffMember.empNo ? ` (ID: ${staffMember.empNo})` : ''}`
      : '';
    const supervisorName = supervisors.find((s) => s.user_id === assignment.supervisor_id)?.name || '';
    const locationName = locations.find((l) => l.id === assignment.nc_location_id)?.name || '';
    return (
      staffName.toLowerCase().includes(query) ||
      supervisorName.toLowerCase().includes(query) ||
      locationName.toLowerCase().includes(query)
    );
  });

  // Filter supervisor locations based on search query and department (for managers)
  const filteredSupLocs = supLocs.filter(mapping => {
    // For managers, only show supervisor locations from their department
    if (isManagerOnly && currentManagerDepartment) {
      const mappingSupervisor = supervisors.find((s) => s.user_id === mapping.supervisor_id);
      const supervisorDept = mappingSupervisor?.department || managerDepartmentMap[mappingSupervisor?.manager_id] || null;
      if (supervisorDept !== currentManagerDepartment) {
        return false;
      }
    }
    
    if (!supLocsSearchQuery) return true;
    const query = supLocsSearchQuery.toLowerCase();
    const supervisorName = supervisors.find((s) => s.user_id === mapping.supervisor_id)?.name || '';
    const locationName = locations.find((l) => l.id === mapping.nc_location_id)?.name || '';
    return (
      supervisorName.toLowerCase().includes(query) ||
      locationName.toLowerCase().includes(query)
    );
  });

  // Pagination calculations for assignments
  const assignmentsTotalPages = Math.ceil(filteredAssignments.length / itemsPerPage);
  const assignmentsStartIndex = (assignmentsPage - 1) * itemsPerPage;
  const assignmentsEndIndex = assignmentsStartIndex + itemsPerPage;
  const paginatedAssignments = filteredAssignments.slice(assignmentsStartIndex, assignmentsEndIndex);

  // Pagination calculations for supervisor locations
  const supLocsTotalPages = Math.ceil(filteredSupLocs.length / itemsPerPage);
  const supLocsStartIndex = (supLocsPage - 1) * itemsPerPage;
  const supLocsEndIndex = supLocsStartIndex + itemsPerPage;
  const paginatedSupLocs = filteredSupLocs.slice(supLocsStartIndex, supLocsEndIndex);

  // Reset pagination when search query changes
  React.useEffect(() => {
    setAssignmentsPage(1);
  }, [assignmentsSearchQuery]);

  React.useEffect(() => {
    setSupLocsPage(1);
  }, [supLocsSearchQuery]);

  const assignedSupervisorIds = new Set(
    Object.keys(supervisorManagerMap || {})
  );
  const assignedStaffIds = new Set(
    (assignments || []).map((assignment) => assignment.staff_id).filter((id) => !!id)
  );

  const generalManagerOptions = generalManagers.map((gm) => ({
    label: gm.full_name || gm.name || gm.email || 'General Manager',
    value: gm.user_id,
  }));

  const managerOptions = managers.map((manager) => ({
    label: `${manager.full_name || manager.name || manager.email || 'Manager'} (${getDepartmentLabel(manager.department)})`,
    value: manager.user_id,
  }));

  const selectedManagerDepartment =
    selectedManagerForSupervisor
      ? managerDepartmentMap[selectedManagerForSupervisor] ||
        managers.find((manager) => manager.user_id === selectedManagerForSupervisor)?.department ||
        null
      : null;

  const supervisorOptions = supervisors.filter((supervisor) => {
    if (assignedSupervisorIds.has(supervisor.user_id)) {
      return false;
    }
    if (selectedManagerDepartment) {
      const supervisorDepartment = supervisor.department || managerDepartmentMap[supervisor.manager_id] || null;
      if (supervisorDepartment && supervisorDepartment !== selectedManagerDepartment) {
        return false;
      }
    }

    if (!selectedManagerDepartment && staffDepartmentFilter !== ALL_DEPARTMENTS_OPTION.id) {
      const supervisorDepartment = supervisor.department || managerDepartmentMap[supervisor.manager_id] || null;
      return supervisorDepartment === staffDepartmentFilter || supervisorDepartment === null;
    }

    return true;
  });

  const supervisorDropdownOptions = supervisorOptions.map((supervisor) => ({
    label: `${supervisor.name || supervisor.email} (${getDepartmentLabel(
      supervisor.department || managerDepartmentMap[supervisor.manager_id] || null
    )})`,
    value: supervisor.user_id,
  }));

  const supervisorOptionsForStaff = supervisors
    .filter((supervisor) => {
      // For managers, only show supervisors from their department
      if (isManagerOnly && currentManagerDepartment) {
        const supervisorDepartment = supervisor.department || managerDepartmentMap[supervisor.manager_id] || null;
        if (supervisorDepartment !== currentManagerDepartment) {
          return false;
        }
      }
      
      // For General Managers and CEO/Super Admin, apply department filter if set
      if (!isManagerOnly) {
        if (staffDepartmentFilter === ALL_DEPARTMENTS_OPTION.id) {
          return true;
        }
        const supervisorDepartment = supervisor.department || managerDepartmentMap[supervisor.manager_id] || null;
        return supervisorDepartment === staffDepartmentFilter || supervisorDepartment === null;
      }
      
      return true;
    })
    .map((supervisor) => ({
      label: `${supervisor.name || supervisor.email} (${getDepartmentLabel(
        supervisor.department || managerDepartmentMap[supervisor.manager_id] || null
      )})`,
      value: supervisor.user_id,
    }));

  const staffOptions = staff.filter((member) => {
    // For managers, only show staff from their department
    if (isManagerOnly && currentManagerDepartment) {
      if ((member.department || null) !== currentManagerDepartment) {
        return false;
      }
    }
    
    // Filter out staff who are already assigned to any location
    if (!Array.isArray(assignments) || assignments.length === 0) {
      // No assignments exist, so all staff are available (subject to department filter)
    } else {
      // Check if this staff member has any existing assignment to any location
      const hasExistingAssignment = assignments.some(
        (assignment) => assignment.staff_id === member.user_id
      );
      if (hasExistingAssignment) {
        return false;
      }
    }
    
    // Apply department filter
    if (isManagerOnly) {
      // Managers are already filtered by their department above
      return true;
    }
    // For General Managers and CEO/Super Admin, apply department filter if set
    if (staffDepartmentFilter === ALL_DEPARTMENTS_OPTION.id) {
      return true;
    }
    return (member.department || null) === staffDepartmentFilter || member.department == null;
  }).map((member) => ({
    label: `${member.name || member.email}${member.empNo ? ` (ID: ${member.empNo})` : ''} (${getDepartmentLabel(member.department || null)})`,
    value: member.user_id,
    empNo: member.empNo || null,
    name: member.name || member.email,
  }));

  const getGeneralManagerName = (deptId) => {
    const gmId = gmAssignments[deptId];
    if (!gmId) {
      return 'Unassigned';
    }
    const gm = generalManagers.find((manager) => manager.user_id === gmId);
    return gm?.full_name || gm?.name || gm?.email || 'Unassigned';
  };

  // currentRole, isManagerOnly, and currentManagerDepartment are already defined earlier
  const canAccessAssignments = isAtLeastRole(currentRole, ROLE.MANAGER);
  const isCeoOrSuperAdmin = isAtLeastRole(currentRole, ROLE.CEO);
  const isGeneralManagerOrAbove = isAtLeastRole(currentRole, ROLE.GENERAL_MANAGER);
  const isGeneralManager = currentRole === ROLE.GENERAL_MANAGER;

  if (!canAccessAssignments) {
     return (
       <View style={styles.container}>
         <Text style={styles.errorText}>Access denied. Executive access only.</Text>
       </View>
     );
   }
 
  // Visibility logic: Higher roles see all sections from lower roles
  // Manager: Staff Assignments, Assign Supervisor to Location
  // General Manager: Everything Manager sees + General Manager Departments + Supervisor Hierarchy
  // CEO/Super Admin: Everything (all sections)
  const isManagerOrAbove = isAtLeastRole(currentRole, ROLE.MANAGER);
  const shouldShowFullManagementTools = isGeneralManagerOrAbove && !isCeoOrSuperAdmin;
  const showSupervisorHierarchySection = isGeneralManagerOrAbove; // GM, CEO, Super Admin
  const showGeneralManagerDepartments = isGeneralManagerOrAbove; // GM, CEO, Super Admin
  const showStaffAssignmentTools = isManagerOrAbove; // Manager, GM, CEO, Super Admin
  const hierarchyManagers = isManagerOnly
    ? managers.filter((manager) => manager.user_id === currentUserId)
    : managers;
  const supervisorDisplayByManager = hierarchyManagers.map((manager) => {
    const managerSupervisors = supervisors.filter((supervisor) => {
      const assignedManagerId =
        supervisor.manager_id ||
        supervisorManagerMap[supervisor.user_id] ||
        null;
      return assignedManagerId === manager.user_id;
    });
    return { manager, supervisors: managerSupervisors };
  });
  const getManagerDepartmentLabel = (manager) =>
    getDepartmentLabel(manager.department || managerDepartmentMap[manager.user_id] || null);

   return (
     <ScrollView style={styles.container}>
     {showGeneralManagerDepartments && (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>General Manager Departments</Text>
        {DEPARTMENTS.map((dept) => (
          <View key={dept.id} style={styles.pickerContainer}>
            <Text style={styles.pickerLabel}>{dept.label}</Text>
            <SimpleDropdown
              options={[
                { label: 'Unassigned', value: '' },
                ...generalManagerOptions,
              ]}
              selectedValue={gmAssignments[dept.id] || ''}
              onValueChange={(value) =>
                setGmAssignments((prev) => ({
                  ...prev,
                  [dept.id]: value || null,
                }))
              }
              placeholder="Select general manager"
              style={styles.pickerWrapper}
            />
            <Text style={styles.helperText}>
              Current: {getGeneralManagerName(dept.id)}
            </Text>
          </View>
        ))}
        <TouchableOpacity
          style={[styles.assignButton, savingGeneralManagers && styles.disabledButton]}
          onPress={handleSaveGeneralManagerAssignments}
          disabled={savingGeneralManagers}
        >
          <Text style={styles.assignButtonText}>
            {savingGeneralManagers ? 'Saving...' : 'Save General Manager Assignments'}
          </Text>
        </TouchableOpacity>
        </View>
      )}

      {showSupervisorHierarchySection && (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Supervisor Hierarchy</Text>

        <View style={styles.pickerContainer}>
          <Text style={styles.pickerLabel}>Manager</Text>
          <SimpleDropdown
            options={[{ label: 'Select manager', value: '' }, ...managerOptions]}
            selectedValue={selectedManagerForSupervisor}
            onValueChange={(value) => {
              setSelectedManagerForSupervisor(value);
              setSelectedSupervisorForManager('');
            }}
            placeholder="Select manager"
            style={styles.pickerWrapper}
          />
        </View>

        <View style={styles.pickerContainer}>
          <Text style={styles.pickerLabel}>Supervisor</Text>
          <SimpleDropdown
            options={[{ label: 'Select supervisor', value: '' }, ...supervisorDropdownOptions]}
            selectedValue={selectedSupervisorForManager}
            onValueChange={setSelectedSupervisorForManager}
            placeholder={selectedManagerForSupervisor ? 'Select supervisor' : 'Pick a manager first'}
            style={styles.pickerWrapper}
            disabled={!selectedManagerForSupervisor}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.assignButton,
            (!selectedManagerForSupervisor || !selectedSupervisorForManager) && styles.disabledButton,
          ]}
          onPress={handleAssignSupervisorToManager}
          disabled={!selectedManagerForSupervisor || !selectedSupervisorForManager || assigningSupervisor}
        >
          <Text style={styles.assignButtonText}>
            {assigningSupervisor ? 'Assigning...' : 'Assign Supervisor'}
          </Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <View style={styles.managerHierarchyList}>
          {supervisorDisplayByManager.length === 0 ? (
            <Text style={styles.helperText}>No managers available.</Text>
          ) : (
            supervisorDisplayByManager.map(({ manager, supervisors: managerSupervisors }) => (
              <View key={manager.user_id} style={styles.managerGroup}>
                <Text style={styles.managerTitle}>
                  {manager.full_name || manager.name || manager.email || 'Manager'} •{' '}
                  {getManagerDepartmentLabel(manager) || 'Unassigned'}
                </Text>
                {managerSupervisors.length === 0 ? (
                  <Text style={styles.helperText}>No supervisors assigned</Text>
                ) : (
                  managerSupervisors.map((supervisor) => (
                    <View key={supervisor.user_id} style={styles.assignmentItem}>
                      <View style={styles.assignmentInfo}>
                        <Text style={styles.assignmentText}>{supervisor.name || supervisor.email}</Text>
                        <Text style={styles.helperText}>
                          Department:{' '}
                          {getDepartmentLabel(
                            supervisor.department ||
                              managerDepartmentMap[supervisor.manager_id] ||
                              null
                          )}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => handleUnassignSupervisorFromManager(supervisor.user_id)}
                      >
                        <Text style={styles.removeButtonText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            ))
          )}
        </View>
      </View>
      )}

      {showStaffAssignmentTools && (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Staff Assignments</Text>

        {/* Hide department filter for managers - they can only see their own department */}
        {!isManagerOnly && (
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerLabel}>Filter by Department</Text>
            <SimpleDropdown
              options={[ALL_DEPARTMENTS_OPTION, ...DEPARTMENTS].map((dept) => ({
                label: dept.label,
                value: dept.id,
              }))}
              selectedValue={staffDepartmentFilter}
              onValueChange={setStaffDepartmentFilter}
              placeholder="Select department"
              style={styles.pickerWrapper}
            />
          </View>
        )}
        {isManagerOnly && currentManagerDepartment && (
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerLabel}>Department</Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                {getDepartmentLabel(currentManagerDepartment)}
              </Text>
              <Text style={styles.infoSubtext}>You can only manage staff from your department</Text>
            </View>
          </View>
        )}

        <View style={styles.pickerContainer}>
          <Text style={styles.pickerLabel}>Staff</Text>
          <SearchableDropdown
            options={[{ label: 'Select staff', value: '' }, ...staffOptions]}
            selectedValue={staffId}
            onValueChange={setStaffId}
            placeholder="Select staff"
            style={styles.pickerWrapper}
            searchPlaceholder="Search by name or employee ID..."
            getSearchText={(option) => {
              if (!option || option.value === '') return '';
              const name = option.name || option.label || '';
              const empNo = option.empNo ? String(option.empNo) : '';
              return `${name} ${empNo}`.toLowerCase();
            }}
          />
        </View>

        <View style={styles.pickerContainer}>
          <Text style={styles.pickerLabel}>Assign to Supervisor</Text>
          <SimpleDropdown
            options={[{ label: 'Select supervisor', value: '' }, ...supervisorOptionsForStaff]}
            selectedValue={supervisorId}
            onValueChange={setSupervisorId}
            placeholder="Select supervisor"
            style={styles.pickerWrapper}
          />
        </View>
 
        <View style={styles.pickerContainer}>
          <Text style={styles.pickerLabel}>Zone</Text>
          <SearchableDropdown
            options={[
              { label: 'Select zone', value: '' },
              ...zones.map((z) => ({ 
                label: `${z.name} (${z.location_name})`, 
                value: z.id, 
                locationName: z.location_name || '' 
              }))
            ]}
            selectedValue={zoneId}
            onValueChange={setZoneId}
            placeholder={supervisorId ? (zones.length === 0 ? 'No zones available for this supervisor' : 'Select zone') : 'Select supervisor first'}
            style={styles.pickerWrapper}
            disabled={!supervisorId || zones.length === 0}
            searchPlaceholder="Search by zone name..."
            getSearchText={(option) => {
              if (!option || option.value === '') return '';
              const name = option.label || '';
              const locationName = option.locationName || '';
              return `${name} ${locationName}`.toLowerCase();
            }}
          />
          {supervisorId && zones.length === 0 && (
            <Text style={styles.helperText}>
              No zones found. Make sure the supervisor is assigned to a location and zones are created for that location.
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.assignButton, (!supervisorId || !staffId || !zoneId) && styles.disabledButton]}
          onPress={handleAssign}
          disabled={!supervisorId || !staffId || !zoneId || loading}
        >
          <Text style={styles.assignButtonText}>Assign</Text>
        </TouchableOpacity>
      </View>
      )}

      {showStaffAssignmentTools && (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Assign Supervisor to Location</Text>

        <View style={styles.pickerContainer}>
          <Text style={styles.pickerLabel}>Supervisor</Text>
          <SimpleDropdown
            options={[
              { label: 'Select supervisor', value: '' },
              ...supervisors
                .filter((s) => {
                  // For managers, only show supervisors from their department
                  if (isManagerOnly && currentManagerDepartment) {
                    const supervisorDepartment = s.department || managerDepartmentMap[s.manager_id] || null;
                    if (supervisorDepartment !== currentManagerDepartment) {
                      return false;
                    }
                  }
                  
                  // For General Managers and CEO/Super Admin, show all supervisors
                  // (no department filtering needed here as they can manage all)
                  
                  // Filter out supervisors who are already assigned to any location
                  if (!Array.isArray(supLocs) || supLocs.length === 0) {
                    return true;
                  }
                  // Check if this supervisor has any existing location assignment
                  const hasExistingAssignment = supLocs.some(
                    (mapping) => mapping.supervisor_id === s.user_id
                  );
                  return !hasExistingAssignment;
                })
                .map((s) => ({
                  label: `${s.name || s.email} (${getDepartmentLabel(
                    s.department || managerDepartmentMap[s.manager_id] || null
                  )})`,
                  value: s.user_id,
                })),
            ]}
            selectedValue={supLocSupervisorId}
            onValueChange={setSupLocSupervisorId}
            placeholder="Select supervisor"
            style={styles.pickerWrapper}
          />
        </View>

        <View style={styles.pickerContainer}>
          <Text style={styles.pickerLabel}>Location</Text>
          <SearchableDropdown
            options={[
              { label: 'Select location', value: '' },
              ...locations.map((l) => ({ label: l.name, value: l.id, code: l.code || '' }))
            ]}
            selectedValue={supLocLocationId}
            onValueChange={setSupLocLocationId}
            placeholder="Select location"
            style={styles.pickerWrapper}
            searchPlaceholder="Search by location name..."
            getSearchText={(option) => {
              if (!option || option.value === '') return '';
              const name = option.label || '';
              const code = option.code || '';
              return `${name} ${code}`.toLowerCase();
            }}
          />
        </View>

        <TouchableOpacity
          style={[styles.assignButton, (!supLocSupervisorId || !supLocLocationId) && styles.disabledButton]}
          onPress={handleAssignSupLoc}
          disabled={!supLocSupervisorId || !supLocLocationId || loading}
        >
          <Text style={styles.assignButtonText}>Assign</Text>
        </TouchableOpacity>
      </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Assignments</Text>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={assignmentsSearchQuery}
            onChangeText={setAssignmentsSearchQuery}
            placeholder="Search by staff, supervisor, or location..."
            placeholderTextColor="#999"
          />
        </View>

        {assignments.length === 0 ? (
          <Text style={styles.emptyText}>No assignments yet</Text>
        ) : filteredAssignments.length === 0 ? (
          <Text style={styles.emptyText}>No assignments found</Text>
        ) : (
          <>
            {paginatedAssignments.map((assignment) => (
              <View key={assignment.id} style={styles.assignmentItem}>
                <View style={styles.assignmentInfo}>
                  <Text style={styles.assignmentText}>
                    <Text style={styles.label}>Supervisor:</Text> {supervisors.find((s) => s.user_id === assignment.supervisor_id)?.name || '—'}
                  </Text>
                  <Text style={styles.assignmentText}>
                    <Text style={styles.label}>Staff:</Text> {(() => {
                      const staffMember = staff.find((s) => s.user_id === assignment.staff_id);
                      if (!staffMember) return '—';
                      const name = staffMember.name || staffMember.email || '—';
                      const empNo = staffMember.empNo ? ` (ID: ${staffMember.empNo})` : '';
                      return `${name}${empNo}`;
                    })()}
                  </Text>
                  <Text style={styles.assignmentText}>
                    <Text style={styles.label}>Zone:</Text> {assignment.zone_name || '—'}
                  </Text>
                  <Text style={styles.assignmentText}>
                    <Text style={styles.label}>Location:</Text> {assignment.location_name || '—'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleUnassign(assignment.id)}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Pagination Controls for Assignments */}
            {assignmentsTotalPages > 1 && (
              <View style={styles.paginationContainer}>
                <TouchableOpacity
                  style={[styles.paginationButton, assignmentsPage === 1 && styles.paginationButtonDisabled]}
                  onPress={() => setAssignmentsPage(prev => Math.max(1, prev - 1))}
                  disabled={assignmentsPage === 1}
                >
                  <Text style={[styles.paginationButtonText, assignmentsPage === 1 && styles.paginationButtonTextDisabled]}>
                    Previous
                  </Text>
                </TouchableOpacity>

                <View style={styles.paginationInfo}>
                  <Text style={styles.paginationText}>
                    Page {assignmentsPage} of {assignmentsTotalPages}
                  </Text>
                  <Text style={styles.paginationSubtext}>
                    ({filteredAssignments.length} total)
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.paginationButton, assignmentsPage === assignmentsTotalPages && styles.paginationButtonDisabled]}
                  onPress={() => setAssignmentsPage(prev => Math.min(assignmentsTotalPages, prev + 1))}
                  disabled={assignmentsPage === assignmentsTotalPages}
                >
                  <Text style={[styles.paginationButtonText, assignmentsPage === assignmentsTotalPages && styles.paginationButtonTextDisabled]}>
                    Next
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Supervisor Location Mappings</Text>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={supLocsSearchQuery}
            onChangeText={setSupLocsSearchQuery}
            placeholder="Search by supervisor or location..."
            placeholderTextColor="#999"
          />
        </View>

        {supLocs.length === 0 ? (
          <Text style={styles.emptyText}>No mappings yet</Text>
        ) : filteredSupLocs.length === 0 ? (
          <Text style={styles.emptyText}>No mappings found</Text>
        ) : (
          <>
            {paginatedSupLocs.map((mapping) => (
              <View key={mapping.id} style={styles.assignmentItem}>
                <View style={styles.assignmentInfo}>
                  <Text style={styles.assignmentText}>
                    <Text style={styles.label}>Supervisor:</Text> {supervisors.find((s) => s.user_id === mapping.supervisor_id)?.name || '—'}
                  </Text>
                  <Text style={styles.assignmentText}>
                    <Text style={styles.label}>Location:</Text> {locations.find((l) => l.id === mapping.nc_location_id)?.name || '—'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveSupLoc(mapping.id)}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Pagination Controls for Supervisor Locations */}
            {supLocsTotalPages > 1 && (
              <View style={styles.paginationContainer}>
                <TouchableOpacity
                  style={[styles.paginationButton, supLocsPage === 1 && styles.paginationButtonDisabled]}
                  onPress={() => setSupLocsPage(prev => Math.max(1, prev - 1))}
                  disabled={supLocsPage === 1}
                >
                  <Text style={[styles.paginationButtonText, supLocsPage === 1 && styles.paginationButtonTextDisabled]}>
                    Previous
                  </Text>
                </TouchableOpacity>

                <View style={styles.paginationInfo}>
                  <Text style={styles.paginationText}>
                    Page {supLocsPage} of {supLocsTotalPages}
                  </Text>
                  <Text style={styles.paginationSubtext}>
                    ({filteredSupLocs.length} total)
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.paginationButton, supLocsPage === supLocsTotalPages && styles.paginationButtonDisabled]}
                  onPress={() => setSupLocsPage(prev => Math.min(supLocsTotalPages, prev + 1))}
                  disabled={supLocsPage === supLocsTotalPages}
                >
                  <Text style={[styles.paginationButtonText, supLocsPage === supLocsTotalPages && styles.paginationButtonTextDisabled]}>
                    Next
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 15,
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  pickerContainer: {
    marginBottom: 16,
  },
  pickerLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  assignButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  assignButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#B9C1D1',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e5e5',
    marginVertical: 12,
  },
  managerGroup: {
    marginTop: 16,
  },
  managerHierarchyList: {
    marginTop: 12,
  },
  managerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  assignmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  assignmentInfo: {
    flex: 1,
  },
  assignmentText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  label: {
    fontWeight: 'bold',
  },
  removeButton: {
    backgroundColor: '#ff3b30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  removeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
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
  infoBox: {
    backgroundColor: '#f0f7ff',
    borderWidth: 1,
    borderColor: '#b3d9ff',
    borderRadius: 8,
    padding: 12,
  },
  infoText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0066cc',
    marginBottom: 4,
  },
  infoSubtext: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
});

export default AssignmentsScreen;
