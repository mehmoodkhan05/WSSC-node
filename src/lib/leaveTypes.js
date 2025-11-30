export const LEAVE_TYPES = [
  { id: '0', leaveTypeId: 0, label: 'No Leave', description: 'NO LEAVE', limit: 0 },
  { id: '1', leaveTypeId: 1, label: 'Sick Leave', description: 'SICK LEAVE', limit: 12 },
  { id: '2', leaveTypeId: 2, label: 'Annual Leave', description: 'ANNUAL LEAVE', limit: 15 },
  { id: '3', leaveTypeId: 3, label: 'Casual Leave', description: 'CASUAL LEAVE', limit: 10 },
  { id: '4', leaveTypeId: 4, label: 'Maternity Leave', description: 'MATERNITY LEAVE', limit: 90 },
  { id: '5', leaveTypeId: 5, label: 'Paternity Leave', description: 'PATERNITY LEAVE', limit: 4 },
  { id: '6', leaveTypeId: 6, label: 'Compassionate Leave', description: 'COMPASSIONTE LEAVE', limit: 5 },
  { id: '7', leaveTypeId: 7, label: 'Leave Without Pay', description: 'LEAVE WITHOUT PAY', limit: 365 },
  { id: '8', leaveTypeId: 8, label: 'Hajj/Umrah', description: 'HAJJ/UMRAH', limit: 40 },
  { id: '9', leaveTypeId: 9, label: 'TMA Earned Leave', description: 'TMA EARNED LEAVE', limit: 48 },
];

export const getLeaveTypeLabel = (leaveTypeId) => {
  if (leaveTypeId === null || leaveTypeId === undefined || leaveTypeId === '') {
    return 'Unassigned';
  }
  const leaveType = LEAVE_TYPES.find((item) => item.id === String(leaveTypeId) || item.leaveTypeId === parseInt(leaveTypeId));
  return leaveType ? leaveType.label : `Leave Type ${leaveTypeId}`;
};

export const getLeaveTypeById = (leaveTypeId) => {
  if (leaveTypeId === null || leaveTypeId === undefined || leaveTypeId === '') return null;
  const numericId = typeof leaveTypeId === 'string' ? parseInt(leaveTypeId) : leaveTypeId;
  return LEAVE_TYPES.find((lt) => lt.leaveTypeId === numericId || lt.id === String(leaveTypeId));
};

export const getLeaveTypeByDescription = (description) => {
  if (!description) return null;
  return LEAVE_TYPES.find((lt) => 
    lt.description.toUpperCase() === description.toUpperCase() ||
    lt.label.toUpperCase() === description.toUpperCase()
  );
};

export const getLeaveTypeLimit = (leaveTypeId) => {
  const leaveType = getLeaveTypeById(leaveTypeId);
  return leaveType ? leaveType.limit : null;
};

