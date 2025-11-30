import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';

export const Button = ({ children, onPress, variant, size, className, style, ...props }) => {
  const buttonStyles = [
    styles.button,
    variant === 'outline' && styles.buttonOutline,
    variant === 'destructive' && styles.buttonDestructive,
    size === 'sm' && styles.buttonSmall,
    style,
  ];

  const textStyles = [
    styles.buttonText,
    variant === 'outline' && styles.buttonOutlineText,
    variant === 'destructive' && styles.buttonDestructiveText,
    size === 'sm' && styles.buttonSmallText,
  ];

  return (
    <TouchableOpacity onPress={onPress} style={buttonStyles} {...props}>
      {typeof children === 'string' ? <Text style={textStyles}>{children}</Text> : children}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007bff',
  },
  buttonOutlineText: {
    color: '#007bff',
  },
  buttonDestructive: {
    backgroundColor: '#dc3545',
  },
  buttonDestructiveText: {
    color: 'white',
  },
  buttonSmall: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  buttonSmallText: {
    fontSize: 14,
  },
});
