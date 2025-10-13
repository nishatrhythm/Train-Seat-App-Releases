import { RailwayAccountStorage } from './storage';

const BASE_URL = "https://railspaapi.shohoz.com/v1.0/web";

// Seat types supported by Bangladesh Railway
export const SEAT_TYPES = [
  "S_CHAIR", "SHOVAN", "SNIGDHA", "F_SEAT", "F_CHAIR", 
  "AC_S", "F_BERTH", "AC_B", "SHULOV", "AC_CHAIR"
];

/**
 * Validate credentials before making API calls
 * @returns {Promise<{authToken: string, deviceKey: string}>} - Auth token and device key
 */
export const validateCredentials = async () => {
  try {
    const credentials = await RailwayAccountStorage.getCredentials();
    
    if (!credentials.authToken || !credentials.deviceKey) {
      throw new Error("AUTH_CREDENTIALS_REQUIRED");
    }

    if (credentials.authToken.trim() === '' || credentials.deviceKey.trim() === '') {
      throw new Error("AUTH_CREDENTIALS_REQUIRED");
    }

    return credentials;
  } catch (error) {
    if (error.message === "AUTH_CREDENTIALS_REQUIRED") {
      throw error;
    }
    throw new Error("AUTH_CREDENTIALS_REQUIRED");
  }
};

/**
 * Verify credentials with Bangladesh Railway API
 * @param {string} authToken - Authentication token
 * @param {string} deviceKey - Device key
 * @returns {Promise<Object>} - Verification result with user data
 */
export const verifyCredentials = async (authToken, deviceKey) => {
  try {
    const response = await fetch(`${BASE_URL}/auth/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken.trim()}`,
        'x-device-key': deviceKey.trim(),
        'Content-Type': 'application/json',
      },
      timeout: 10000
    });

    const data = await response.json();

    if (response.status === 429) {
      // Handle rate limiting
      throw new Error("You are requesting too frequently. Please wait and try after some time.");
    }

    if (response.status === 401) {
      // Check which credential is invalid
      const errorMessages = data?.error?.messages || [];
      if (Array.isArray(errorMessages) && errorMessages.length > 0) {
        const errorMsg = errorMessages[0];
        if (errorMsg.includes("Invalid User Access Token!")) {
          throw new Error('AUTH_TOKEN_EXPIRED');
        } else if (errorMsg.includes("You are not authorized for this request")) {
          throw new Error('AUTH_DEVICE_KEY_EXPIRED');
        } else {
          throw new Error(`Verification failed: ${errorMsg}`);
        }
      } else {
        throw new Error('AUTH_TOKEN_EXPIRED'); // Default to token expired
      }
    } else if (response.ok && data.data) {
      // Successful verification
      return {
        success: true,
        data: data.data,
        message: 'Credentials verified successfully!'
      };
    } else {
      throw new Error('Verification failed. Unable to verify your credentials.');
    }
  } catch (error) {
    if (error.message === 'AUTH_TOKEN_EXPIRED' || error.message === 'AUTH_DEVICE_KEY_EXPIRED') {
      throw error;
    }
    
    if (error.message.includes('Network') || error.name === 'AbortError' || error.code === 'ECONNABORTED') {
      throw new Error('Unable to connect to Bangladesh Railway servers. Please check your internet connection.');
    }
    
    throw new Error(error.message || 'Unable to verify your credentials.');
  }
};

/**
 * Fetch train route data
 * @param {string} model - Train model/number
 * @param {string} apiDate - Date in YYYY-MM-DD format
 * @param {AbortSignal} signal - Abort signal for cancellation
 * @returns {Promise<Object>} - Train route data
 */
export const fetchTrainData = async (model, apiDate, signal = null) => {
  const url = `${BASE_URL}/train-routes`;
  const payload = {
    model: model,
    departure_date_time: apiDate
  };

  // Single retry for train data - it usually works on first try
  const maxRetries = 1;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: signal
      });

      if (response.status === 429) {
        throw new Error("You are requesting too frequently. Please wait and try after some time.");
      }

      if (response.status === 403) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }

      if (response.status >= 500) {
        retryCount += 1;
        if (retryCount >= maxRetries) {
          throw new Error("Server temporarily unavailable. Please try again.");
        }
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      if (error.message.includes("Network request failed") || error.message.includes("Failed to fetch")) {
        throw new Error("Network connection failed. Please check your internet connection.");
      }
      throw error;
    }
  }
};

/**
 * Get seat availability for a specific route
 * Uses auth token and device key for authorization
 * @param {string} trainModel - Train model/number
 * @param {string} journeyDate - Journey date in DD-MMM-YYYY format
 * @param {string} fromCity - Origin city
 * @param {string} toCity - Destination city
 * @param {AbortSignal} signal - Abort signal for cancellation
 * @returns {Promise<Object>} - Seat availability data
 */
export const getSeatAvailability = async (trainModel, journeyDate, fromCity, toCity, signal = null) => {
  // Validate and get credentials
  const credentials = await validateCredentials();

  const url = `${BASE_URL}/bookings/search-trips-v2`;
  const params = new URLSearchParams({
    from_city: fromCity,
    to_city: toCity,
    date_of_journey: journeyDate,
    seat_class: "SHULOV"
  });

  const maxRetries = 1;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      const response = await fetch(`${url}?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${credentials.authToken}`,
          'x-device-key': credentials.deviceKey,
          'Content-Type': 'application/json'
        },
        signal: signal
      });

      if (response.status === 429) {
        throw new Error("You are requesting too frequently. Please wait and try after some time.");
      }

      if (response.status === 401) {
        try {
          const errorData = await response.json();
          const errorMessages = errorData.error?.messages || [];
          if (Array.isArray(errorMessages)) {
            for (const msg of errorMessages) {
              if (msg.includes("You are not authorized for this request") || msg.includes("Please login first")) {
                throw new Error("AUTH_DEVICE_KEY_EXPIRED");
              } else if (msg.includes("Invalid User Access Token!")) {
                throw new Error("AUTH_TOKEN_EXPIRED");
              }
            }
          }
          throw new Error("AUTH_TOKEN_EXPIRED");
        } catch (jsonError) {
          if (jsonError.message === "AUTH_DEVICE_KEY_EXPIRED" || jsonError.message === "AUTH_TOKEN_EXPIRED") {
            throw jsonError;
          }
          throw new Error("AUTH_TOKEN_EXPIRED");
        }
      }

      if (response.status === 403) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }

      if (response.status >= 500) {
        retryCount += 1;
        if (retryCount >= maxRetries) {
          throw new Error("Server error. Please try again.");
        }
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const trains = result.data?.trains || [];

      for (const train of trains) {
        if (train.train_model === trainModel) {
          const seatInfo = {};
          
          // Initialize all seat types
          SEAT_TYPES.forEach(stype => {
            seatInfo[stype] = { online: 0, offline: 0, fare: 0, vat_amount: 0 };
          });

          // Process available seat types
          for (const seat of train.seat_types || []) {
            const stype = seat.type;
            if (SEAT_TYPES.includes(stype)) {
              let fare = parseFloat(seat.fare);
              const vatAmount = parseFloat(seat.vat_amount);
              
              // Add extra charge for berth seats
              if (stype === "AC_B" || stype === "F_BERTH") {
                fare += 50;
              }
              
              seatInfo[stype] = {
                online: seat.seat_counts.online,
                offline: seat.seat_counts.offline,
                fare: fare,
                vat_amount: vatAmount
              };
            }
          }
          
          return seatInfo;
        }
      }
      
      throw new Error("Train not found");
    } catch (error) {
      if (error.message === "AUTH_TOKEN_EXPIRED" || error.message === "AUTH_DEVICE_KEY_EXPIRED") {
        throw error;
      }
      if (error.message.includes("Network request failed") || error.message.includes("Failed to fetch")) {
        throw new Error("Network connection failed. Please check your internet connection.");
      }
      throw error;
    }
  }
};

/**
 * Extract train model from train name
 * @param {string} trainNameFull - Full train name with number in parentheses
 * @returns {string} - Train model/number
 */
export const extractTrainModel = (trainNameFull) => {
  const modelMatch = trainNameFull.match(/.*\((\d+)\)$/);
  if (modelMatch) {
    return modelMatch[1];
  }
  return trainNameFull.split('(')[0].trim();
};

/**
 * Format date for API calls
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} - Date in DD-MMM-YYYY format
 */
export const formatDateForAPI = (dateString) => {
  try {
    // Parse YYYY-MM-DD format
    const [year, month, day] = dateString.split('-');
    
    // Hardcoded month abbreviations to match backend exactly
    const monthAbbr = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    
    const monthIndex = parseInt(month, 10) - 1; // Convert to 0-based index
    const monthStr = monthAbbr[monthIndex];
    const dayStr = parseInt(day, 10).toString().padStart(2, '0');
    
    return `${dayStr}-${monthStr}-${year}`;
  } catch (error) {
    // Fallback to original method if parsing fails
    const date = new Date(dateString);
    const monthAbbr = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    const day = date.getDate().toString().padStart(2, '0');
    const month = monthAbbr[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }
};

/**
 * Parse date string to YYYY-MM-DD format
 * @param {string} dateString - Date in DD-MMM-YYYY format
 * @returns {string} - Date in YYYY-MM-DD format
 */
export const parseDateString = (dateString) => {
  try {
    // Handle DD-MMM-YYYY format (e.g., "28-Sep-2025")
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const monthStr = parts[1];
      const year = parts[2];
      
      // Convert month abbreviation to number - handle both cases
      const monthMap = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12',
        // Handle lowercase variants
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
        'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
        'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
      };
      
      const month = monthMap[monthStr] || monthMap[monthStr.toLowerCase()] || '01';
      
      // Validate the resulting date
      const resultDate = `${year}-${month}-${day}`;
      const testDate = new Date(resultDate);
      
      // Check if the date is valid
      if (testDate.getFullYear() == year && 
          (testDate.getMonth() + 1) == parseInt(month, 10) && 
          testDate.getDate() == parseInt(day, 10)) {
        return resultDate;
      }
    }
  } catch (error) {
    console.warn('Date parsing error:', error);
  }
  
  // Fallback: try to parse as regular date
  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (error) {
    console.warn('Date fallback parsing error:', error);
  }
  
  // Final fallback: return today's date in case of complete failure
  return new Date().toISOString().split('T')[0];
};

/**
 * Search trains between two stations
 * @param {string} origin - Origin station name
 * @param {string} destination - Destination station name
 * @param {Function} onProgress - Progress callback (message, percent)
 * @param {AbortSignal} signal - Abort signal for cancellation
 * @returns {Promise<Object>} - Search results with train list
 */
export const searchTrainsBetweenStations = async (origin, destination, onProgress = null, signal = null) => {
  try {
    // Validate credentials first
    await validateCredentials();

    if (onProgress) onProgress('Preparing search...', 5);

    // Check for cancellation
    if (signal?.aborted) {
      throw new Error('Search canceled');
    }

    // Use future dates for search (same logic as main project)
    const today = new Date();
    const date1 = new Date(today);
    const date2 = new Date(today);
    
    date1.setDate(today.getDate() + 8);
    date2.setDate(today.getDate() + 9);
    
    const date1Str = formatDateObjectForAPI(date1);
    const date2Str = formatDateObjectForAPI(date2);
    
    if (onProgress) onProgress('Fetching train schedules...', 10);

    // Check for cancellation
    if (signal?.aborted) {
      throw new Error('Search canceled');
    }

    // Fetch trains for both dates with concurrency control
    const MAX_CONCURRENT_REQUESTS = 10; // Same as Matrix and Seat Availability
    const allRequests = [
      { date: date1Str, name: 'Day 1' },
      { date: date2Str, name: 'Day 2' }
    ];

    const results = [];
    const executing = new Set();
    let completedCount = 0;
    const totalCount = allRequests.length;

    for (const request of allRequests) {
      // Limit concurrent requests
      while (executing.size >= MAX_CONCURRENT_REQUESTS) {
        await Promise.race(executing);
      }

      // Check for cancellation
      if (signal?.aborted) {
        throw new Error('Search canceled');
      }

      const promise = (async () => {
        try {
          const trains = await fetchTrainsForDate(origin, destination, request.date, signal);
          completedCount++;
          if (onProgress) {
            const progressPercent = 10 + Math.round((completedCount / totalCount) * 75);
            onProgress(`Fetching ${request.name} schedule...`, progressPercent);
          }
          return trains;
        } catch (error) {
          completedCount++;
          if (onProgress) {
            const progressPercent = 10 + Math.round((completedCount / totalCount) * 75);
            onProgress(`Fetching ${request.name} schedule...`, progressPercent);
          }
          throw error;
        }
      })();

      executing.add(promise);
      results.push(promise);

      promise.finally(() => executing.delete(promise));
    }

    // Wait for all results
    const settledResults = await Promise.allSettled(results);

    if (onProgress) onProgress('Processing results...', 87);

    // Check for cancellation
    if (signal?.aborted) {
      throw new Error('Search canceled');
    }

    // Extract successful results
    const trainsDay1 = settledResults[0].status === 'fulfilled' ? settledResults[0].value : [];
    const trainsDay2 = settledResults[1].status === 'fulfilled' ? settledResults[1].value : [];

    // Check if both requests failed
    if (settledResults.every(result => result.status === 'rejected')) {
      // Check if any error is an auth error - prioritize those
      for (const result of settledResults) {
        if (result.reason?.message === 'AUTH_TOKEN_EXPIRED' || result.reason?.message === 'AUTH_DEVICE_KEY_EXPIRED') {
          throw result.reason;
        }
      }
      // Re-throw the first error
      throw settledResults[0].reason;
    }

    if (onProgress) onProgress('Organizing trains...', 93);

    // Get common trains between both dates
    const commonTrains = getCommonTrains(trainsDay1, trainsDay2);

    if (onProgress) onProgress('Complete!', 100);

    return {
      success: true,
      trains: commonTrains,
      dates: [date1Str, date2Str]
    };
    
  } catch (error) {
    // Handle cancellation gracefully
    if (error.message === 'Search canceled' || signal?.aborted) {
      throw new Error('Search canceled');
    }
    // Preserve AUTH errors
    if (error.message === 'AUTH_TOKEN_EXPIRED' || error.message === 'AUTH_DEVICE_KEY_EXPIRED') {
      throw error;
    }
    throw new Error(error.message || 'Failed to search trains');
  }
};

/**
 * Format Date object for API request (DD-MMM-YYYY format)
 * @param {Date} date - Date object
 * @returns {string} - Formatted date string
 */
const formatDateObjectForAPI = (date) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  
  return `${day}-${month}-${year}`;
};

/**
 * Fetch trains for a specific date and route
 * @param {string} origin - Origin station
 * @param {string} destination - Destination station  
 * @param {string} dateStr - Date in DD-MMM-YYYY format
 * @param {AbortSignal} signal - Abort signal for cancellation
 * @returns {Promise<Array>} - Array of trains
 */
const fetchTrainsForDate = async (origin, destination, dateStr, signal = null) => {
  // Get credentials
  const credentials = await validateCredentials();

  const url = `${BASE_URL}/bookings/search-trips-v2`;
  const params = new URLSearchParams({
    from_city: origin,
    to_city: destination,
    date_of_journey: dateStr,
    seat_class: 'S_CHAIR'
  });

  const maxRetries = 2;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      const response = await fetch(`${url}?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${credentials.authToken}`,
          'x-device-key': credentials.deviceKey,
          'Content-Type': 'application/json',
        },
        signal: signal,
        timeout: 10000
      });

      // Handle rate limiting (429)
      if (response.status === 429) {
        throw new Error("You are requesting too frequently. Please wait and try after some time.");
      }

      // Handle 401 unauthorized (invalid credentials)
      if (response.status === 401) {
        try {
          const errorData = await response.json();
          const errorMessages = errorData?.error?.messages || [];
          if (Array.isArray(errorMessages)) {
            for (const msg of errorMessages) {
              if (msg.includes("You are not authorized for this request") || msg.includes("Please login first")) {
                throw new Error("AUTH_DEVICE_KEY_EXPIRED");
              } else if (msg.includes("Invalid User Access Token!")) {
                throw new Error("AUTH_TOKEN_EXPIRED");
              }
            }
          }
        } catch (parseError) {
          if (parseError.message === 'AUTH_TOKEN_EXPIRED' || parseError.message === 'AUTH_DEVICE_KEY_EXPIRED') {
            throw parseError;
          }
        }
        throw new Error('AUTH_TOKEN_EXPIRED'); // Default to token expired
      }
      
      // Handle rate limiting (403)
      if (response.status === 403) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
        
      // Handle server errors with retry
      if (response.status >= 500) {
        retryCount++;
        if (retryCount === maxRetries) {
          throw new Error("Unable to connect to Bangladesh Railway website. Please try again later.");
        }
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`Search request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      return data?.data?.trains || [];
      
    } catch (error) {
      // Check if it's a cancellation
      if (error.name === 'AbortError' || signal?.aborted) {
        throw new Error('Search canceled');
      }

      // Preserve AUTH errors - don't retry, just throw immediately
      if (error.message === 'AUTH_TOKEN_EXPIRED' || error.message === 'AUTH_DEVICE_KEY_EXPIRED') {
        throw error;
      }

      if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
        retryCount++;
        if (retryCount === maxRetries) {
          throw new Error("Request timeout. Please check your internet connection and try again.");
        }
        continue;
      }
      
      if (error.message.includes("Rate limit") || error.message.includes("Bangladesh Railway")) {
        throw error;
      }
      
      retryCount++;
      if (retryCount === maxRetries) {
        throw new Error("Network error. Please check your internet connection and try again.");
      }
    }
  }
  
  return [];
};

/**
 * Get common trains between two date results
 * @param {Array} trainsDay1 - Trains from first date
 * @param {Array} trainsDay2 - Trains from second date
 * @returns {Array} - Common trains sorted by departure time
 */
const getCommonTrains = (trainsDay1, trainsDay2) => {
  const allTrains = new Map();
  
  // Process trains from first date
  trainsDay1.forEach(train => {
    const tripNumber = train.trip_number;
    if (tripNumber && !allTrains.has(tripNumber)) {
      allTrains.set(tripNumber, {
        trip_number: tripNumber,
        departure_time: train.departure_date_time || '',
        arrival_time: train.arrival_date_time || '',
        travel_time: train.travel_time || '',
        origin_city: train.origin_city_name || '',
        destination_city: train.destination_city_name || '',
        sort_time: extractTimeForSorting(train.departure_date_time || '')
      });
    }
  });
  
  // Process trains from second date
  trainsDay2.forEach(train => {
    const tripNumber = train.trip_number;
    if (tripNumber && !allTrains.has(tripNumber)) {
      allTrains.set(tripNumber, {
        trip_number: tripNumber,
        departure_time: train.departure_date_time || '',
        arrival_time: train.arrival_date_time || '',
        travel_time: train.travel_time || '',
        origin_city: train.origin_city_name || '',
        destination_city: train.destination_city_name || '',
        sort_time: extractTimeForSorting(train.departure_date_time || '')
      });
    }
  });
  
  // Convert to array and sort by departure time
  const trainsList = Array.from(allTrains.values());
  trainsList.sort((a, b) => a.sort_time.localeCompare(b.sort_time));
  
  // Remove sort_time property
  trainsList.forEach(train => {
    delete train.sort_time;
  });
  
  return trainsList;
};

/**
 * Extract time for sorting from departure time string
 * @param {string} departureTimeStr - Departure time string
 * @returns {string} - Time in HH:MM format for sorting
 */
const extractTimeForSorting = (departureTimeStr) => {
  try {
    if (!departureTimeStr) {
      return "99:99";
    }
      
    const timePart = departureTimeStr.split(',').pop().trim();
    
    if (timePart.toLowerCase().includes('am')) {
      const timeClean = timePart.toLowerCase().replace('am', '').trim();
      const [hour, minute] = timeClean.split(':');
      let hourNum = parseInt(hour, 10);
      if (hourNum === 12) {
        hourNum = 0;
      }
      return `${String(hourNum).padStart(2, '0')}:${minute}`;
    } else if (timePart.toLowerCase().includes('pm')) {
      const timeClean = timePart.toLowerCase().replace('pm', '').trim();
      const [hour, minute] = timeClean.split(':');
      let hourNum = parseInt(hour, 10);
      if (hourNum !== 12) {
        hourNum += 12;
      }
      return `${String(hourNum).padStart(2, '0')}:${minute}`;
    } else {
      return "99:99";
    }
  } catch (error) {
    return "99:99";
  }
};

// Coach ordering for seat sorting
const BANGLA_COACH_ORDER = [
  "KA", "KHA", "GA", "GHA", "UMA", "CHA", "SCHA", "JA", "JHA", "NEO",
  "TA", "THA", "DA", "DHA", "TO", "THO", "DOA", "DANT", "XTR1", "XTR2", "XTR3", "XTR4", "XTR5", "SLR", "STD"
];

const COACH_INDEX = BANGLA_COACH_ORDER.reduce((acc, coach, idx) => {
  acc[coach] = idx;
  return acc;
}, {});

/**
 * Sort seat numbers by coach and seat number
 * @param {string} seat - Seat number (e.g., "KA-12" or "KA-A-12")
 * @returns {Array} - Sort key array [coach_order, coach_fallback, seat_num, seat_letter]
 */
const sortSeatNumber = (seat) => {
  const parts = seat.split('-');
  const coach = parts[0];
  const coachOrder = COACH_INDEX[coach] !== undefined ? COACH_INDEX[coach] : BANGLA_COACH_ORDER.length + 1;
  const coachFallback = COACH_INDEX[coach] !== undefined ? "" : coach;
  
  if (parts.length === 2) {
    const seatNum = parseInt(parts[1], 10);
    return [coachOrder, coachFallback, isNaN(seatNum) ? 0 : seatNum, isNaN(seatNum) ? parts[1] : ''];
  } else if (parts.length === 3) {
    const seatNum = parseInt(parts[2], 10);
    return [coachOrder, coachFallback, isNaN(seatNum) ? 0 : seatNum, parts[1]];
  }
  
  return [BANGLA_COACH_ORDER.length + 1, seat, 0, ''];
};

/**
 * Group seats by coach
 * @param {Array<string>} seats - Array of seat numbers
 * @returns {Object} - Grouped seats by coach with counts
 */
const groupSeatsByCoach = (seats) => {
  const grouped = {};
  
  seats.forEach(seat => {
    const coach = seat.split('-')[0];
    if (!grouped[coach]) {
      grouped[coach] = { seats: [], count: 0 };
    }
    grouped[coach].seats.push(seat);
    grouped[coach].count++;
  });
  
  return grouped;
};

/**
 * Fetch seat layout for a specific train trip
 * Optimized to reuse cached token (similar to Flask applications)
 * @param {string} tripId - Trip ID
 * @param {string} tripRouteId - Trip route ID
 * @param {AbortSignal} signal - Abort signal for cancellation
 * @returns {Promise<Object>} - Seat layout data
 */
export const fetchSeatLayout = async (tripId, tripRouteId, signal = null) => {
  // Get credentials
  const credentials = await validateCredentials();

  const url = `${BASE_URL}/bookings/seat-layout`;
  const params = new URLSearchParams({
    trip_id: tripId,
    trip_route_id: tripRouteId
  });

  const maxRetries = 2;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      const response = await fetch(`${url}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${credentials.authToken}`,
          'x-device-key': credentials.deviceKey,
          'Content-Type': 'application/json',
        },
        signal: signal
      });

      if (response.status === 429) {
        throw new Error("You are requesting too frequently. Please wait and try after some time.");
      }

      if (response.status >= 500) {
        retryCount += 1;
        if (retryCount === maxRetries) {
          throw new Error("We're unable to connect to the Bangladesh Railway website right now. Please try again in a few minutes.");
        }
        continue;
      }

      if (response.status === 401) {
        try {
          const errorData = await response.json();
          const errorMessages = errorData.error?.messages || [];
          if (Array.isArray(errorMessages) && errorMessages.length > 0) {
            for (const msg of errorMessages) {
              if (msg.includes("You are not authorized for this request") || msg.includes("Please login first")) {
                throw new Error("AUTH_DEVICE_KEY_EXPIRED");
              } else if (msg.includes("Invalid User Access Token!")) {
                throw new Error("AUTH_TOKEN_EXPIRED");
              }
            }
          }
        } catch (parseError) {
          if (parseError.message === 'AUTH_TOKEN_EXPIRED' || parseError.message === 'AUTH_DEVICE_KEY_EXPIRED') {
            throw parseError;
          }
        }
        throw new Error('AUTH_TOKEN_EXPIRED'); // Default to token expired
      }

      if (response.status === 422) {
        const errorData = await response.json();
        const errorMessages = errorData.error?.messages || [];
        
        let errorMessage = "Unable to fetch seat layout";
        let errorKey = "";
        
        // Check if errorMessages is an array or object
        if (Array.isArray(errorMessages) && errorMessages.length > 0) {
          errorMessage = errorMessages[0];
        } else if (typeof errorMessages === 'object' && errorMessages !== null) {
          errorMessage = errorMessages.message || errorMessage;
          errorKey = errorMessages.errorKey || "";
        }
        
        // Create error object with error_info attached
        const error = new Error(errorMessage);
        error.error_info = {
          is_422: true,
          message: errorMessage,
          errorKey: errorKey
        };
        throw error;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const seatLayout = data.data?.seatLayout || [];

      // Extract all seats
      const allSeats = [];
      seatLayout.forEach(floor => {
        floor.layout.forEach(row => {
          row.forEach(seat => {
            if (seat.seat_number) {
              allSeats.push({
                seat_number: seat.seat_number,
                seat_availability: seat.seat_availability,
                ticket_type: seat.ticket_type
              });
            }
          });
        });
      });

      // Categorize seats
      const availableSeats = allSeats
        .filter(s => s.seat_availability === 1)
        .map(s => s.seat_number)
        .sort((a, b) => {
          const sortA = sortSeatNumber(a);
          const sortB = sortSeatNumber(b);
          for (let i = 0; i < sortA.length; i++) {
            if (sortA[i] < sortB[i]) return -1;
            if (sortA[i] > sortB[i]) return 1;
          }
          return 0;
        });

      const bookingProcessSeats = allSeats
        .filter(s => s.seat_availability === 2 && [1, 2, 3].includes(s.ticket_type))
        .map(s => s.seat_number)
        .sort((a, b) => {
          const sortA = sortSeatNumber(a);
          const sortB = sortSeatNumber(b);
          for (let i = 0; i < sortA.length; i++) {
            if (sortA[i] < sortB[i]) return -1;
            if (sortA[i] > sortB[i]) return 1;
          }
          return 0;
        });

      // Analyze ticket types
      const ticketTypeSeats = { 1: [], 2: [], 3: [], 4: [] };
      allSeats.forEach(seat => {
        if (seat.ticket_type && ticketTypeSeats[seat.ticket_type]) {
          ticketTypeSeats[seat.ticket_type].push(seat.seat_number);
        }
      });

      // Sort each ticket type
      Object.keys(ticketTypeSeats).forEach(type => {
        ticketTypeSeats[type].sort((a, b) => {
          const sortA = sortSeatNumber(a);
          const sortB = sortSeatNumber(b);
          for (let i = 0; i < sortA.length; i++) {
            if (sortA[i] < sortB[i]) return -1;
            if (sortA[i] > sortB[i]) return 1;
          }
          return 0;
        });
      });

      const ticketTypes = {};
      const ticketTypeLabels = {
        1: "Issued Tickets to Buy",
        2: "Soon-to-be-Issued Tickets to Buy",
        3: "Issued Tickets to Buy",
        4: "Reserved Tickets Under Authority"
      };

      Object.entries(ticketTypeSeats).forEach(([type, seats]) => {
        if (seats.length > 0) {
          ticketTypes[type] = {
            label: ticketTypeLabels[type],
            seats: seats,
            count: seats.length,
            grouped: groupSeatsByCoach(seats)
          };
        }
      });

      // Combine type 1 and 3 as issued_combined
      const issuedSeats = [...(ticketTypeSeats[1] || []), ...(ticketTypeSeats[3] || [])];
      if (issuedSeats.length > 0) {
        issuedSeats.sort((a, b) => {
          const sortA = sortSeatNumber(a);
          const sortB = sortSeatNumber(b);
          for (let i = 0; i < sortA.length; i++) {
            if (sortA[i] < sortB[i]) return -1;
            if (sortA[i] > sortB[i]) return 1;
          }
          return 0;
        });
        
        ticketTypes.issued_combined = {
          label: "Issued Tickets to Buy",
          seats: issuedSeats,
          count: issuedSeats.length,
          grouped: groupSeatsByCoach(issuedSeats)
        };
      }

      ticketTypes.issued_total = {
        count: issuedSeats.length
      };

      return {
        is_422: false,
        available_seats: availableSeats,
        booking_process_seats: bookingProcessSeats,
        available_count: availableSeats.length,
        booking_process_count: bookingProcessSeats.length,
        ticket_types: ticketTypes,
        grouped_seats: groupSeatsByCoach(availableSeats),
        grouped_booking_process: groupSeatsByCoach(bookingProcessSeats),
        grouped_ticket_types: {
          1: ticketTypes[1]?.grouped || {},
          2: ticketTypes[2]?.grouped || {},
          3: ticketTypes[3]?.grouped || {},
          4: ticketTypes[4]?.grouped || {}
        }
      };

    } catch (error) {
      if (error.message === 'AUTH_TOKEN_EXPIRED' || 
          error.message === 'AUTH_DEVICE_KEY_EXPIRED' ||
          error.message.includes('INVALID_CREDENTIALS:') || 
          error.message.includes('CREDENTIALS_ERROR:')) {
        throw error;
      }

      if (retryCount < maxRetries - 1) {
        retryCount++;
        continue;
      }

      throw error;
    }
  }
};

/**
 * Calculate journey duration between departure and arrival times
 * @param {string} departureTime - Departure time string (e.g., "28 Sep, 11:00 PM")
 * @param {string} arrivalTime - Arrival time string (e.g., "29 Sep, 06:30 AM")
 * @returns {string} - Journey duration (e.g., "7h 30m")
 */
const calculateJourneyDuration = (departureTime, arrivalTime) => {
  try {
    if (!departureTime || !arrivalTime) return "N/A";

    // Parse time strings with format: "14 Oct, 10:15 PM" (matching Python's '%d %b, %I:%M %p')
    const parseTime = (timeStr) => {
      // Split by comma and trim
      const parts = timeStr.split(',');
      if (parts.length !== 2) {
        throw new Error('Invalid time format');
      }
      
      const datePart = parts[0].trim(); // "14 Oct"
      const timePart = parts[1].trim(); // "10:15 PM"
      
      // Parse date part
      const [day, month] = datePart.split(' ');
      
      // Parse time part - format: "10:15 PM" or "10:15 AM"
      const timeMatch = timePart.match(/^(\d+):(\d+)\s+(AM|PM)$/i);
      if (!timeMatch) {
        throw new Error('Invalid time format');
      }
      
      let hour = parseInt(timeMatch[1], 10);
      const minute = parseInt(timeMatch[2], 10);
      const period = timeMatch[3].toUpperCase();
      
      // Convert to 24-hour format (matching Python's %I:%M %p parsing)
      if (period === 'PM' && hour !== 12) {
        hour += 12;
      } else if (period === 'AM' && hour === 12) {
        hour = 0;
      }
      
      const monthMap = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };
      
      // Use year 2000 as reference (matching Python implementation)
      const date = new Date(2000, monthMap[month], parseInt(day, 10), hour, minute, 0, 0);
      return date;
    };
    
    const depTime = parseTime(departureTime);
    let arrTime = parseTime(arrivalTime);
    
    // If arrival is before departure, add a day (matching Python logic)
    if (arrTime < depTime) {
      arrTime.setDate(arrTime.getDate() + 1);
    }
    
    // Calculate duration
    const durationMs = arrTime - depTime;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  } catch (error) {
    console.error("Duration calculation error:", error, "for", departureTime, "to", arrivalTime);
    return "N/A";
  }
};

/**
 * Check seat availability for trains between origin and destination
 * Optimized to reuse cached token (similar to Flask applications)
 * @param {string} origin - Origin station
 * @param {string} destination - Destination station
 * @param {string} date - Journey date in DD-MMM-YYYY format
 * @param {string} seatClass - Seat class (default: S_CHAIR)
 * @param {AbortSignal} signal - Abort signal for cancellation
 * @returns {Promise<Object>} - Seat availability data for all trains
 */
export const checkSeatAvailability = async (origin, destination, date, seatClass = 'S_CHAIR', onProgress = null, signal = null) => {
  try {
    // Validate credentials first
    const credentials = await validateCredentials();

    if (onProgress) onProgress('Connecting to railway system...', 5);

    // Fetch available trains using GET with query parameters (same as getSeatAvailability)
    const url = `${BASE_URL}/bookings/search-trips-v2`;
    const params = new URLSearchParams({
      from_city: origin,
      to_city: destination,
      date_of_journey: date,
      seat_class: seatClass
    });

    const maxRetries = 2;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        const response = await fetch(`${url}?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${credentials.authToken}`,
            'x-device-key': credentials.deviceKey,
            'Content-Type': 'application/json',
          },
          signal: signal
        });

        // Handle rate limiting (429)
        if (response.status === 429) {
          throw new Error("You are requesting too frequently. Please wait and try after some time.");
        }

        // Handle 401 unauthorized (invalid credentials)
        if (response.status === 401) {
          try {
            const errorData = await response.json();
            const errorMessages = errorData.error?.messages || [];
            if (Array.isArray(errorMessages)) {
              for (const msg of errorMessages) {
                if (msg.includes("Invalid User Access Token!")) {
                  throw new Error("AUTH_TOKEN_EXPIRED");
                } else if (msg.includes("You are not authorized for this request") || msg.includes("Please login first")) {
                  throw new Error("AUTH_DEVICE_KEY_EXPIRED");
                }
              }
            }
          } catch (jsonError) {
            if (jsonError.message === "AUTH_TOKEN_EXPIRED" || jsonError.message === "AUTH_DEVICE_KEY_EXPIRED") {
              throw jsonError;
            }
          }
          throw new Error("AUTH_TOKEN_EXPIRED");
        }

        if (response.status === 422) {
          throw new Error("No trains found for the given criteria.");
        }

        if (response.status === 403) {
          throw new Error("Rate limit exceeded. Please try again later.");
        }

        if (response.status >= 500) {
          retryCount += 1;
          if (retryCount === maxRetries) {
            throw new Error("We're facing a problem with the Bangladesh Railway website. Please try again in a few minutes.");
          }
          continue;
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const trains = data.data?.trains || [];

        if (trains.length === 0) {
          throw new Error("No trains found for the given criteria.");
        }

        if (onProgress) onProgress(`Found ${trains.length} train${trains.length > 1 ? 's' : ''}`, 10);

        // Process each train - Use trip_number as key (matches Flask backend)
        const result = {};
        let allFailed422 = true;
        
        // Maximum concurrency: 10 requests at a time (same as matrix calculator)
        const MAX_CONCURRENT_REQUESTS = 10;
        
        // Collect all seat type requests across all trains
        const allSeatRequests = [];
        const trainMetadata = {};
        
        trains.forEach(train => {
          const tripNumber = train.trip_number || train.train_name || 'Unknown Train';
          
          // Initialize result structure for this train
          result[tripNumber] = {
            from_station: train.from_station_name || origin,
            to_station: train.to_station_name || destination,
            departure_time: train.departure_date_time || 'N/A',
            arrival_time: train.arrival_date_time || 'N/A',
            journey_duration: calculateJourneyDuration(
              train.departure_date_time || '',
              train.arrival_date_time || ''
            ),
            seat_data: []
          };
          
          trainMetadata[tripNumber] = {
            seatTypeCount: 0
          };
          
          // Queue all seat type requests for this train
          const seatTypes = train.seat_types || [];
          seatTypes.forEach(seatType => {
            allSeatRequests.push({
              tripNumber,
              seatType,
              train
            });
            trainMetadata[tripNumber].seatTypeCount++;
          });
        });
        
        // Process with concurrent batch requests (10 at a time)
        let completedCount = 0;
        const totalCount = allSeatRequests.length;
        
        const processWithConcurrency = async (requests) => {
          const results = [];
          const executing = new Set();
          
          for (const request of requests) {
            // Limit concurrent requests
            while (executing.size >= MAX_CONCURRENT_REQUESTS) {
              await Promise.race(executing);
            }
            
            const promise = (async () => {
              const { tripNumber, seatType } = request;
              try {
                const seatLayoutData = await fetchSeatLayout(
                  seatType.trip_id,
                  seatType.trip_route_id,
                  signal
                );
                
                completedCount++;
                if (onProgress) {
                  const progressPercent = 10 + Math.round((completedCount / totalCount) * 80);
                  onProgress(`Processing seats... (${completedCount}/${totalCount})`, progressPercent);
                }
                
                return {
                  success: true,
                  tripNumber,
                  seatData: {
                    type: seatType.type || 'Unknown',
                    ...seatLayoutData
                  }
                };
              } catch (error) {
                console.error(`Error fetching seat layout for ${tripNumber} - ${seatType.type}:`, error);
                
                completedCount++;
                if (onProgress) {
                  const progressPercent = 10 + Math.round((completedCount / totalCount) * 80);
                  onProgress(`Processing seats... (${completedCount}/${totalCount})`, progressPercent);
                }
                
                // Extract error_info if it exists (for 422 errors)
                let errorInfo = null;
                if (error.error_info) {
                  errorInfo = error.error_info;
                }
                
                return {
                  success: false,
                  tripNumber,
                  seatData: {
                    type: seatType.type || 'Unknown',
                    is_422: true,
                    error_info: errorInfo,
                    error_message: error.message || 'Failed to fetch seat information',
                    available_count: 0,
                    booking_process_count: 0,
                    ticket_types: {},
                    grouped_seats: {},
                    grouped_booking_process: {},
                    grouped_ticket_types: {}
                  }
                };
              }
            })();
            
            executing.add(promise);
            results.push(promise);
            
            promise.finally(() => executing.delete(promise));
          }
          
          return await Promise.allSettled(results);
        };
        
        // Execute all requests with concurrency
        const seatResults = await processWithConcurrency(allSeatRequests);
        
        // Organize results back to train structure
        seatResults.forEach((promiseResult) => {
          if (promiseResult.status === 'fulfilled') {
            const { success, tripNumber, seatData } = promiseResult.value;
            
            result[tripNumber].seat_data.push(seatData);
            
            if (success && !seatData.is_422) {
              allFailed422 = false;
            }
          }
        });
        
        // Check if all seat types have 422 error for each train, and add error_message
        // This matches Python app.py lines 396-438
        Object.keys(result).forEach(tripNumber => {
          const trainDetails = result[tripNumber];
          let trainHas422Error = false;
          let trainErrorMessage = null;
          
          // First pass: determine if train has any 422 errors and set trainErrorMessage
          for (const seatType of trainDetails.seat_data) {
            if (seatType.is_422 && seatType.error_info) {
              trainHas422Error = true;
              const message = seatType.error_info.message || '';
              const errorKey = seatType.error_info.errorKey || '';
              
              // Match Python app.py lines 566-570
              if (errorKey === 'OrderLimitExceeded' && trainErrorMessage === null) {
                trainErrorMessage = 'Please retry with a different account as you have reached the maximum order limit for this train on the selected day, so seat info cannot be fetched at this moment.';
              } else if (trainErrorMessage === null) {
                trainErrorMessage = 'Please retry with a different account to get seat info for this train.';
              }
            }
          }
          
          // Second pass: if trainErrorMessage is set, apply it to ALL seat types (Python line 434-435)
          if (trainErrorMessage) {
            for (const seatType of trainDetails.seat_data) {
              seatType.error_message = trainErrorMessage;
            }
          }
          
          // Determine if ALL seat types have 422 error (Python line 436-438)
          const allSeats422 = trainDetails.seat_data.every(st => st.is_422);
          trainDetails.all_seats_422 = allSeats422;
        });

        // If all trains failed with 422, analyze error details and throw specific custom message (matches Python lines 518-552)
        if (allFailed422 && trains.length > 0) {
          // Analyze the first train's error to determine the specific message
          let customErrorMessage = null;
          
          for (const trainName of Object.keys(result)) {
            const trainDetails = result[trainName];
            for (const seatType of trainDetails.seat_data) {
              if (seatType.is_422 && seatType.error_info) {
                const message = seatType.error_info.message || "";
                const errorKey = seatType.error_info.errorKey || "";
                
                // Check for ticket purchase timing issue (Python lines 524-528)
                if (message.includes("ticket purchase for this trip will be available") || 
                    message.includes("East Zone") || 
                    message.includes("West Zone")) {
                  const timeMatch = message.match(/(\d+:\d+\s*[APMapm]+)/);
                  const retryTime = timeMatch ? timeMatch[1] : "8:00 AM or 2:00 PM";
                  customErrorMessage = `Ticket purchasing for the selected criteria is not yet available, so seat info cannot be fetched at this moment. Please try again after ${retryTime}. Alternatively, search for a different day.`;
                  break;
                }
                // Check for ongoing purchase process (Python lines 529-534)
                else if (message.includes("Your purchase process is on-going")) {
                  const timeMatch = message.match(/(\d+)\s*minute[s]?\s*(\d+)\s*second[s]?/i);
                  if (timeMatch) {
                    const minutes = parseInt(timeMatch[1]);
                    const seconds = parseInt(timeMatch[2]);
                    const totalSeconds = minutes * 60 + seconds;
                    const retryDate = new Date(Date.now() + totalSeconds * 1000);
                    const retryTime = retryDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                    customErrorMessage = `Your purchase process for some tickets is ongoing for this account, so seat info cannot be fetched at this moment. Please try again after ${retryTime} or retry with a different account.`;
                  } else {
                    customErrorMessage = "Your purchase process for some tickets is ongoing for this account, so seat info cannot be fetched at this moment. Please retry with a different account.";
                  }
                  break;
                }
                // Check for multiple order attempt (Python lines 535-540)
                else if (message.includes("Multiple order attempt detected")) {
                  const timeMatch = message.match(/(\d+)\s*minute[s]?\s*(\d+)\s*second[s]?/i);
                  if (timeMatch) {
                    const minutes = parseInt(timeMatch[1]);
                    const seconds = parseInt(timeMatch[2]);
                    const totalSeconds = minutes * 60 + seconds;
                    const retryDate = new Date(Date.now() + totalSeconds * 1000);
                    const retryTime = retryDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                    customErrorMessage = `You already have an active reservation process in this account, so seat info cannot be fetched at this moment. Please try again after ${retryTime} or retry with a different account.`;
                  } else {
                    customErrorMessage = "You already have an active reservation process in this account, so seat info cannot be fetched at this moment. Please retry with a different account.";
                  }
                  break;
                }
                // Check for OrderLimitExceeded (Python lines 541-543)
                else if (errorKey === "OrderLimitExceeded") {
                  customErrorMessage = "Please retry with a different account as you have reached the maximum order limit for all trains between your chosen stations on the selected day, so seat info cannot be fetched at this moment. Alternatively, search for a different day.";
                  break;
                }
              }
            }
            if (customErrorMessage) break;
          }
          
          // If no specific error was identified, use generic message (Python lines 544-545)
          if (!customErrorMessage) {
            customErrorMessage = "An error occurred while fetching seat details. Please retry with a different account for the given criteria.";
          }
          
          const error = new Error(customErrorMessage);
          error.details = result;
          throw error;
        }

        if (onProgress) onProgress('Finalizing results...', 95);

        return result;

      } catch (error) {
        if (error.message === 'AUTH_TOKEN_EXPIRED' || 
            error.message === 'AUTH_DEVICE_KEY_EXPIRED' ||
            error.message.includes('INVALID_CREDENTIALS:') || 
            error.message.includes('CREDENTIALS_ERROR:')) {
          throw error;
        }

        // Check if this is our "No trains found" error - don't retry, just throw it
        if (error.message === "No trains found for the given criteria.") {
          throw error;
        }

        // Check if this is any of our custom 422 error messages - don't retry, just throw them
        if (error.message.includes("Ticket purchasing for the selected criteria is not yet available") ||
            error.message.includes("Your purchase process for some tickets is ongoing") ||
            error.message.includes("You already have an active reservation process") ||
            error.message.includes("maximum order limit for all trains") ||
            error.message.includes("An error occurred while fetching seat details")) {
          throw error;
        }

        if (error.message.includes("Network request failed") || error.message.includes("Failed to fetch")) {
          throw new Error("We couldn't reach the Bangladesh Railway website. Please check your internet connection and try again.");
        }

        // Only retry on server errors if we have a response object
        if (error.response?.status >= 500 && retryCount < maxRetries - 1) {
          retryCount++;
          continue;
        }

        throw error;
      }
    }

  } catch (error) {
    if (error.message === 'AUTH_TOKEN_EXPIRED' || 
        error.message === 'AUTH_DEVICE_KEY_EXPIRED' ||
        error.message.includes('INVALID_CREDENTIALS:') || 
        error.message.includes('CREDENTIALS_ERROR:')) {
      throw error;
    }

    throw new Error(error.message || 'Failed to check seat availability');
  }
};