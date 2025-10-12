import { ref, get } from 'firebase/database';
import { database } from '../config/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const STATIONS_CACHE_KEY = '@stations_data';
const TRAINS_CACHE_KEY = '@trains_data';
const STATIONS_TIMESTAMP_KEY = '@stations_timestamp';
const TRAINS_TIMESTAMP_KEY = '@trains_timestamp';

// Cache validity period (24 hours in milliseconds)
const CACHE_VALIDITY_PERIOD = 24 * 60 * 60 * 1000;

/**
 * Check if cached data is still valid
 * @param {string} timestampKey - AsyncStorage key for timestamp
 * @returns {Promise<boolean>} - True if cache is valid
 */
const isCacheValid = async (timestampKey) => {
  try {
    const timestamp = await AsyncStorage.getItem(timestampKey);
    if (!timestamp) return false;
    
    const now = Date.now();
    const cacheAge = now - parseInt(timestamp, 10);
    return cacheAge < CACHE_VALIDITY_PERIOD;
  } catch (error) {
    console.error('Error checking cache validity:', error);
    return false;
  }
};

/**
 * Fetch stations data from Firebase or cache
 * @returns {Promise<Array>} - Array of station names
 */
export const getStations = async () => {
  try {
    // Check if cache is valid
    const cacheValid = await isCacheValid(STATIONS_TIMESTAMP_KEY);
    
    if (cacheValid) {
      // Try to get from cache
      const cachedData = await AsyncStorage.getItem(STATIONS_CACHE_KEY);
      if (cachedData) {
        console.log('Using cached stations data');
        return JSON.parse(cachedData);
      }
    }
    
    // Fetch from Firebase
    console.log('Fetching stations from Firebase...');
    const stationsRef = ref(database, 'stations');
    const snapshot = await get(stationsRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const stations = data.stations || [];
      
      // Cache the data
      await AsyncStorage.setItem(STATIONS_CACHE_KEY, JSON.stringify(stations));
      await AsyncStorage.setItem(STATIONS_TIMESTAMP_KEY, Date.now().toString());
      
      console.log('Stations fetched and cached successfully');
      return stations;
    } else {
      console.log('No stations data found in Firebase, using fallback');
      // Fallback to local data if Firebase has no data
      const localData = require('../data/stations.json');
      return localData.stations;
    }
  } catch (error) {
    console.error('Error fetching stations:', error);
    
    // Try to use cached data even if expired
    try {
      const cachedData = await AsyncStorage.getItem(STATIONS_CACHE_KEY);
      if (cachedData) {
        console.log('Using expired cached stations data as fallback');
        return JSON.parse(cachedData);
      }
    } catch (cacheError) {
      console.error('Error reading cached stations:', cacheError);
    }
    
    // Ultimate fallback to local data
    console.log('Using local stations data as ultimate fallback');
    const localData = require('../data/stations.json');
    return localData.stations;
  }
};

/**
 * Fetch trains data from Firebase or cache
 * @returns {Promise<Array>} - Array of train objects
 */
export const getTrains = async () => {
  try {
    // Check if cache is valid
    const cacheValid = await isCacheValid(TRAINS_TIMESTAMP_KEY);
    
    if (cacheValid) {
      // Try to get from cache
      const cachedData = await AsyncStorage.getItem(TRAINS_CACHE_KEY);
      if (cachedData) {
        console.log('Using cached trains data');
        return JSON.parse(cachedData);
      }
    }
    
    // Fetch from Firebase
    console.log('Fetching trains from Firebase...');
    const trainsRef = ref(database, 'trains');
    const snapshot = await get(trainsRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const trains = data.trains || [];
      
      // Cache the data
      await AsyncStorage.setItem(TRAINS_CACHE_KEY, JSON.stringify(trains));
      await AsyncStorage.setItem(TRAINS_TIMESTAMP_KEY, Date.now().toString());
      
      console.log('Trains fetched and cached successfully');
      return trains;
    } else {
      console.log('No trains data found in Firebase, using fallback');
      // Fallback to local data if Firebase has no data
      const localData = require('../data/trains.json');
      return localData.trains;
    }
  } catch (error) {
    console.error('Error fetching trains:', error);
    
    // Try to use cached data even if expired
    try {
      const cachedData = await AsyncStorage.getItem(TRAINS_CACHE_KEY);
      if (cachedData) {
        console.log('Using expired cached trains data as fallback');
        return JSON.parse(cachedData);
      }
    } catch (cacheError) {
      console.error('Error reading cached trains:', cacheError);
    }
    
    // Ultimate fallback to local data
    console.log('Using local trains data as ultimate fallback');
    const localData = require('../data/trains.json');
    return localData.trains;
  }
};

/**
 * Force refresh data from Firebase (bypass cache)
 * @returns {Promise<{stations: Array, trains: Array}>}
 */
export const refreshData = async () => {
  try {
    // Clear cache
    await AsyncStorage.multiRemove([
      STATIONS_CACHE_KEY,
      TRAINS_CACHE_KEY,
      STATIONS_TIMESTAMP_KEY,
      TRAINS_TIMESTAMP_KEY,
    ]);
    
    // Fetch fresh data
    const [stations, trains] = await Promise.all([
      getStations(),
      getTrains(),
    ]);
    
    return { stations, trains };
  } catch (error) {
    console.error('Error refreshing data:', error);
    throw error;
  }
};

/**
 * Clear all cached data
 */
export const clearCache = async () => {
  try {
    await AsyncStorage.multiRemove([
      STATIONS_CACHE_KEY,
      TRAINS_CACHE_KEY,
      STATIONS_TIMESTAMP_KEY,
      TRAINS_TIMESTAMP_KEY,
    ]);
    console.log('Cache cleared successfully');
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};

/**
 * Get app configuration from Firebase (e.g., weekday validation settings)
 * @returns {Promise<Object>} - Configuration object
 */
export const getAppConfig = async () => {
  try {
    console.log('Fetching app configuration from Firebase...');
    const configRef = ref(database, 'appUpdate');
    const snapshot = await get(configRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      
      // Return configuration with default values
      return {
        enableWeekdayValidation: data.enableWeekdayValidation !== undefined ? data.enableWeekdayValidation : true,
        // Add other config values as needed
      };
    } else {
      console.log('No app configuration found in Firebase, using defaults');
      // Return default configuration
      return {
        enableWeekdayValidation: true,
      };
    }
  } catch (error) {
    console.error('Error fetching app configuration:', error);
    // Return default configuration on error
    return {
      enableWeekdayValidation: true,
    };
  }
};
