import React from 'react';
import { TextInput, StyleSheet } from 'react-native';

export const Input = ({ style, ...props }) => {
  return (
    <TextInput
      style={[styles.input, style]}
      placeholderTextColor="#666"
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  input: {
    height: 44,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
});
