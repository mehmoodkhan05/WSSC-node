import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const Card = ({ children, style }) => (
  <View style={[styles.card, style]}>{children}</View>
);

export const CardHeader = ({ children, style }) => (
  <View style={[styles.cardHeader, style]}>{children}</View>
);

export const CardTitle = ({ children, style }) => (
  <Text style={[styles.cardTitle, style]}>{children}</Text>
);

export const CardDescription = ({ children, style }) => (
  <Text style={[styles.cardDescription, style]}>{children}</Text>
);

export const CardContent = ({ children, style }) => (
  <View style={[styles.cardContent, style]}>{children}</View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 16,
  },
  cardHeader: {
    padding: 16,
    paddingBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  cardContent: {
    padding: 16,
    paddingTop: 8,
  },
});
