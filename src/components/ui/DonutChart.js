import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import { Svg } from 'react-native-svg'; // Explicitly import Svg

const screenWidth = Dimensions.get('window').width;

export const DonutChart = ({ data, size = 200, showLabel = true }) => {
  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    strokeWidth: 2, // optional, default 3
    barPercentage: 0.5,
    useShadowColorFromDataset: false // optional
  };

  // Handle empty or invalid data
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Text style={styles.emptyText}>No data available</Text>
      </View>
    );
  }

  const pieChartData = data
    .filter(item => item && item.name && typeof item.value === 'number')
    .map((item, index) => ({
      name: item.name,
      population: item.value || 0,
      color: item.color || '#64748b',
      legendFontColor: '#7F7F7F',
      legendFontSize: 15
    }))
    // Filter out zero values for better chart rendering
    // Dashboard ensures absent count reflects all staff when no attendance data exists
    .filter(item => item.population > 0);

  // If no segments with data, show message
  // This should only happen if there are no staff members at all
  if (pieChartData.length === 0) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Text style={styles.emptyText}>No staff data</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PieChart
        data={pieChartData}
        width={size}
        height={size}
        chartConfig={chartConfig}
        accessor="population"
        backgroundColor="transparent"
        paddingLeft="15"
        absolute={false}
        hasLegend={showLabel}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
