// Dynamic Expo configuration
// This file ensures environment variables are properly embedded in EAS builds

export default ({ config }) => {
  // Get API URL from environment variable (set in eas.json)
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
  
  return {
    ...config,
    extra: {
      ...config.extra,
      // Embed API URL into app config for reliable access via expo-constants
      apiUrl: apiUrl,
    },
  };
};

