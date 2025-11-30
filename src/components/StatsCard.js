import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Feather from 'react-native-vector-icons/Feather'; // Using Feather icons as an example

const StatsCard = ({ title, value, icon: IconComponent, iconName, color = '#007AFF' }) => (
  <View style={[styles.statCard, { borderLeftColor: color }]}>
    {IconComponent && iconName && (
      <View style={[styles.iconContainer, { backgroundColor: color + '1A' }]}>
        <IconComponent name={iconName} size={24} color={color} />
      </View>
    )}
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statTitle}>{title}</Text>
  </View>
);

const styles = StyleSheet.create({
  statCard: {
    flex: 1,
    minWidth: '45%', // Adjust as needed for layout
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 12, // Added for spacing in a grid
  },
  iconContainer: {
    padding: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 14,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default StatsCard;
