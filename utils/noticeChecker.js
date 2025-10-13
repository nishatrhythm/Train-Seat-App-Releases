import { ref, get } from 'firebase/database';
import { database } from '../config/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'dismissed_notice_version';

// Global flag to track if notice dialog has been shown in this session
let noticeDialogShown = false;
let noticeCheckInProgress = false;
let cachedNoticeInfo = null;

/**
 * Reset the notice dialog shown flag (useful for testing)
 */
export const resetNoticeDialogFlag = () => {
  noticeDialogShown = false;
};

/**
 * Get the last dismissed notice version from storage
 * @returns {Promise<string|null>}
 */
const getDismissedNoticeVersion = async () => {
  try {
    const version = await AsyncStorage.getItem(STORAGE_KEY);
    return version;
  } catch (error) {
    console.error('Error getting dismissed notice version:', error);
    return null;
  }
};

/**
 * Save the dismissed notice version to storage
 * @param {string} version - Notice version to save
 * @returns {Promise<boolean>}
 */
export const saveDismissedNoticeVersion = async (version) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, version);
    console.log('Notice version saved:', version);
    return true;
  } catch (error) {
    console.error('Error saving dismissed notice version:', error);
    return false;
  }
};

/**
 * Check if a notice should be displayed
 * @param {boolean} forceCheck - Force check even if dialog was already shown
 * @returns {Promise<Object>} Notice information
 */
export const checkForNotice = async (forceCheck = false) => {
  // If dialog was already shown in this session and not forcing check, return cached info without showing again
  if (noticeDialogShown && !forceCheck) {
    console.log('Notice dialog already shown in this session');
    return cachedNoticeInfo || {
      shouldShow: false,
      alreadyShown: true
    };
  }

  // If check is already in progress, wait for it
  if (noticeCheckInProgress) {
    console.log('Notice check already in progress, waiting...');
    await new Promise(resolve => setTimeout(resolve, 100));
    return cachedNoticeInfo || {
      shouldShow: false
    };
  }

  noticeCheckInProgress = true;
  try {
    // Reference to the notice info in Firebase
    const noticeRef = ref(database, 'appNotice');
    
    // Get notice information from Firebase
    const snapshot = await get(noticeRef);
    
    if (snapshot.exists()) {
      const noticeInfo = snapshot.val();
      console.log('Firebase notice info:', noticeInfo);
      
      const {
        enabled,
        version,
        title,
        message,
        buttonText,
        dismissible,
      } = noticeInfo;
      
      // Check if notice is enabled
      if (!enabled) {
        cachedNoticeInfo = {
          shouldShow: false
        };
        noticeCheckInProgress = false;
        return cachedNoticeInfo;
      }

      // Check if notice version is provided
      if (!version) {
        console.log('No notice version specified');
        cachedNoticeInfo = {
          shouldShow: false
        };
        noticeCheckInProgress = false;
        return cachedNoticeInfo;
      }

      // Get the last dismissed notice version
      const dismissedVersion = await getDismissedNoticeVersion();
      
      // Show notice only if the version is different from the dismissed one
      const shouldShow = dismissedVersion !== version;

      cachedNoticeInfo = {
        shouldShow,
        version,
        title: title || 'Notice',
        message: message || '',
        buttonText: buttonText || 'OK',
        dismissible: dismissible !== false, // Default to true if not specified
      };

      // Mark dialog as shown if it should be displayed
      if (shouldShow) {
        noticeDialogShown = true;
      }

      noticeCheckInProgress = false;
      return cachedNoticeInfo;
    } else {
      console.log('No notice info found in Firebase');
      cachedNoticeInfo = {
        shouldShow: false
      };
      noticeCheckInProgress = false;
      return cachedNoticeInfo;
    }
  } catch (error) {
    console.error('Error checking for notice:', error);
    noticeCheckInProgress = false;
    // Return false on error to avoid disrupting user experience
    cachedNoticeInfo = {
      shouldShow: false,
      error: error.message
    };
    return cachedNoticeInfo;
  }
};

/**
 * Mark the current notice as dismissed
 * @param {string} version - Notice version to dismiss
 * @returns {Promise<boolean>}
 */
export const dismissNotice = async (version) => {
  if (!version) {
    console.error('No version provided to dismiss notice');
    return false;
  }
  
  const success = await saveDismissedNoticeVersion(version);
  if (success) {
    noticeDialogShown = true;
  }
  return success;
};
