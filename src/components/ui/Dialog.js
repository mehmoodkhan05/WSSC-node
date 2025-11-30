import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';

export const Dialog = ({ children, open, onOpenChange }) => {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={open}
      onRequestClose={() => onOpenChange(false)}
    >
      <Pressable style={styles.overlay} onPress={() => onOpenChange(false)}>
        <Pressable style={styles.dialogContent} onPress={(e) => e.stopPropagation()}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export const DialogTrigger = ({ children, asChild }) => {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onPress: children.props.onPress, // Assuming the child has an onPress
    });
  }
  return <Pressable>{children}</Pressable>;
};

export const DialogContent = ({ children, style }) => (
  <View style={[styles.contentContainer, style]}>{children}</View>
);

export const DialogHeader = ({ children, style }) => (
  <View style={[styles.header, style]}>{children}</View>
);

export const DialogTitle = ({ children, style }) => (
  <Text style={[styles.title, style]}>{children}</Text>
);

export const DialogDescription = ({ children, style }) => (
  <Text style={[styles.description, style]}>{children}</Text>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  dialogContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '90%',
    maxWidth: 600,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  contentContainer: {
    padding: 20,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  description: {
    fontSize: 14,
    color: '#666',
  },
});
