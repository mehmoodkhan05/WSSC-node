export const ROLE = {
  STAFF: 'staff',
  SUPERVISOR: 'supervisor',
  MANAGER: 'manager',
  GENERAL_MANAGER: 'general_manager',
  CEO: 'ceo',
  SUPER_ADMIN: 'super_admin',
};

export const ROLE_VALUES = Object.values(ROLE);

const ROLE_ORDER = ROLE_VALUES.reduce((acc, role, index) => {
  acc[role] = index;
  return acc;
}, {});

const ROLE_LABELS = {
  staff: 'Staff',
  supervisor: 'Supervisor',
  manager: 'Manager',
  general_manager: 'General Manager',
  ceo: 'Chief Executive Officer',
  super_admin: 'Super Admin',
};

export const ROLE_OPTIONS = ROLE_VALUES.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}));

export const normalizeRole = (role) => {
  if (typeof role !== 'string') {
    return null;
  }
  return role.trim().toLowerCase();
};

export const isAtLeastRole = (role, minimumRole) => {
  const normalized = normalizeRole(role);
  const normalizedMinimum = normalizeRole(minimumRole);
  if (!normalized || !normalizedMinimum) {
    return false;
  }
  const currentOrder = ROLE_ORDER[normalized];
  const minimumOrder = ROLE_ORDER[normalizedMinimum];
  if (typeof currentOrder !== 'number' || typeof minimumOrder !== 'number') {
    return false;
  }
  return currentOrder >= minimumOrder;
};

export const hasFullControl = (role) => isAtLeastRole(role, ROLE.CEO);

export const hasExecutivePrivileges = (role) => isAtLeastRole(role, ROLE.GENERAL_MANAGER);

export const hasManagementPrivileges = (role) => isAtLeastRole(role, ROLE.MANAGER);

export const hasFieldLeadershipPrivileges = (role) => isAtLeastRole(role, ROLE.SUPERVISOR);

export const getRoleLabel = (role) => {
  const normalized = normalizeRole(role);
  return ROLE_LABELS[normalized] || 'Unknown';
};

