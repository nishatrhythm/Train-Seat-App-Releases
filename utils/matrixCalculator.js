import { 
  fetchTrainData, 
  getSeatAvailability, 
  SEAT_TYPES, 
  extractTrainModel,
  formatDateForAPI,
  parseDateString,
  validateCredentials
} from './railwayAPI';

/**
 * Validate train schedule for the selected date
 * @param {string} journeyDateStr - Journey date in DD-MMM-YYYY format
 * @param {Array} days - Array of days when train runs
 * @param {string} trainName - Train name for error message
 */
const validateTrainSchedule = (journeyDateStr, days, trainName) => {
  try {
    // Parse DD-MMM-YYYY format
    const [day, month, year] = journeyDateStr.split('-');
    const monthMap = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    
    const monthIndex = monthMap[month];
    if (monthIndex === undefined) {
      throw new Error(`Invalid month: ${month}`);
    }
    
    const date = new Date(parseInt(year), monthIndex, parseInt(day));
    const weekdayShort = date.toLocaleDateString('en-US', { weekday: 'short' });
    const weekdayFull = date.toLocaleDateString('en-US', { weekday: 'long' });

    // Comment out these two lines below as trains run every day temporarily on EID journey
    if (!days.includes(weekdayShort)) {
      throw new Error(`${trainName} does not run on ${weekdayFull}.`);
    }
  } catch (error) {
    if (error.message.includes('does not run')) {
      throw error;
    }
    throw new Error(`Date validation failed: ${error.message}`);
  }
};

/**
 * Clean halt times in route data - match Python logic exactly
 * @param {Array} routes - Array of route stops
 */
const cleanHaltTimes = (routes) => {
  for (const stop of routes) {
    const arrivalTime = stop.arrival_time;
    const departureTime = stop.departure_time;
    const halt = stop.halt;

    if (arrivalTime && departureTime && halt) {
      try {
        // Clean arrival time
        const arrivalClean = arrivalTime.replace(" BST", "").trim();
        const [arrHourMin, arrAmPm] = arrivalClean.split(' ');
        let [arrHour, arrMinute] = arrHourMin.split(':').map(num => parseInt(num, 10));
        const arrAmPmLower = arrAmPm.toLowerCase();

        if (arrAmPmLower === "pm" && arrHour !== 12) {
          arrHour += 12;
        } else if (arrAmPmLower === "am" && arrHour === 12) {
          arrHour = 0;
        }

        // Clean departure time
        const departureClean = departureTime.replace(" BST", "").trim();
        const [depHourMin, depAmPm] = departureClean.split(' ');
        let [depHour, depMinute] = depHourMin.split(':').map(num => parseInt(num, 10));
        const depAmPmLower = depAmPm.toLowerCase();

        if (depAmPmLower === "pm" && depHour !== 12) {
          depHour += 12;
        } else if (depAmPmLower === "am" && depHour === 12) {
          depHour = 0;
        }

        // Calculate minutes from midnight
        const arrivalMinutes = arrHour * 60 + arrMinute;
        let departureMinutes = depHour * 60 + depMinute;

        // Handle next day departure
        if (departureMinutes < arrivalMinutes) {
          departureMinutes += 24 * 60;
        }

        const haltMinutes = departureMinutes - arrivalMinutes;

        try {
          const haltInt = parseInt(halt, 10);
          if (haltInt > 120 || haltInt < 0) {
            stop.halt = haltMinutes.toString();
          }
        } catch (error) {
          stop.halt = haltMinutes.toString();
        }
      } catch (error) {
        // Skip if unable to process - match Python's continue
        continue;
      }
    }
  }
};

/**
 * Calculate station dates for multi-day journeys - exact Python port
 * @param {Array} routes - Array of route stops
 * @param {Date} baseDate - Base journey date
 * @returns {Object} - Object with station dates
 */
const calculateStationDates = (routes, baseDate) => {
  try {
    // Use a more reliable date tracking approach
    let currentYear = baseDate.getFullYear();
    let currentMonth = baseDate.getMonth(); // 0-based
    let currentDay = baseDate.getDate();
    
    let previousTime = null;
    const MAX_REASONABLE_GAP_HOURS = 12;
    const stationDates = {};

    for (let i = 0; i < routes.length; i++) {
      const stop = routes[i];
      stop.display_date = null;
      const timeStr = stop.departure_time || stop.arrival_time;

      if (timeStr && timeStr.includes("BST")) {
        const timeClean = timeStr.replace(" BST", "").trim();
        try {
          const [hourMin, amPm] = timeClean.split(' ');
          let [hour, minute] = hourMin.split(':').map(num => parseInt(num, 10));
          const amPmLower = amPm.toLowerCase();

          if (amPmLower === "pm" && hour !== 12) {
            hour += 12;
          } else if (amPmLower === "am" && hour === 12) {
            hour = 0;
          }

          // Create timedelta equivalent - hours and minutes from midnight
          const currentTime = { hours: hour, minutes: minute };

          if (previousTime !== null) {
            // Calculate time difference in seconds like Python's timedelta
            const currentSeconds = hour * 3600 + minute * 60;
            const previousSeconds = previousTime.hours * 3600 + previousTime.minutes * 60;
            
            if (currentSeconds < previousSeconds) {
              // Next day crossing detected!
              const timeDiff = ((currentSeconds + 24 * 3600) - previousSeconds) / 3600;
              
              if (timeDiff < MAX_REASONABLE_GAP_HOURS) {
                // Set display date for previous stop
                if (i > 0) {
                  const monthAbbr = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                                    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                  const dayStr = currentDay.toString().padStart(2, '0');
                  const monthStr = monthAbbr[currentMonth];
                  routes[i - 1].display_date = `${dayStr} ${monthStr}`;
                }
                
                // CRITICAL: Advance to next day like Python's current_date += timedelta(days=1)
                const currentDate = new Date(currentYear, currentMonth, currentDay);
                currentDate.setDate(currentDate.getDate() + 1);
                currentYear = currentDate.getFullYear();
                currentMonth = currentDate.getMonth();
                currentDay = currentDate.getDate();
                
                // Set display date for current stop
                const monthAbbr = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                const dayStr = currentDay.toString().padStart(2, '0');
                const monthStr = monthAbbr[currentMonth];
                stop.display_date = `${dayStr} ${monthStr}`;
              } else {
                // Python's else clause for large time gaps
                const hours = Math.floor(timeDiff);
                const minutes = Math.floor((timeDiff - hours) * 60);
              }
            } else {
              console.log(`Normal time progression - no date change needed`);
            }
          }

          previousTime = currentTime;
        } catch (timeError) {
          console.warn(`Error processing time for station ${stop.city}:`, timeError);
          continue;
        }
      }

      // CRITICAL: Set station date using current updated date
      const stationDateStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${currentDay.toString().padStart(2, '0')}`;
      stationDates[stop.city] = stationDateStr;
    }

    return stationDates;
  } catch (error) {
    console.error('Error in calculateStationDates:', error);
    throw new Error(`Date calculation failed: ${error.message}`);
  }
};

/**
 * Compute seat availability matrix for a train
 * @param {string} trainModel - Train model/number
 * @param {string} journeyDateStr - Journey date in DD-MMM-YYYY format
 * @param {string} apiDateFormat - Journey date in YYYY-MM-DD format
 * @param {Function} onProgress - Progress callback function
 * @param {AbortSignal} signal - Abort signal for cancellation
 * @returns {Promise<Object>} - Complete matrix data
 */
export const computeMatrix = async (trainModel, journeyDateStr, apiDateFormat, onProgress, signal = null) => {
  try {
    // Check for cancellation
    if (signal?.aborted) {
      throw new Error('Operation canceled');
    }
    
    // Step 1: Fetch train information (no authentication required)
    if (onProgress) onProgress("Fetching train information...", 2);

    // Fetch train data
    const trainData = await fetchTrainData(trainModel, apiDateFormat, signal);
    
    if (!trainData || !trainData.train_name || !trainData.routes) {
      throw new Error("No information found for this train. Please try another train or date.");
    }

    // Step 2: Validate train schedule (check if train runs on selected day)
    if (onProgress) onProgress("Validating train schedule...", 4);
    
    // Check for cancellation
    if (signal?.aborted) {
      throw new Error('Operation canceled');
    }
    
    const stations = trainData.routes.map(r => r.city);
    const days = trainData.days;
    const trainName = trainData.train_name;
    const routes = trainData.routes;
    const totalDuration = trainData.total_duration || 'N/A';

    // Validate train schedule (enabled like reference project)
    validateTrainSchedule(journeyDateStr, days, trainName);

    // Step 3: Process route information
    if (onProgress) onProgress("Processing route information...", 6);

    // Check for cancellation
    if (signal?.aborted) {
      throw new Error('Operation canceled');
    }

    // Clean halt times
    cleanHaltTimes(trainData.routes);

    if (onProgress) onProgress("Calculating station dates...", 8);

    // Calculate station dates - parse the journey date properly
    let baseDate;
    try {
      // Parse DD-MMM-YYYY format (e.g., "28-Sep-2025")
      const [day, month, year] = journeyDateStr.split('-');
      const monthMap = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };
      const monthIndex = monthMap[month];
      if (monthIndex === undefined) {
        throw new Error(`Invalid month: ${month}`);
      }
      baseDate = new Date(parseInt(year), monthIndex, parseInt(day));
      console.log('Parsed base date:', baseDate);
    } catch (dateError) {
      console.error('Date parsing error:', dateError);
      throw new Error(`Invalid date format: ${journeyDateStr}. Expected DD-MMM-YYYY format.`);
    }

    const stationDates = calculateStationDates(routes, baseDate);

    // Initialize fare matrices
    const fareMatrices = {};
    const seatTypeHasData = {};

    SEAT_TYPES.forEach(seatType => {
      fareMatrices[seatType] = {};
      seatTypeHasData[seatType] = false;
      
      stations.forEach(fromCity => {
        fareMatrices[seatType][fromCity] = {};
      });
    });

    if (onProgress) onProgress("Preparing route data...", 10);

    // Check for cancellation
    if (signal?.aborted) {
      throw new Error('Operation canceled');
    }

    // Create all route combinations - match Python logic exactly
    const routeCombinations = [];
    for (let i = 0; i < stations.length; i++) {
      for (let j = i + 1; j < stations.length; j++) {
        const stationDateStr = stationDates[stations[i]];
        // Format date exactly like Python: datetime.strptime(station_dates[from_city], "%Y-%m-%d").strftime("%d-%b-%Y")
        const [year, month, day] = stationDateStr.split('-');
        const monthAbbr = [
          "Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
        ];
        const monthIndex = parseInt(month, 10) - 1;
        const monthStr = monthAbbr[monthIndex];
        const dayStr = parseInt(day, 10).toString().padStart(2, '0');
        const formattedDate = `${dayStr}-${monthStr}-${year}`;
        
        routeCombinations.push({
          fromCity: stations[i],
          toCity: stations[j],
          date: formattedDate
        });
      }
    }

    // Step 4: Validate credentials before processing
    if (onProgress) onProgress("Validating credentials...", 12);
    
    // Check for cancellation
    if (signal?.aborted) {
      throw new Error('Operation canceled');
    }
    
    // Validate credentials - will throw error if not set
    await validateCredentials();

    if (onProgress) onProgress("Processing routes...", 15);

    // Maximum concurrency: 10 like Python version (ThreadPoolExecutor(max_workers=10))
    const MAX_CONCURRENT_REQUESTS = 10;
    let completedCount = 0;
    const totalCount = routeCombinations.length;
    
    // Process with same concurrency as Python version
    const processWithOptimalSpeed = async (items) => {
      const results = [];
      const executing = new Set();
      
      for (const item of items) {
        while (executing.size >= MAX_CONCURRENT_REQUESTS) {
          await Promise.race(executing);
        }
        
        const promise = (async () => {
          const { fromCity, toCity, date } = item;
          try {
            // Check for cancellation before making request
            if (signal?.aborted) {
              throw new Error('Operation canceled');
            }
            
            const result = await getSeatAvailability(trainModel, date, fromCity, toCity, signal);
            
            completedCount++;
            if (onProgress) {
              const progressPercent = 15 + Math.round((completedCount / totalCount) * 70);
              onProgress(`Processing routes... (${completedCount}/${totalCount})`, progressPercent);
            }
            return { success: true, fromCity, toCity, seatInfo: result };
          } catch (error) {
            completedCount++;
            if (onProgress) {
              const progressPercent = 15 + Math.round((completedCount / totalCount) * 70);
              onProgress(`Processing routes... (${completedCount}/${totalCount})`, progressPercent);
            }
            
            // Check if error is due to cancellation
            if (signal?.aborted || error.name === 'AbortError' || error.message.includes('canceled')) {
              throw error; // Re-throw cancellation errors
            }
            
            // Check if this is a critical authentication error that should stop matrix computation
            if (error.message === 'AUTH_TOKEN_EXPIRED' || 
                error.message === 'AUTH_DEVICE_KEY_EXPIRED' ||
                error.message.includes('INVALID_CREDENTIALS:') || 
                error.message.includes('CREDENTIALS_ERROR:') ||
                error.message.includes('Authentication failed:')) {
              throw error; // Re-throw authentication errors to stop matrix computation
            }
            
            return { success: false, fromCity, toCity, seatInfo: null, error: error.message };
          }
        })();
        
        executing.add(promise);
        results.push(promise);
        
        promise.finally(() => executing.delete(promise));
      }
      
      return await Promise.allSettled(results);
    };
    
    // Execute all requests with optimal speed matching Python version
    const results = await processWithOptimalSpeed(routeCombinations);
    
    // Process all results - match exact Python logic including nested loop bug
    let successCount = 0;
    let failureCount = 0;
    
    console.log('\n🔍 Processing results summary:');
    
    results.forEach((promiseResult, index) => {
      if (promiseResult.status === 'fulfilled') {
        const { success, fromCity, toCity, seatInfo } = promiseResult.value;
        
        if (success) {
          successCount++;
          
          // Log what seat types have data
          if (seatInfo) {
            const seatsWithData = SEAT_TYPES.filter(st => 
              seatInfo[st] && (seatInfo[st].online + seatInfo[st].offline) > 0
            );
            if (seatsWithData.length > 0) {
              console.log(`  ✓ ${fromCity} → ${toCity}: ${seatsWithData.join(', ')}`);
            } else {
              console.log(`  ⚠ ${fromCity} → ${toCity}: No seats available in any type`);
            }
          }
        } else {
          failureCount++;
        }
        
        // First loop: Process the seat data exactly like Python version
        SEAT_TYPES.forEach(seatType => {
          const seatData = seatInfo ? 
            (seatInfo[seatType] || { online: 0, offline: 0, fare: 0 }) : 
            { online: 0, offline: 0, fare: 0 };
          
          fareMatrices[seatType][fromCity][toCity] = seatData;
        });
        
        // Second loop: Check if seat types have data - match Python's nested structure
        if (seatInfo) {
          SEAT_TYPES.forEach(seatType => {
            if (seatInfo[seatType] && 
                (seatInfo[seatType].online + seatInfo[seatType].offline) > 0) {
              seatTypeHasData[seatType] = true;
            }
          });
        }
      } else {
        failureCount++;
        console.error(`Promise rejected for route ${index}:`, promiseResult.reason);
      }
    });

    console.log(`Concurrent requests completed: ${successCount} successful, ${failureCount} failed`);

    // Log performance metrics
    const totalRequests = routeCombinations.length;
    const successRate = (successCount / totalRequests * 100).toFixed(1);
    console.log(`Request success rate: ${successRate}%`);

    // Check if any seat type has data
    console.log('\n📈 Seat type data availability:');
    SEAT_TYPES.forEach(seatType => {
      console.log(`  ${seatType}: ${seatTypeHasData[seatType] ? '✓ Has data' : '✗ No data'}`);
    });
    
    const hasAnyData = Object.values(seatTypeHasData).some(hasData => hasData);
    console.log(`\n🎯 Overall: ${hasAnyData ? 'At least one seat type has data' : 'NO seat types have data'}\n`);
    
    if (!hasAnyData) {
      throw new Error("No seats available for the selected train and date. Please try a different date or train.");
    }

    if (onProgress) onProgress("Finalizing results...", 87);

    // Final check for cancellation
    if (signal?.aborted) {
      throw new Error('Operation canceled');
    }

    // Format station dates for display - match Python logic exactly
    const stationDatesFormatted = {};
    Object.entries(stationDates).forEach(([station, dateStr]) => {
      // Parse YYYY-MM-DD format and format to DD-MMM-YYYY like Python
      const [year, month, day] = dateStr.split('-');
      const monthAbbr = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
      ];
      const monthIndex = parseInt(month, 10) - 1;
      const monthStr = monthAbbr[monthIndex];
      const dayStr = parseInt(day, 10).toString().padStart(2, '0');
      
      stationDatesFormatted[station] = `${dayStr}-${monthStr}-${year}`;
    });

    // Check for segmented dates - match Python logic exactly
    const uniqueDates = new Set(Object.values(stationDates));
    const hasSegmentedDates = uniqueDates.size > 1;
    
    let nextDayStr = "";
    let prevDayStr = "";
    if (hasSegmentedDates) {
      // Parse journey_date_str format (DD-MMM-YYYY) like Python
      const [day, month, year] = journeyDateStr.split('-');
      const monthMap = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };
      const monthIndex = monthMap[month];
      const dateObj = new Date(parseInt(year), monthIndex, parseInt(day));
      
      const nextDay = new Date(dateObj);
      nextDay.setDate(nextDay.getDate() + 1);
      const prevDay = new Date(dateObj);
      prevDay.setDate(prevDay.getDate() - 1);
      
      // Format exactly like Python version
      const formatPythonStyle = (date) => {
        const monthAbbr = [
          "Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
        ];
        const dayStr = date.getDate().toString().padStart(2, '0');
        const monthStr = monthAbbr[date.getMonth()];
        const yearStr = date.getFullYear();
        return `${dayStr}-${monthStr}-${yearStr}`;
      };
      
      nextDayStr = formatPythonStyle(nextDay);
      prevDayStr = formatPythonStyle(prevDay);
    }

    if (onProgress) onProgress("Complete!", 100);

    console.log('Matrix computation completed successfully');

    // Return object with camelCase for JavaScript frontend compatibility
    return {
      trainModel,
      trainName,
      date: journeyDateStr,
      stations,
      seatTypes: SEAT_TYPES,
      fareMatrices,
      hasDataMap: seatTypeHasData,
      routes,
      days,
      totalDuration,
      stationDates,
      stationDatesFormatted,
      hasSegmentedDates,
      nextDayStr,
      prevDayStr,
    };

  } catch (error) {
    console.error('Matrix computation error:', error);
    
    // Preserve AUTH errors
    if (error.message === 'AUTH_TOKEN_EXPIRED' || error.message === 'AUTH_DEVICE_KEY_EXPIRED') {
      throw error;
    }
    
    // Preserve other specific error messages
    if (error.message.includes('INVALID_CREDENTIALS:') || 
        error.message.includes('CREDENTIALS_ERROR:') ||
        error.message.includes('does not run on')) {
      throw error;
    }
    
    throw new Error(`Matrix computation failed: ${error.message}`);
  }
};