import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DEPARTMENTS } from '../lib/departments';

const DepartmentFilter = ({ selectedDepartment, onDepartmentChange }) => {
  const departments = [
    { id: 'all', label: 'All' },
    ...DEPARTMENTS
  ];

  return (
    <View style={styles.container}>
      {departments.map((dept) => (
        <TouchableOpacity
          key={dept.id}
          style={[
            styles.button,
            selectedDepartment === dept.id && styles.buttonActive
          ]}
          onPress={() => onDepartmentChange(dept.id)}
        >
          <Text style={[
            styles.buttonText,
            selectedDepartment === dept.id && styles.buttonTextActive
          ]}>
            {dept.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
    minWidth: 80,
    alignItems: 'center',
  },
  buttonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  buttonTextActive: {
    color: 'white',
  },
});

export default DepartmentFilter;

