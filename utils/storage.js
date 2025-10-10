import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  AUTH_TOKEN: 'railway_auth_token',
  DEVICE_KEY: 'railway_device_key',
};

export const RailwayAccountStorage = {
  /**
   * Get stored railway account credentials (auth token and device key)
   * @returns {Promise<{authToken: string, deviceKey: string}>}
   */
  async getCredentials() {
    try {
      const [authToken, deviceKey] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.DEVICE_KEY),
      ]);

      return {
        authToken: authToken || '',
        deviceKey: deviceKey || '',
      };
    } catch (error) {
      console.error('Error getting railway credentials:', error);
      return {
        authToken: '',
        deviceKey: '',
      };
    }
  },

  /**
   * Save railway account credentials (auth token and device key)
   * @param {string} authToken - Authentication token
   * @param {string} deviceKey - Device key
   * @returns {Promise<boolean>} - Success status
   */
  async saveCredentials(authToken, deviceKey) {
    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, authToken),
        AsyncStorage.setItem(STORAGE_KEYS.DEVICE_KEY, deviceKey),
      ]);
      return true;
    } catch (error) {
      console.error('Error saving railway credentials:', error);
      return false;
    }
  },

  /**
   * Clear stored railway account credentials
   * @returns {Promise<boolean>} - Success status
   */
  async clearCredentials() {
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN),
        AsyncStorage.removeItem(STORAGE_KEYS.DEVICE_KEY),
      ]);
      return true;
    } catch (error) {
      console.error('Error clearing railway credentials:', error);
      return false;
    }
  },

  /**
   * Validate that credentials are properly saved
   * @param {string} expectedAuthToken - Expected auth token
   * @param {string} expectedDeviceKey - Expected device key
   * @returns {Promise<boolean>} - True if credentials match expectations
   */
  async validateSavedCredentials(expectedAuthToken, expectedDeviceKey) {
    try {
      const credentials = await this.getCredentials();
      return credentials.authToken === expectedAuthToken && credentials.deviceKey === expectedDeviceKey;
    } catch (error) {
      console.error('Error validating saved credentials:', error);
      return false;
    }
  },
};