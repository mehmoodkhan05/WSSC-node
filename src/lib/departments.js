// Fallback hardcoded departments (used if API fails or before API loads)
export const FALLBACK_DEPARTMENTS = [
  { id: '11', deptId: 11, label: 'Administration', description: 'ADMINISTRATION' },
  { id: '12', deptId: 12, label: 'Water Supply', description: 'WATER SUPPLY' },
  { id: '13', deptId: 13, label: 'Sanitation', description: 'SANITATION' },
  { id: '14', deptId: 14, label: 'Commercial', description: 'COMMERCIAL' },
];

// Cache for departments fetched from API
let departmentsCache = null;
let departmentsCachePromise = null;

// Function to load departments from API (with caching)
export async function loadDepartmentsFromAPI() {
  // Return cached promise if already loading
  if (departmentsCachePromise) {
    return departmentsCachePromise;
  }

  // Return cache if available
  if (departmentsCache) {
    return departmentsCache;
  }

  // Fetch from API
  departmentsCachePromise = (async () => {
    try {
      const { fetchDepartments } = await import('./departmentsApi');
      const apiDepartments = await fetchDepartments();
      if (apiDepartments && apiDepartments.length > 0) {
        departmentsCache = apiDepartments;
        departmentsCachePromise = null;
        return apiDepartments;
      }
    } catch (error) {
      console.warn('Failed to load departments from API, using fallback:', error);
    }
    // Return fallback if API fails
    departmentsCache = [...FALLBACK_DEPARTMENTS];
    departmentsCachePromise = null;
    return departmentsCache;
  })();

  return departmentsCachePromise;
}

// Clear cache (useful when departments are updated)
export function clearDepartmentsCache() {
  departmentsCache = null;
  departmentsCachePromise = null;
}

// Get departments synchronously (returns cache or fallback)
// Note: This may return fallback if API hasn't loaded yet
export function getDepartmentsSync() {
  return departmentsCache || FALLBACK_DEPARTMENTS;
}

// Export fallback departments (for backward compatibility)
// IMPORTANT: Components should use loadDepartmentsFromAPI() or useDepartments() hook instead
export const DEPARTMENTS = FALLBACK_DEPARTMENTS;
export const ALL_DEPARTMENTS_OPTION = { id: 'all', label: 'All Departments' };

// Legacy department ID mappings for backward compatibility
const LEGACY_DEPARTMENT_MAP = {
  'administration': '11',
  'water_supply': '12',
  'sanitation': '13',
  'commercial': '14',
};

export const getDepartmentLabel = (departmentId, departmentsList = null) => {
  if (!departmentId) {
    return 'Unassigned';
  }
  if (departmentId === 'all') {
    return ALL_DEPARTMENTS_OPTION.label;
  }
  // Use provided list or fallback to cached/sync getter
  const deptList = departmentsList || getDepartmentsSync();
  // Handle legacy string IDs
  const normalizedId = LEGACY_DEPARTMENT_MAP[departmentId] || departmentId;
  const department = deptList.find((item) => item.id === normalizedId || item.deptId === parseInt(normalizedId));
  return department ? department.label : 'Unknown Department';
};

export const getDepartmentById = (deptId, departmentsList = null) => {
  if (!deptId) return null;
  const numericId = typeof deptId === 'string' ? parseInt(deptId) : deptId;
  const deptList = departmentsList || getDepartmentsSync();
  return deptList.find((dept) => dept.deptId === numericId || dept.id === String(deptId));
};

export const getDepartmentByDescription = (description, departmentsList = null) => {
  if (!description) return null;
  const deptList = departmentsList || getDepartmentsSync();
  return deptList.find((dept) => 
    dept.description.toUpperCase() === description.toUpperCase() ||
    dept.label.toUpperCase() === description.toUpperCase()
  );
};

