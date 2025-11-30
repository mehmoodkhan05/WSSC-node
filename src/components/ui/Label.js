import React from 'react';
import { Text, StyleSheet } from 'react-native';

export const Label = ({ children, style, ...props }) => {
  return (
    <Text style={[styles.label, style]} {...props}>
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    fontWeight: '500',
  },
});
