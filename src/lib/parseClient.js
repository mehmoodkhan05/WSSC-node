// Compatibility layer - re-export from apiClient
// This file is kept for backward compatibility with any remaining Parse imports
// All functionality has been migrated to REST API via apiClient

import apiClient, { PARSE_CLASSES, USER_ROLES } from './apiClient';
import { ROLE } from './roles';

// Export constants for compatibility
export { PARSE_CLASSES, USER_ROLES };
export const ROLE_CONSTANTS = ROLE;

// Create a mock Parse object for compatibility (will throw errors if used)
// This helps identify any remaining Parse SDK usage that needs to be migrated
const Parse = {
  User: {
    current: () => {
      console.warn('Parse.User.current() is deprecated. Use apiClient.getUser() instead.');
      return null;
    },
    logIn: () => {
      throw new Error('Parse.User.logIn() is deprecated. Use signInWithEmail() from auth.js instead.');
    }
  },
  Cloud: {
    run: () => {
      throw new Error('Parse.Cloud.run() is deprecated. Use REST API endpoints via apiClient instead.');
    }
  },
  Query: class {
    constructor() {
      throw new Error('Parse.Query is deprecated. Use REST API endpoints via apiClient instead.');
    }
  },
  Object: {
    extend: () => {
      throw new Error('Parse.Object.extend() is deprecated. Use REST API endpoints via apiClient instead.');
    }
  }
};

export default Parse;
