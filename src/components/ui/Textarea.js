import React from 'react';
import { TextInput, StyleSheet } from 'react-native';

export const Textarea = ({ style, ...props }) => {
  return (
    <TextInput
      style={[styles.textarea, style]}
      multiline
      textAlignVertical="top"
      placeholderTextColor="#666"
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  textarea: {
    height: 100,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
});
