export const DEPARTMENTS = [
  { id: '11', deptId: 11, label: 'Administration', description: 'ADMINISTRATION' },
  { id: '12', deptId: 12, label: 'Water Supply', description: 'WATER SUPPLY' },
  { id: '13', deptId: 13, label: 'Sanitation', description: 'SANITATION' },
  { id: '14', deptId: 14, label: 'Commercial', description: 'COMMERCIAL' },
];

export const ALL_DEPARTMENTS_OPTION = { id: 'all', label: 'All Departments' };

// Legacy department ID mappings for backward compatibility
const LEGACY_DEPARTMENT_MAP = {
  'administration': '11',
  'water_supply': '12',
  'sanitation': '13',
  'commercial': '14',
};

export const getDepartmentLabel = (departmentId) => {
  if (!departmentId) {
    return 'Unassigned';
  }
  if (departmentId === 'all') {
    return ALL_DEPARTMENTS_OPTION.label;
  }
  // Handle legacy string IDs
  const normalizedId = LEGACY_DEPARTMENT_MAP[departmentId] || departmentId;
  const department = DEPARTMENTS.find((item) => item.id === normalizedId || item.deptId === parseInt(normalizedId));
  return department ? department.label : 'Unknown Department';
};

export const getDepartmentById = (deptId) => {
  if (!deptId) return null;
  const numericId = typeof deptId === 'string' ? parseInt(deptId) : deptId;
  return DEPARTMENTS.find((dept) => dept.deptId === numericId || dept.id === String(deptId));
};

export const getDepartmentByDescription = (description) => {
  if (!description) return null;
  return DEPARTMENTS.find((dept) => 
    dept.description.toUpperCase() === description.toUpperCase() ||
    dept.label.toUpperCase() === description.toUpperCase()
  );
};

