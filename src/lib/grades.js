export const GRADES = [
  { id: '11', gradeId: 11, label: 'M - 1', description: 'M - 1' },
  { id: '12', gradeId: 12, label: 'M - 2', description: 'M - 2' },
  { id: '13', gradeId: 13, label: 'M - 3', description: 'M - 3' },
  { id: '14', gradeId: 14, label: 'M - 4', description: 'M - 4' },
  { id: '15', gradeId: 15, label: 'M - 5', description: 'M - 5' },
  { id: '16', gradeId: 16, label: 'M - 6', description: 'M - 6' },
  { id: '17', gradeId: 17, label: 'M - 7', description: 'M - 7' },
  { id: '18', gradeId: 18, label: 'M - 8', description: 'M - 8' },
  { id: '19', gradeId: 19, label: 'S - 1', description: 'S - 1' },
  { id: '20', gradeId: 20, label: 'S - 2', description: 'S - 2' },
  { id: '21', gradeId: 21, label: 'S - 3', description: 'S - 3' },
  { id: '22', gradeId: 22, label: 'S - 4', description: 'S - 4' },
  { id: '23', gradeId: 23, label: 'Contingent', description: 'CONTINGENT' },
  { id: '24', gradeId: 24, label: 'Internship', description: 'INTERNSHIP' },
  { id: '25', gradeId: 25, label: 'N/A', description: 'N/A' },
  { id: '26', gradeId: 26, label: 'Stream', description: 'STREAM' },
  { id: '27', gradeId: 27, label: 'COVID-19', description: 'COVID-19' },
  { id: '28', gradeId: 28, label: 'BPS - 1', description: 'BPS - 1' },
  { id: '29', gradeId: 29, label: 'BPS - 2', description: 'BPS - 2' },
  { id: '30', gradeId: 30, label: 'BPS - 3', description: 'BPS - 3' },
  { id: '31', gradeId: 31, label: 'BPS - 4', description: 'BPS - 4' },
  { id: '32', gradeId: 32, label: 'BPS - 5', description: 'BPS - 5' },
  { id: '33', gradeId: 33, label: 'BPS - 6', description: 'BPS - 6' },
  { id: '34', gradeId: 34, label: 'BPS - 7', description: 'BPS - 7' },
  { id: '35', gradeId: 35, label: 'BPS - 8', description: 'BPS - 8' },
  { id: '36', gradeId: 36, label: 'BPS - 9', description: 'BPS - 9' },
  { id: '37', gradeId: 37, label: 'BPS - 10', description: 'BPS - 10' },
  { id: '38', gradeId: 38, label: 'BPS - 11', description: 'BPS - 11' },
  { id: '39', gradeId: 39, label: 'BPS - 12', description: 'BPS - 12' },
  { id: '40', gradeId: 40, label: 'BPS - 13', description: 'BPS - 13' },
  { id: '41', gradeId: 41, label: 'BPS - 14', description: 'BPS - 14' },
  { id: '42', gradeId: 42, label: 'BPS - 15', description: 'BPS - 15' },
  { id: '43', gradeId: 43, label: 'BPS - 16', description: 'BPS - 16' },
  { id: '44', gradeId: 44, label: 'BPS - 17', description: 'BPS - 17' },
  { id: '45', gradeId: 45, label: 'BPS - 18', description: 'BPS - 18' },
  { id: '46', gradeId: 46, label: 'Daily Wage', description: 'DAILY WAGE' },
  { id: '47', gradeId: 47, label: 'BPS - 19', description: 'BPS - 19' },
];

export const getGradeLabel = (gradeId) => {
  if (!gradeId) {
    return 'Unassigned';
  }
  const grade = GRADES.find((item) => item.id === String(gradeId) || item.gradeId === parseInt(gradeId));
  return grade ? grade.label : `Grade ${gradeId}`;
};

export const getGradeById = (gradeId) => {
  if (!gradeId) return null;
  const numericId = typeof gradeId === 'string' ? parseInt(gradeId) : gradeId;
  return GRADES.find((grade) => grade.gradeId === numericId || grade.id === String(gradeId));
};

export const getGradeByDescription = (description) => {
  if (!description) return null;
  return GRADES.find((grade) => 
    grade.description.toUpperCase() === description.toUpperCase() ||
    grade.label.toUpperCase() === description.toUpperCase()
  );
};

