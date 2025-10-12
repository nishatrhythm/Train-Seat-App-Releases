import { ref, get } from 'firebase/database';
import { database } from '../config/firebaseConfig';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform, Linking } from 'react-native';

// Global flag to track if update dialog has been shown in this session
let updateDialogShown = false;
let updateCheckInProgress = false;
let cachedUpdateInfo = null;

/**
 * Reset the update dialog shown flag (useful for testing or when user dismisses dialog)
 */
export const resetUpdateDialogFlag = () => {
  updateDialogShown = false;
};

/**
 * Check if app update is available
 * @param {boolean} forceCheck - Force check even if dialog was already shown
 * @returns {Promise<Object>} Update information
 */
export const checkForUpdate = async (forceCheck = false) => {
  // If dialog was already shown in this session and not forcing check, return cached info without showing again
  if (updateDialogShown && !forceCheck) {
    console.log('Update dialog already shown in this session');
    return cachedUpdateInfo || {
      updateAvailable: false,
      forceUpdate: false,
      alreadyShown: true
    };
  }

  // If check is already in progress, wait for it
  if (updateCheckInProgress) {
    console.log('Update check already in progress, waiting...');
    // Wait a bit and return cached info if available
    await new Promise(resolve => setTimeout(resolve, 100));
    return cachedUpdateInfo || {
      updateAvailable: false,
      forceUpdate: false
    };
  }

  updateCheckInProgress = true;
  try {
    // Get current app version from app.json (for both Expo Go and standalone builds)
    const currentVersion = Constants.expoConfig?.version || Application.nativeApplicationVersion || '2.4.0';
    
    console.log('Current app version:', currentVersion);
    
    // Reference to the update info in Firebase
    const updateRef = ref(database, 'appUpdate');
    
    // Get update information from Firebase
    const snapshot = await get(updateRef);
    
    if (snapshot.exists()) {
      const updateInfo = snapshot.val();
      console.log('Firebase update info:', updateInfo);
      
      const {
        latestVersion,
        minVersion,
        updateUrl,
        message,
        forceUpdate,
        enabled
      } = updateInfo;
      
      // Check if update check is enabled
      if (!enabled) {
        cachedUpdateInfo = {
          updateAvailable: false,
          forceUpdate: false
        };
        updateCheckInProgress = false;
        return cachedUpdateInfo;
      }
      
      // Compare versions
      const isUpdateAvailable = compareVersions(latestVersion, currentVersion) > 0;
      const isForceUpdate = forceUpdate && compareVersions(minVersion, currentVersion) > 0;
      
      cachedUpdateInfo = {
        updateAvailable: isUpdateAvailable,
        forceUpdate: isForceUpdate,
        latestVersion,
        currentVersion,
        updateUrl: updateUrl || 'https://www.github.com/nishatrhythm/Train-Seat-App-Releases',
        message: message || 'A new version of the app is available. Please update to get the latest features and improvements.',
      };

      // Mark dialog as shown if update is available
      if (isUpdateAvailable) {
        updateDialogShown = true;
      }

      updateCheckInProgress = false;
      return cachedUpdateInfo;
    } else {
      console.log('No update info found in Firebase');
      cachedUpdateInfo = {
        updateAvailable: false,
        forceUpdate: false
      };
      updateCheckInProgress = false;
      return cachedUpdateInfo;
    }
  } catch (error) {
    console.error('Error checking for update:', error);
    updateCheckInProgress = false;
    // Return false on error to avoid disrupting user experience
    cachedUpdateInfo = {
      updateAvailable: false,
      forceUpdate: false,
      error: error.message
    };
    return cachedUpdateInfo;
  }
};

/**
 * Compare two version strings
 * @param {string} v1 - First version (e.g., "1.3.1")
 * @param {string} v2 - Second version (e.g., "1.2.0")
 * @returns {number} - Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
const compareVersions = (v1, v2) => {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }
  
  return 0;
};

/**
 * Open app store to update
 * @param {string} updateUrl - URL to open (Play Store or custom URL)
 */
export const openUpdateUrl = async (updateUrl) => {
  try {
    const canOpen = await Linking.canOpenURL(updateUrl);
    if (canOpen) {
      await Linking.openURL(updateUrl);
    } else {
      console.error('Cannot open update URL:', updateUrl);
    }
  } catch (error) {
    console.error('Error opening update URL:', error);
  }
};
