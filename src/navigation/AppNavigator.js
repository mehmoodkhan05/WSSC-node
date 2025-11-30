import React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// Import screens
import SignInScreen from '../screens/SignInScreen';
import DashboardScreen from '../screens/DashboardScreen';
import MarkAttendanceScreen from '../screens/MarkAttendanceScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LeaveManagementScreen from '../screens/LeaveManagementScreen';
import ApprovalsScreen from '../screens/ApprovalsScreen';
import ReportsScreen from '../screens/ReportsScreen';
import PhotoReviewScreen from '../screens/PhotoReviewScreen';
import PerformanceReviewScreen from '../screens/PerformanceReviewScreen';
import MapScreen from '../screens/MapScreen';
import LiveTrackingScreen from '../screens/LiveTrackingScreen';
import AssignmentsScreen from '../screens/AssignmentsScreen';
import UsersScreen from '../screens/UsersScreen';
import LocationsScreen from '../screens/LocationsScreen';
// Import auth context
import { AuthProvider, useAuth } from '../contexts/AuthContext';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Role-based tab configuration
const getTabScreens = (role) => {
  const commonScreens = [
    {
      name: "Dashboard",
      component: DashboardScreen,
      label: 'Dashboard',
      icon: '📊',
    },
    {
      name: "Attendance",
      component: MarkAttendanceScreen,
      label: 'Attendance',
      icon: '⏰',
    },
    {
      name: "Settings",
      component: SettingsScreen,
      label: 'Settings',
      icon: '⚙️',
    },
  ];

  // All additional screens are now accessible through Settings
  return commonScreens;
};

// Tab Navigator for authenticated users
function TabNavigator() {
  const { profile } = useAuth();
  const role = profile?.role || 'staff';
  const tabScreens = getTabScreens(role);

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        headerShown: false,
      }}
    >
      {tabScreens.map((screen) => (
        <Tab.Screen
          key={screen.name}
          name={screen.name}
          component={screen.component}
          options={{
            tabBarLabel: screen.label,
            tabBarIcon: ({ color, size }) => (
              <Text style={{ color, fontSize: size }}>{screen.icon}</Text>
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

// Main Stack Navigator
function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="MainTabs" component={TabNavigator} />
        ) : (
          <Stack.Screen name="SignIn" component={SignInScreen} />
        )}
        {/* Add all screens to stack for navigation from Settings */}
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="LeaveManagement" component={LeaveManagementScreen} options={{ headerShown: true, title: 'Leave Management' }} />
        <Stack.Screen name="Approvals" component={ApprovalsScreen} options={{ headerShown: true, title: 'Approvals' }} />
        <Stack.Screen name="Reports" component={ReportsScreen} options={{ headerShown: true, title: 'Reports' }} />
        <Stack.Screen name="PhotoReview" component={PhotoReviewScreen} options={{ headerShown: true, title: 'Photo Review' }} />
        <Stack.Screen name="PerformanceReview" component={PerformanceReviewScreen} options={{ headerShown: true, title: 'Performance Review' }} />
        <Stack.Screen name="Map" component={MapScreen} options={{ headerShown: true, title: 'Locations Map' }} />
        <Stack.Screen name="LiveTracking" component={LiveTrackingScreen} options={{ headerShown: true, title: 'Map' }} />
        <Stack.Screen name="Assignments" component={AssignmentsScreen} options={{ headerShown: true, title: 'Assignments' }} />
        <Stack.Screen name="Users" component={UsersScreen} options={{ headerShown: true, title: 'Users' }} />
        <Stack.Screen name="Locations" component={LocationsScreen} options={{ headerShown: true, title: 'NC Locations' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// App with Auth Provider
export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}
