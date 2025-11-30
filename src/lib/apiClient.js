import AsyncStorage from '@react-native-async-storage/async-storage';

// API Base URL - default to local backend
// IMPORTANT: This must point to the same backend that connects to your MongoDB database
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

// Debug: Log API URL (remove in production)
if (__DEV__) {
  console.log('🔗 Frontend API Base URL:', API_BASE_URL);
  console.log('📝 EXPO_PUBLIC_API_URL env:', process.env.EXPO_PUBLIC_API_URL || 'using default');
  console.log('💡 Ensure this points to the backend server that uses the same MongoDB database');
}

// Storage keys
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

/**
 * API Client for making REST API calls
 */
class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  /**
   * Get stored auth token
   */
  async getToken() {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  }

  /**
   * Store auth token
   */
  async setToken(token) {
    try {
      if (token) {
        await AsyncStorage.setItem(TOKEN_KEY, token);
      } else {
        await AsyncStorage.removeItem(TOKEN_KEY);
      }
    } catch (error) {
      console.error('Error setting token:', error);
    }
  }

  /**
   * Store user data
   */
  async setUser(user) {
    try {
      if (user) {
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
      } else {
        await AsyncStorage.removeItem(USER_KEY);
      }
    } catch (error) {
      console.error('Error setting user:', error);
    }
  }

  /**
   * Get stored user data
   */
  async getUser() {
    try {
      const userStr = await AsyncStorage.getItem(USER_KEY);
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  /**
   * Clear auth data
   */
  async clearAuth() {
    try {
      await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    } catch (error) {
      console.error('Error clearing auth:', error);
    }
  }

  /**
   * Make API request
   */
  async request(endpoint, options = {}) {
    const token = await this.getToken();
    const url = `${this.baseURL}${endpoint}`;

    // Debug logging
    if (__DEV__) {
      console.log('API Request:', url);
      console.log('Full URL:', url);
    }

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);
      
      if (__DEV__) {
        console.log('API Response Status:', response.status);
      }
      
      const data = await response.json();

      if (!response.ok) {
        // Handle 401 Unauthorized - token expired or invalid
        if (response.status === 401) {
          await this.clearAuth();
          throw new Error(data.error || 'Unauthorized. Please login again.');
        }
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API request error:', error);
      
      // Provide more helpful error messages
      if (error.message === 'Network request failed' || error.message.includes('Failed to fetch')) {
        const helpfulError = new Error(
          `Cannot connect to backend server at ${url}\n\n` +
          `Possible solutions:\n` +
          `1. Make sure backend is running: cd backend && npm run dev\n` +
          `2. Check API URL in .env: EXPO_PUBLIC_API_URL=${this.baseURL}\n` +
          `3. For mobile devices, use your computer's IP instead of localhost\n` +
          `4. Verify backend is accessible: http://${this.baseURL.replace('/api', '').replace('http://', '')}/health`
        );
        helpfulError.originalError = error;
        throw helpfulError;
      }
      
      throw error;
    }
  }

  /**
   * GET request
   */
  async get(endpoint, params = {}) {
    const queryString = Object.keys(params)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url, { method: 'GET' });
  }

  /**
   * POST request
   */
  async post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * PUT request
   */
  async put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * DELETE request
   */
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

// Export singleton instance
export default new ApiClient();

// Export for compatibility with old Parse code
export const PARSE_CLASSES = {
  USER: '_User',
  ATTENDANCE: 'Attendance',
  STAFF_ASSIGNMENT: 'StaffAssignment',
  NC_LOCATION: 'NCLocation',
  SUPERVISOR_LOCATION: 'SupervisorLocation',
  LEAVE_REQUEST: 'LeaveRequest',
  ATTENDANCE_REMINDER: 'AttendanceReminder',
  PERFORMANCE_REVIEW: 'PerformanceReview',
  LIVE_TRACKING: 'LiveTracking',
  PUSH_SUBSCRIPTION: 'ExpoPushSubscription'
};

// Export USER_ROLES for compatibility
import { ROLE } from './roles';
export const USER_ROLES = ROLE;

