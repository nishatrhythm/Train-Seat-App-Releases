import { 
  StyleSheet, 
  View, 
  ScrollView,
  RefreshControl,
  Alert,
  Dimensions,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  StatusBar,
  FlatList,
  TextInput as RNTextInput,
  Animated,
} from 'react-native';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Card, 
  Text, 
  TextInput, 
  Button,
  Portal,
  Dialog,
  useTheme,
  Surface,
  Avatar,
  List,
  Divider,
  Icon,
  ProgressBar,
  ActivityIndicator,
} from 'react-native-paper';
import { Calendar } from 'react-native-calendars';
import { computeMatrix } from '../utils/matrixCalculator';
import { extractTrainModel, parseDateString, searchTrainsBetweenStations } from '../utils/railwayAPI';
import { useNavigation } from '@react-navigation/native';
import { checkForUpdate, openUpdateUrl } from '../utils/updateChecker';
import { checkForNotice, dismissNotice } from '../utils/noticeChecker';
import { getStations, getTrains, refreshData } from '../utils/firebaseData';

const { width } = Dimensions.get('window');

// Optimized Train Description Component
const TrainDescription = React.memo(({ originCity, destinationCity, zone }) => (
  <View style={styles.trainRouteContainer}>
    <Text style={styles.trainRoute}>
      {originCity} → {destinationCity}
    </Text>
    <View style={styles.trainZoneBadge}>
      <Text style={styles.trainZoneText}>{zone}</Text>
    </View>
  </View>
));

// Optimized Train List Item Component
const TrainListItem = React.memo(({ item, index, onPress, showDivider, totalItems }) => (
  <View>
    <List.Item
      title={item.train_name}
      titleNumberOfLines={0}
      titleEllipsizeMode='tail'
      description={() => <TrainDescription originCity={item.origin_city} destinationCity={item.destination_city} zone={item.zone} />}
      onPress={() => onPress(item)}
      style={styles.trainListItem}
      titleStyle={styles.trainTitle}
    />
    {showDivider && index < totalItems - 1 && <Divider style={styles.trainDivider} />}
  </View>
));

// Optimized Station List Item Component
const StationListItem = React.memo(({ item, index, onPress, showDivider, totalItems }) => (
  <View>
    <List.Item
      title={item}
      titleNumberOfLines={1}
      titleEllipsizeMode='tail'
      onPress={() => onPress(item)}
      style={styles.stationListItem}
      titleStyle={styles.stationTitle}
    />
    {showDivider && index < totalItems - 1 && <Divider style={styles.stationDivider} />}
  </View>
));

export default function HomeScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const scrollViewRef = useRef(null);
  const trainNameContainerRef = useRef(null);
  const trainResultsRef = useRef(null);
  const searchInputRef = useRef(null);
  const originSearchInputRef = useRef(null);
  const destinationSearchInputRef = useRef(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [trainName, setTrainName] = useState('');
  const [selectedTrain, setSelectedTrain] = useState(null);
  const [showTrainDropdown, setShowTrainDropdown] = useState(false);
  const [trainSearchQuery, setTrainSearchQuery] = useState('');
  const [customTrainName, setCustomTrainName] = useState('');
  const [journeyDate, setJourneyDate] = useState('');
  const [selectedDateString, setSelectedDateString] = useState(''); // Store the raw date string
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isCredentialError, setIsCredentialError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [abortController, setAbortController] = useState(null);
  const [keyboardType, setKeyboardType] = useState('default');

  // Train Search related state
  const [showTrainSearch, setShowTrainSearch] = useState(false);
  const [originStation, setOriginStation] = useState('');
  const [destinationStation, setDestinationStation] = useState('');
  const [showOriginDialog, setShowOriginDialog] = useState(false);
  const [showDestinationDialog, setShowDestinationDialog] = useState(false);
  const [originSearchQuery, setOriginSearchQuery] = useState('');
  const [destinationSearchQuery, setDestinationSearchQuery] = useState('');
  const [trainSearchResults, setTrainSearchResults] = useState([]);
  const [showTrainSearchResults, setShowTrainSearchResults] = useState(false);
  const [isSearchingTrains, setIsSearchingTrains] = useState(false);
  const [trainSearchProgress, setTrainSearchProgress] = useState(0);
  const [trainSearchMessage, setTrainSearchMessage] = useState('');
  const [trainSearchAbortController, setTrainSearchAbortController] = useState(null);

  // Update check states
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);

  // Notice dialog states
  const [showNoticeDialog, setShowNoticeDialog] = useState(false);
  const [noticeInfo, setNoticeInfo] = useState(null);

  // Firebase data states
  const [trains, setTrains] = useState([]);
  const [stations, setStations] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Load Firebase data on mount
  useEffect(() => {
    const loadFirebaseData = async () => {
      try {
        setIsLoadingData(true);
        const [stationsData, trainsData] = await Promise.all([
          getStations(),
          getTrains(),
        ]);
        setStations(stationsData);
        setTrains(trainsData);
        console.log('Firebase data loaded successfully');
      } catch (error) {
        console.error('Error loading Firebase data:', error);
        // Data will use fallback to local files in firebaseData.js
      } finally {
        setIsLoadingData(false);
      }
    };

    loadFirebaseData();
  }, []);

  // Auto-focus the search input when train dropdown opens
  useEffect(() => {
    if (showTrainDropdown) {
      // Small delay to ensure the dialog is fully rendered
      const timer = setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showTrainDropdown]);

  // Auto-focus the search input when origin dialog opens
  useEffect(() => {
    if (showOriginDialog) {
      const timer = setTimeout(() => {
        if (originSearchInputRef.current) {
          originSearchInputRef.current.focus();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showOriginDialog]);

  // Auto-focus the search input when destination dialog opens
  useEffect(() => {
    if (showDestinationDialog) {
      const timer = setTimeout(() => {
        if (destinationSearchInputRef.current) {
          destinationSearchInputRef.current.focus();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showDestinationDialog]);

  // Check for app updates on mount
  useEffect(() => {
    const checkAppUpdate = async () => {
      try {
        const update = await checkForUpdate();
        if (update.updateAvailable) {
          setUpdateInfo(update);
          setShowUpdateDialog(true);
        }
      } catch (error) {
        console.error('Error checking for update:', error);
      }
    };

    // Check for update after a small delay to not interfere with initial render
    const timer = setTimeout(() => {
      checkAppUpdate();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // Check for app notices on mount
  useEffect(() => {
    const checkAppNotice = async () => {
      try {
        const notice = await checkForNotice();
        if (notice.shouldShow) {
          setNoticeInfo(notice);
          // Show notice dialog after a delay to let update dialog show first if both are present
          setTimeout(() => {
            setShowNoticeDialog(true);
          }, 500);
        }
      } catch (error) {
        console.error('Error checking for notice:', error);
      }
    };

    // Check for notice after a delay, longer than update check
    const timer = setTimeout(() => {
      checkAppNotice();
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  // Filter trains based on search query
  const filteredTrains = useMemo(() => {
    if (!trainSearchQuery || trainSearchQuery.trim() === '') return trains;
    return trains.filter(train => 
      train.train_name.toLowerCase().includes(trainSearchQuery.toLowerCase()) ||
      train.train_number.toLowerCase().includes(trainSearchQuery.toLowerCase()) ||
      train.origin_city.toLowerCase().includes(trainSearchQuery.toLowerCase()) ||
      train.destination_city.toLowerCase().includes(trainSearchQuery.toLowerCase()) ||
      train.zone.toLowerCase().includes(trainSearchQuery.toLowerCase())
    );
  }, [trainSearchQuery, trains]);

  // Filter stations for origin dropdown
  const filteredOriginStations = useMemo(() => {
    if (!originSearchQuery || originSearchQuery.trim() === '') {
      return stations.filter(station => station !== destinationStation);
    }
    return stations
      .filter(station => 
        station.toLowerCase().includes(originSearchQuery.toLowerCase()) &&
        station !== destinationStation
      );
  }, [originSearchQuery, destinationStation, stations]);

  // Filter stations for destination dropdown
  const filteredDestinationStations = useMemo(() => {
    if (!destinationSearchQuery || destinationSearchQuery.trim() === '') {
      return stations.filter(station => station !== originStation);
    }
    return stations
      .filter(station => 
        station.toLowerCase().includes(destinationSearchQuery.toLowerCase()) &&
        station !== originStation
      );
  }, [destinationSearchQuery, originStation, stations]);

  const handleTrainSelect = (train) => {
    setSelectedTrain(train);
    setTrainName(train.train_name);
    setShowTrainDropdown(false);
    setTrainSearchQuery('');
    setCustomTrainName('');
    setKeyboardType('default'); // Reset keyboard type
  };

  const handleCustomTrainInsert = () => {
    if (customTrainName.trim()) {
      setTrainName(customTrainName.trim());
      setSelectedTrain(null);
      setShowTrainDropdown(false);
      setTrainSearchQuery('');
      setCustomTrainName('');
      setKeyboardType('default'); // Reset keyboard type
    }
  };

  // Train Search Handlers
  const handleOriginStationSelect = (station) => {
    setOriginStation(station);
    setOriginSearchQuery('');
    setShowOriginDialog(false);
  };

  const handleDestinationStationSelect = (station) => {
    setDestinationStation(station);
    setDestinationSearchQuery('');
    setShowDestinationDialog(false);
  };

  const handleSwapStations = () => {
    const tempOrigin = originStation;
    setOriginStation(destinationStation);
    setDestinationStation(tempOrigin);
  };

  const toggleTrainSearch = () => {
    setShowTrainSearch(!showTrainSearch);
  };

  const handleSearchTrains = async () => {
    // Dismiss keyboard when button is pressed
    Keyboard.dismiss();
    
    // Validate inputs
    if (!originStation.trim() && !destinationStation.trim()) {
      setErrorMessage('Please fill in both origin and destination stations');
      setIsCredentialError(false);
      setShowErrorDialog(true);
      return;
    } else if (!originStation.trim()) {
      setErrorMessage('Please fill in origin station');
      setIsCredentialError(false);
      setShowErrorDialog(true);
      return;
    } else if (!destinationStation.trim()) {
      setErrorMessage('Please fill in destination station');
      setIsCredentialError(false);
      setShowErrorDialog(true);
      return;
    }

    if (originStation.trim() === destinationStation.trim()) {
      setErrorMessage('Origin and destination stations cannot be the same');
      setIsCredentialError(false);
      setShowErrorDialog(true);
      return;
    }

    // Check if credentials are set up
    try {
      const { RailwayAccountStorage } = require('../utils/storage');
      const credentials = await RailwayAccountStorage.getCredentials();
      if (!credentials.authToken || !credentials.deviceKey) {
        setErrorMessage('Please set up your Bangladesh Railway account credentials in Settings first.');
        setIsCredentialError(true);
        setShowErrorDialog(true);
        return;
      }
    } catch (credError) {
      console.error('Credential check error:', credError);
      setErrorMessage('Please set up your Bangladesh Railway account credentials in Settings first.');
      setIsCredentialError(true);
      setShowErrorDialog(true);
      return;
    }

    setIsSearchingTrains(true);
    setShowTrainSearchResults(false);
    setTrainSearchResults([]);
    setTrainSearchProgress(0);
    setTrainSearchMessage('Starting search...');

    // Create abort controller for cancellation
    const controller = new AbortController();
    setTrainSearchAbortController(controller);

    try {
      // Progress callback
      const onProgress = (message, progress) => {
        setTrainSearchMessage(message);
        setTrainSearchProgress(progress / 100);
      };

      const results = await searchTrainsBetweenStations(
        originStation.trim(), 
        destinationStation.trim(),
        onProgress,
        controller.signal
      );
      
      if (results.success && results.trains && results.trains.length > 0) {
        setTrainSearchResults(results.trains);
        setShowTrainSearchResults(true);
        
        // Smooth scroll to results like the reference project
        setTimeout(() => {
          if (trainResultsRef.current && scrollViewRef.current) {
            trainResultsRef.current.measureLayout(
              scrollViewRef.current,
              (x, y) => {
                scrollViewRef.current.scrollTo({
                  y: y - 50, // Small offset to show some content above
                  animated: true
                });
              },
              () => {} // Error callback
            );
          }
        }, 150);
      } else {
        setErrorMessage('No trains found for this route');
        setIsCredentialError(false);
        setShowErrorDialog(true);
        setShowTrainSearchResults(false);
      }
    } catch (error) {
      // Handle cancellation
      if (error.message === 'Search canceled' || controller.signal.aborted) {
        console.log('Train search canceled by user');
        setShowTrainSearchResults(false);
        return;
      }

      // Provide more specific error messages following the reference project approach
      let errorMessage = error.message || 'Failed to search trains. Please try again.';
      let isCredError = false;
      
      // Check for AUTH_TOKEN_EXPIRED and AUTH_DEVICE_KEY_EXPIRED first
      if (errorMessage === 'AUTH_TOKEN_EXPIRED') {
        errorMessage = 'Your Auth Token has expired or is invalid (valid for 24 hours). Please update your credentials in Settings with a new token and device key.';
        isCredError = true;
      } else if (errorMessage === 'AUTH_DEVICE_KEY_EXPIRED') {
        errorMessage = 'Your Device Key has expired or is invalid. Please update your credentials in Settings with a new token and device key.';
        isCredError = true;
      }
      // Authentication and credential validation errors
      else if (errorMessage.includes('INVALID_CREDENTIALS:')) {
        errorMessage = errorMessage.replace('INVALID_CREDENTIALS: ', '');
        isCredError = true;
      } else if (errorMessage.includes('CREDENTIALS_ERROR:')) {
        errorMessage = errorMessage.replace('CREDENTIALS_ERROR: ', '');
        isCredError = true;
      } else if (errorMessage.includes('Authentication failed') || errorMessage.includes('Mobile Number or Password is incorrect')) {
        errorMessage = 'Authentication failed. Please check your auth token and device key in Settings and ensure they are valid.';
        isCredError = true;
      } else if (errorMessage.includes('AUTH_CREDENTIALS_REQUIRED') || errorMessage.includes('Railway account credentials not found')) {
        errorMessage = 'Railway credentials not found. Please add your credentials in Settings.';
        isCredError = true;
      }
      // Network and connection errors
      else if (errorMessage.includes('Network request failed') || errorMessage.includes('Failed to fetch')) {
        errorMessage = 'Network connection failed. Please check your internet connection and try again.';
      } else if (errorMessage.includes("We couldn't reach the Bangladesh Railway website")) {
        errorMessage = "We couldn't reach the Bangladesh Railway website. Please check your internet connection and try again.";
      } else if (errorMessage.includes("We're facing a problem with the Bangladesh Railway website")) {
        errorMessage = "We're facing a problem with the Bangladesh Railway website. Please try again in a few minutes.";
      }
      // Rate limiting
      else if (errorMessage.includes('Rate limit exceeded')) {
        errorMessage = 'Too many requests. Please try again in a few minutes.';
      }
      
      setErrorMessage(errorMessage);
      setIsCredentialError(isCredError);
      setShowErrorDialog(true);
      setShowTrainSearchResults(false);
    } finally {
      setIsSearchingTrains(false);
      setTrainSearchAbortController(null);
      setTrainSearchProgress(0);
      setTrainSearchMessage('');
    }
  };

  const triggerFlashAnimation = () => {
    // Start flash animation using state
    setIsFlashing(true);
    
    // Fade back after 1 second (matching reference project timing)
    setTimeout(() => {
      setIsFlashing(false);
    }, 1000);
  };

  const handleCancelTrainSearch = () => {
    if (trainSearchAbortController) {
      trainSearchAbortController.abort();
      setTrainSearchAbortController(null);
    }
    
    setIsSearchingTrains(false);
    setTrainSearchProgress(0);
    setTrainSearchMessage('');
  };

  const handleTrainResultSelect = (train) => {
    const trainName = train.trip_number;
    setTrainName(trainName);
    setSelectedTrain(null);
    
    // Don't reset the train search section - keep it open and keep results
    // setShowTrainSearch(false); // Removed this line
    // setOriginStation(''); // Removed this line
    // setDestinationStation(''); // Removed this line
    // setTrainSearchResults([]); // Removed this line
    // setShowTrainSearchResults(false); // Removed this line
    
    // Trigger flash animation
    triggerFlashAnimation();
    
    // Smooth scroll to train name field with gentle focus
    setTimeout(() => {
      if (trainNameContainerRef.current && scrollViewRef.current) {
        trainNameContainerRef.current.measureLayout(
          scrollViewRef.current,
          (x, y) => {
            scrollViewRef.current.scrollTo({
              y: y - 100, // Offset to show some content above
              animated: true
            });
          },
          () => {} // Error callback
        );
      }
      
      // Focus the input field with a slight delay for better UX
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 300);
    }, 100);
  };

  const handleCancelRequest = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setIsLoading(false);
    setLoadingProgress(0);
    setLoadingMessage('');
  };

  const handleViewSeatMatrix = async () => {
    // Dismiss keyboard when button is pressed
    Keyboard.dismiss();
    
    if (!trainName && !journeyDate) {
      setErrorMessage('Please fill in train name and journey date');
      setIsCredentialError(false);
      setShowErrorDialog(true);
      return;
    } else if (!trainName) {
      setErrorMessage('Please fill in train name');
      setIsCredentialError(false);
      setShowErrorDialog(true);
      return;
    } else if (!journeyDate) {
      setErrorMessage('Please fill in journey date');
      setIsCredentialError(false);
      setShowErrorDialog(true);
      return;
    }

    // Check if credentials are set up
    try {
      const { RailwayAccountStorage } = require('../utils/storage');
      const credentials = await RailwayAccountStorage.getCredentials();
      if (!credentials.authToken || !credentials.deviceKey) {
        setErrorMessage('Please set up your Bangladesh Railway account credentials in Settings first.');
        setIsCredentialError(true);
        setShowErrorDialog(true);
        return;
      }
    } catch (credError) {
      console.error('Credential check error:', credError);
      setErrorMessage('Please set up your Bangladesh Railway account credentials in Settings first.');
      setIsCredentialError(true);
      setShowErrorDialog(true);
      return;
    }

    setIsLoading(true);
    setLoadingProgress(0);
    setLoadingMessage('Starting...');

    // Create abort controller for cancellation
    const controller = new AbortController();
    setAbortController(controller);

    try {
      console.log('Input values:', { trainName, journeyDate });
      
      // Extract train model from train name
      const trainModel = extractTrainModel(trainName);
      console.log('Extracted train model:', trainModel);
      
      // Convert date to API format
      const apiDateFormat = parseDateString(journeyDate);
      console.log('Parsed date for API:', { original: journeyDate, parsed: apiDateFormat });
      
      // Progress callback
      const onProgress = (message, progress) => {
        console.log('Progress:', message, progress + '%');
        setLoadingMessage(message);
        setLoadingProgress(progress / 100);
      };

      // Compute the matrix
      const matrixData = await computeMatrix(trainModel, journeyDate, apiDateFormat, onProgress, controller.signal);
      
      setIsLoading(false);
      setAbortController(null);
      
      // Navigate to results screen
      navigation.navigate('MatrixResults', { matrixData });
      
    } catch (error) {
      setIsLoading(false);
      setAbortController(null);
      console.error('Matrix calculation error:', error);
      
      // Handle cancellation
      if (error.name === 'AbortError' || error.message.includes('canceled') || error.message.includes('aborted')) {
        console.log('Request was cancelled by user');
        return; // Don't show error dialog for user-cancelled requests
      }
      
      // Provide more specific error messages following the reference project approach
      let errorMessage = error.message || 'Failed to compute seat matrix. Please try again.';
      let isCredError = false;
      
      // Check for AUTH_TOKEN_EXPIRED and AUTH_DEVICE_KEY_EXPIRED first
      if (errorMessage === 'AUTH_TOKEN_EXPIRED') {
        errorMessage = 'Your Auth Token has expired or is invalid (valid for 24 hours). Please update your credentials in Settings with a new token and device key.';
        isCredError = true;
      } else if (errorMessage === 'AUTH_DEVICE_KEY_EXPIRED') {
        errorMessage = 'Your Device Key has expired or is invalid. Please update your credentials in Settings with a new token and device key.';
        isCredError = true;
      }
      // Authentication and credential validation errors
      else if (errorMessage.includes('INVALID_CREDENTIALS:')) {
        errorMessage = errorMessage.replace('INVALID_CREDENTIALS: ', '');
        isCredError = true;
      } else if (errorMessage.includes('CREDENTIALS_ERROR:')) {
        errorMessage = errorMessage.replace('CREDENTIALS_ERROR: ', '');
        isCredError = true;
      } else if (errorMessage.includes('Authentication failed') || errorMessage.includes('Mobile Number or Password is incorrect')) {
        errorMessage = 'Authentication failed. Please check your auth token and device key in Settings and ensure they are valid.';
        isCredError = true;
      } else if (errorMessage.includes('AUTH_CREDENTIALS_REQUIRED') || errorMessage.includes('Railway account credentials not found')) {
        errorMessage = 'Railway credentials not found. Please add your credentials in Settings.';
        isCredError = true;
      }
      // Train schedule validation errors  
      else if (errorMessage.includes('does not run on')) {
        errorMessage = errorMessage; // Keep the specific day message
      }
      // Network and connection errors
      else if (errorMessage.includes('Network request failed') || errorMessage.includes('Failed to fetch')) {
        errorMessage = 'Network connection failed. Please check your internet connection and try again.';
      } else if (errorMessage.includes("We couldn't reach the Bangladesh Railway website")) {
        errorMessage = "We couldn't reach the Bangladesh Railway website. Please check your internet connection and try again.";
      } else if (errorMessage.includes("We're facing a problem with the Bangladesh Railway website")) {
        errorMessage = "We're facing a problem with the Bangladesh Railway website. Please try again in a few minutes.";
      }
      // Date validation errors
      else if (errorMessage.includes('Date Value out of bounds') || errorMessage.includes('Invalid date format')) {
        errorMessage = `Invalid date: ${journeyDate}. Please select a different date.`;
      }
      // Rate limiting
      else if (errorMessage.includes('Rate limit exceeded')) {
        errorMessage = 'Too many requests. Please try again in a few minutes.';
      }
      
      setErrorMessage(errorMessage);
      setIsCredentialError(isCredError);
      setShowErrorDialog(true);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    
    try {
      // Refresh Firebase data
      const freshData = await refreshData();
      setStations(freshData.stations);
      setTrains(freshData.trains);
      console.log('Firebase data refreshed');
      
      // Check for app updates (force check on manual refresh)
      const update = await checkForUpdate(true);
      if (update.updateAvailable) {
        setUpdateInfo(update);
        setShowUpdateDialog(true);
      }

      // Check for app notices (force check on manual refresh)
      const notice = await checkForNotice(true);
      if (notice.shouldShow) {
        setNoticeInfo(notice);
        setShowNoticeDialog(true);
      }
    } catch (error) {
      console.error('Error refreshing Firebase data:', error);
    }
    
    // Reset all form fields
    setTrainName('');
    setSelectedTrain(null);
    setTrainSearchQuery('');
    setCustomTrainName('');
    setJourneyDate('');
    setSelectedDateString('');
    setCurrentMonth(new Date().toISOString().slice(0, 7));
    setShowTrainDropdown(false);
    setShowDatePicker(false);
    setShowErrorDialog(false);
    setErrorMessage('');
    setIsCredentialError(false);
    
    // Reset train search fields
    setShowTrainSearch(false);
    setOriginStation('');
    setDestinationStation('');
    setOriginSearchQuery('');
    setDestinationSearchQuery('');
    setTrainSearchResults([]);
    setShowTrainSearchResults(false);
    setIsSearchingTrains(false);
    
    // Reset loading states
    setIsLoading(false);
    setLoadingProgress(0);
    setLoadingMessage('');
    setAbortController(null);
    
    // Simulate a delay for better UX
    setTimeout(() => {
      setRefreshing(false);
    }, 500);
  };

  const onDayPress = (day) => {
    const selectedDateString = day.dateString;
    const todayString = getBangladeshToday();
    const maxDateString = getMaxDate();

    // Check if selected date is within allowed range using string comparison
    if (selectedDateString >= todayString && selectedDateString <= maxDateString) {
      // Create date object for formatting, ensuring it's treated as Bangladesh time
      const selectedDate = new Date(selectedDateString + 'T00:00:00+06:00'); // Force UTC+6 interpretation
      const day = selectedDate.getDate().toString().padStart(2, '0');
      
      // Use hardcoded month abbreviations to match the backend format exactly
      const monthAbbr = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
      ];
      const month = monthAbbr[selectedDate.getMonth()];
      const year = selectedDate.getFullYear();
      
      const formattedDate = `${day}-${month}-${year}`;
      setJourneyDate(formattedDate);
      setSelectedDateString(selectedDateString); // Store the raw date string
      setShowDatePicker(false);
    }
  };

  const onMonthChange = (month) => {
    setCurrentMonth(month.dateString.slice(0, 7)); // Update current month in YYYY-MM format
  };

  const getBangladeshToday = () => {
    // Get current time in Bangladesh (UTC+6)
    const now = new Date();
    const bangladeshTime = new Date(now.getTime() + (6 * 60 * 60 * 1000));
    return bangladeshTime.toISOString().split('T')[0];
  };

  const getMinDate = () => {
    return getBangladeshToday();
  };

  const getMaxDate = () => {
    // Allow booking for next 10 days from today (including today = 11 days total)
    const today = new Date();
    const bangladeshTime = new Date(today.getTime() + (6 * 60 * 60 * 1000));
    bangladeshTime.setDate(bangladeshTime.getDate() + 10);
    return bangladeshTime.toISOString().split('T')[0];
  };

  const disableArrowLeft = () => {
    const minDate = getMinDate();
    const minMonth = minDate.slice(0, 7); // YYYY-MM format
    return currentMonth <= minMonth;
  };

  const disableArrowRight = () => {
    const maxDate = getMaxDate();
    const maxMonth = maxDate.slice(0, 7); // YYYY-MM format
    return currentMonth >= maxMonth;
  };

  const getMarkedDates = () => {
    const marked = {};
    const today = getBangladeshToday();
    const minDate = new Date(today);
    const maxDate = new Date(getMaxDate());
    
    // Use the stored selected date string
    const currentSelectedDateString = selectedDateString;
    
    // Mark today with special styling (current date)
    marked[today] = {
      customStyles: {
        container: {
          backgroundColor: currentSelectedDateString === today ? '#006747' : 'transparent',
          borderColor: '#006747',
          borderWidth: 2,
          borderRadius: 8,
        },
        text: {
          color: currentSelectedDateString === today ? '#FFFFFF' : '#006747',
          fontFamily: 'PlusJakartaSans-Bold',
        },
      },
    };
    
    // Mark available dates (next 11 days)
    for (let date = new Date(minDate.getTime() + 86400000); date <= maxDate; date.setDate(date.getDate() + 1)) {
      const dateString = date.toISOString().split('T')[0];
      
      if (currentSelectedDateString === dateString) {
        // Selected date styling
        marked[dateString] = {
          customStyles: {
            container: {
              backgroundColor: '#006747',
              borderRadius: 8,
            },
            text: {
              color: '#FFFFFF',
              fontFamily: 'PlusJakartaSans-Bold',
            },
          },
        };
      } else {
        // Available date styling
        marked[dateString] = {
          customStyles: {
            container: {
              backgroundColor: 'transparent',
              borderRadius: 8,
            },
            text: {
              color: '#191C1A',
            },
          },
        };
      }
    }
    
    return marked;
  };

  return (
    <View style={styles.container}>
      
      {/* Status Bar */}
      <StatusBar backgroundColor="#006747" barStyle="light-content" />
      
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollContainer} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#006747', '#006747']}
            tintColor="#006747"
            title=""
            progressBackgroundColor="#F0F8F5"
            size="large"
            style={styles.refreshControl}
          />
        }
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.fullContainer}>
            <View style={styles.contentContainer}>
              
              {/* Train Search Section */}
              <Card style={styles.searchCard} elevation={4}>
                <Card.Content style={styles.searchContent}>
                  <TouchableOpacity 
                    style={[styles.trainSearchHeader, !showTrainSearch && styles.trainSearchHeaderCollapsed]}
                    onPress={toggleTrainSearch}
                  >
                    <View style={styles.trainSearchHeaderContent}>
                      <Text variant="titleMedium" style={styles.trainSearchTitle}>
                        {showTrainSearch ? 'Collapse Train Search' : 'Expand Train Search'}
                      </Text>
                    </View>
                    <Icon 
                      source={showTrainSearch ? "chevron-up" : "chevron-down"} 
                      size={24} 
                      color="#006747" 
                    />
                  </TouchableOpacity>
                  
                  {showTrainSearch && <Divider style={styles.fullWidthDivider} />}
                  
                  {showTrainSearch && (
                    <View style={styles.trainSearchForm}>
                      <View style={styles.stationsRow}>
                        {/* Origin Station */}
                        <View style={styles.stationInputContainer}>
                          <Text variant="titleSmall" style={styles.inputLabel}>
                            Origin Station
                          </Text>
                          <TouchableOpacity onPress={() => {
                            setOriginSearchQuery(originStation);
                            setShowOriginDialog(true);
                          }}>
                            <TextInput
                              mode="outlined"
                              value={originStation}
                              editable={false}
                              left={<TextInput.Icon icon="map-marker" iconColor="#006747" />}
                              style={styles.input}
                              contentStyle={styles.inputContent}
                              placeholder="Select origin station"
                              outlineColor="#006747"
                              activeOutlineColor="#006747"
                              outlineStyle={styles.inputOutline}
                            />
                          </TouchableOpacity>
                        </View>
                        
                        {/* Swap Button */}
                        <View style={styles.swapButtonContainer}>
                          <TouchableOpacity 
                            style={styles.swapButton}
                            onPress={handleSwapStations}
                            activeOpacity={0.7}
                          >
                            <Icon source="swap-horizontal" size={20} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                        
                        {/* Destination Station */}
                        <View style={styles.stationInputContainer}>
                          <Text variant="titleSmall" style={styles.inputLabel}>
                            Destination Station
                          </Text>
                          <TouchableOpacity onPress={() => {
                            setDestinationSearchQuery(destinationStation);
                            setShowDestinationDialog(true);
                          }}>
                            <TextInput
                              mode="outlined"
                              value={destinationStation}
                              editable={false}
                              left={<TextInput.Icon icon="map-marker" iconColor="#006747" />}
                              style={styles.input}
                              contentStyle={styles.inputContent}
                              placeholder="Select destination station"
                              outlineColor="#006747"
                              activeOutlineColor="#006747"
                              outlineStyle={styles.inputOutline}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                      
                      {/* Search Button */}
                      <Button
                        mode="contained"
                        icon={({ size, color }) => (
                          <Icon source="format-list-bulleted" size={20} color={color} />
                        )}
                        onPress={handleSearchTrains}
                        loading={isSearchingTrains}
                        disabled={isSearchingTrains}
                        style={styles.trainSearchButton}
                        contentStyle={styles.trainSearchButtonContent}
                        labelStyle={styles.trainSearchButtonLabel}
                      >
                        {isSearchingTrains ? 'Searching Trains...' : 'View Train List'}
                      </Button>
                      
                      {/* Train Search Results */}
                      {showTrainSearchResults && trainSearchResults.length > 0 && (
                        <View style={styles.trainResultsContainer} ref={trainResultsRef}>
                          <View style={styles.trainResultsHeader}>
                            <Icon source="train" size={20} color="#006747" style={styles.trainResultsIcon} />
                            <Text variant="titleMedium" style={styles.trainResultsTitle}>
                              Available Trains
                            </Text>
                          </View>
                          <Text variant="bodySmall" style={styles.trainResultsSubtext}>
                            Click or tap on a train name to insert it into the train name field
                          </Text>
                          
                          {trainSearchResults.map((train, index) => (
                            <Surface
                              key={index}
                              style={styles.trainResultItem}
                              elevation={1}
                            >
                              <TouchableOpacity
                                style={styles.trainResultTouchable}
                                onPress={() => handleTrainResultSelect(train)}
                                activeOpacity={0.7}
                              >
                                <View style={styles.trainResultHeader}>
                                  <Text style={styles.trainResultName}>
                                    {train.trip_number}
                                  </Text>
                                </View>
                                
                                <Divider style={styles.trainResultDivider} />
                                
                                <View style={styles.trainResultTimeContainer}>
                                  <View style={styles.trainResultTimeColumn}>
                                    <Text style={styles.trainResultTimeLabel}>Departure</Text>
                                    <Text style={styles.trainResultStation}>{originStation}</Text>
                                    <Text style={styles.trainResultTimeValue}>{train.departure_time}</Text>
                                  </View>
                                  <View style={styles.trainResultTimeSeparator}>
                                    <Icon source="arrow-right" size={20} color="#49454F" />
                                  </View>
                                  <View style={styles.trainResultTimeColumn}>
                                    <Text style={styles.trainResultTimeLabel}>Arrival</Text>
                                    <Text style={styles.trainResultStation}>{destinationStation}</Text>
                                    <Text style={styles.trainResultTimeValue}>{train.arrival_time}</Text>
                                  </View>
                                </View>
                              </TouchableOpacity>
                            </Surface>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </Card.Content>
              </Card>
              
              {/* Main Search Form */}
              <Card style={styles.searchCard} elevation={4}>
              <Card.Content style={styles.searchContent}>
                
                {/* Train Name Input */}
                <View style={styles.inputContainer} ref={trainNameContainerRef}>
                  <Text variant="titleSmall" style={styles.inputLabel}>
                    Train Name
                  </Text>
                  <TouchableOpacity onPress={() => {
                    // Pre-fill search with current train name if a train is selected
                    if (selectedTrain) {
                      setTrainSearchQuery(selectedTrain.train_name);
                      setCustomTrainName(selectedTrain.train_name);
                    } else if (trainName) {
                      setTrainSearchQuery(trainName);
                      setCustomTrainName(trainName);
                    } else {
                      setTrainSearchQuery('');
                      setCustomTrainName('');
                    }
                    setShowTrainDropdown(true);
                  }}>
                    <TextInput
                      mode="outlined"
                      value={trainName}
                      editable={false}
                      left={<TextInput.Icon icon="train" iconColor="#006747" />}
                      style={[
                        styles.input,
                        isFlashing && { backgroundColor: '#d4edda' }
                      ]}
                      contentStyle={[styles.inputContent, styles.trainInputContent]}
                      placeholder="Select train"
                      outlineColor="#006747"
                      activeOutlineColor="#006747"
                      outlineStyle={styles.inputOutline}
                    />
                  </TouchableOpacity>
                </View>
                
                {/* Journey Date Input */}
                <View style={styles.inputContainer}>
                  <Text variant="titleSmall" style={styles.inputLabel}>
                    Date of Journey
                  </Text>
                  <TouchableOpacity onPress={() => {
                    // Reset currentMonth to the selected date or today when opening calendar
                    const dateToShow = selectedDateString || getBangladeshToday();
                    setCurrentMonth(dateToShow.slice(0, 7)); // Set to YYYY-MM format
                    setShowDatePicker(true);
                  }}>
                    <TextInput
                      mode="outlined"
                      value={journeyDate}
                      editable={false}
                      left={<TextInput.Icon icon="calendar" iconColor="#006747" />}
                      style={styles.input}
                      contentStyle={[styles.inputContent, styles.dateInputContent]}
                      placeholder="Select journey date"
                      outlineColor="#006747"
                      activeOutlineColor="#006747"
                      outlineStyle={styles.inputOutline}
                    />
                  </TouchableOpacity>
                </View>

                {/* View Seat Matrix Button */}
                <Button 
                  mode="contained"
                  icon={({ size, color }) => (
                    <Icon source="format-list-bulleted-square" size={20} color={color} />
                  )}
                  onPress={handleViewSeatMatrix}
                  style={styles.matrixButton}
                  contentStyle={styles.matrixButtonContent}
                  labelStyle={styles.matrixButtonLabel}
                  disabled={isLoading}
                  loading={isLoading}
                >
                  {isLoading ? 'Generating Matrix...' : 'View Seat Matrix'}
                </Button>
                
              </Card.Content>
            </Card>

            </View>
          </View>
        </TouchableWithoutFeedback>

        {/* Calendar Dialog */}
        <Portal>
          <Dialog 
            visible={showDatePicker} 
            onDismiss={() => setShowDatePicker(false)}
            style={styles.calendarDialog}
          >
            <Dialog.Content style={styles.calendarContent}>
              <Calendar
                current={selectedDateString || getBangladeshToday()}
                onDayPress={onDayPress}
                onMonthChange={onMonthChange}
                minDate={getMinDate()}
                maxDate={getMaxDate()}
                disableArrowLeft={disableArrowLeft()}
                disableArrowRight={disableArrowRight()}
                markingType={'custom'}
                markedDates={getMarkedDates()}
                theme={{
                  backgroundColor: theme.colors.surface,
                  calendarBackground: theme.colors.surface,
                  textSectionTitleColor: '#006747',
                  selectedDayBackgroundColor: '#006747',
                  selectedDayTextColor: '#FFFFFF',
                  todayTextColor: '#006747',
                  dayTextColor: theme.colors.onSurface,
                  textDisabledColor: '#C1C9BF',
                  dotColor: '#006747',
                  selectedDotColor: '#FFFFFF',
                  arrowColor: '#006747',
                  disabledArrowColor: '#C1C9BF',
                  monthTextColor: '#006747',
                  indicatorColor: '#006747',
                  textDayFontFamily: 'PlusJakartaSans-Regular',
                  textMonthFontFamily: 'PlusJakartaSans-Bold',
                  textDayHeaderFontFamily: 'PlusJakartaSans-SemiBold',
                  textDayFontSize: 16,
                  textMonthFontSize: 18,
                  textDayHeaderFontSize: 13,
                  'stylesheet.day.basic': {
                    base: {
                      borderRadius: 8,
                      width: 32,
                      height: 32,
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'PlusJakartaSans-Regular',
                    },
                    selected: {
                      backgroundColor: '#006747',
                      borderRadius: 8,
                      fontFamily: 'PlusJakartaSans-Regular',
                      fontWeight: 'bold',
                    },
                    today: {
                      backgroundColor: 'transparent',
                      borderColor: '#006747',
                      borderWidth: 2,
                      borderRadius: 8,
                      fontFamily: 'PlusJakartaSans-Regular',
                      fontWeight: 'bold',
                    },
                    disabled: {
                      backgroundColor: 'transparent',
                      borderRadius: 8,
                    }
                  }
                }}
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setShowDatePicker(false)} textColor="#006747">Cancel</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {/* Train Dropdown Dialog */}
        <Portal>
          <Dialog 
            visible={showTrainDropdown} 
            onDismiss={() => {
              setShowTrainDropdown(false);
              setTrainSearchQuery('');
              setCustomTrainName('');
              setKeyboardType('default'); // Reset keyboard type
            }}
            style={styles.trainDialog}
          >
            <Dialog.Content style={styles.trainDialogContent}>
              <View style={styles.customSearchContainer}>
                <Icon source="magnify" color="#006747" size={20} style={styles.searchIcon} />
                <RNTextInput
                  ref={searchInputRef}
                  placeholder="Search trains..."
                  value={trainSearchQuery}
                  onChangeText={(text) => {
                    setTrainSearchQuery(text);
                    setCustomTrainName(text);
                  }}
                  style={styles.customSearchInput}
                  placeholderTextColor="#8F9E8D"
                  keyboardType={keyboardType}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {trainSearchQuery ? (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => {
                      // Clear the search query while keeping focus and keyboard type
                      setTrainSearchQuery('');
                      setCustomTrainName('');
                      
                      // Don't blur and refocus - just keep the current focus
                      // This prevents the keyboard from switching modes
                    }}
                  >
                    <Icon source="close-circle" color="#8F9E8D" size={20} />
                  </TouchableOpacity>
                ) : null}
              </View>
              
              <View style={styles.trainListWrapper}>
                <FlatList
                  data={filteredTrains}
                  keyExtractor={(item) => item.train_number.toString()}
                  showsVerticalScrollIndicator={false}
                  style={styles.trainList}
                  contentContainerStyle={styles.trainListContainer}
                  fadingEdgeLength={30}
                  keyboardShouldPersistTaps="always"
                  renderItem={({ item, index }) => (
                    <TrainListItem
                      item={item}
                      index={index}
                      onPress={handleTrainSelect}
                      showDivider={true}
                      totalItems={filteredTrains.length}
                    />
                  )}
                  ListEmptyComponent={() => (
                    <View style={styles.noResultsContainer}>
                      <Text style={styles.noResultsText}>No trains found</Text>
                      {customTrainName.trim() && (
                        <TouchableOpacity 
                          onPress={handleCustomTrainInsert}
                          style={styles.customTrainButtonAlt}
                        >
                          <Text style={styles.customTrainTextAlt}>
                            Use "{customTrainName}" as train name
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                />
                {/* Top gradient overlay */}
                <View style={styles.gradientTop} pointerEvents="none" />
                {/* Bottom gradient overlay */}
                <View style={styles.gradientBottom} pointerEvents="none" />
              </View>
            </Dialog.Content>
            <Dialog.Actions>
              <Button 
                onPress={() => {
                  setShowTrainDropdown(false);
                  setTrainSearchQuery('');
                  setCustomTrainName('');
                  setKeyboardType('default'); // Reset keyboard type
                }} 
                textColor="#006747"
              >
                Cancel
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {/* Error Dialog */}
        <Portal>
          <Dialog
            visible={showErrorDialog}
            onDismiss={() => setShowErrorDialog(false)}
            style={styles.errorDialog}
          >
            <Dialog.Content style={styles.errorDialogContent}>
              <View style={styles.errorDialogHeader}>
                <Icon source="alert-circle" size={24} color="#B3261E" />
                <Dialog.Title style={styles.errorDialogTitle}>Error</Dialog.Title>
              </View>
              <Text style={styles.errorDialogText}>{errorMessage}</Text>
            </Dialog.Content>
            <Dialog.Actions style={styles.errorDialogActions}>
              <Button
                onPress={() => {
                  setShowErrorDialog(false);
                  if (isCredentialError) {
                    // Navigate to Settings screen with highlight parameter
                    navigation.navigate('Settings', { highlightAccount: true });
                  }
                }}
                style={styles.errorDialogButton}
                labelStyle={styles.errorDialogButtonLabel}
              >
                {isCredentialError ? 'Go to Settings' : 'OK'}
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {/* Loading Dialog */}
        <Portal>
          <Dialog visible={isLoading} dismissable={false} style={styles.loadingDialog}>
            <Dialog.Content style={styles.loadingDialogContent}>
              <View style={styles.loadingHeader}>
                <ActivityIndicator size={48} color="#006747" />
                <Text style={styles.loadingTitle}>Processing Your Request</Text>
              </View>
              <Text style={styles.loadingMessage}>{loadingMessage}</Text>
              <ProgressBar 
                progress={loadingProgress} 
                color="#006747"
                style={styles.progressBar}
              />
              <Text style={styles.progressText}>
                {Math.round(loadingProgress * 100)}%
              </Text>
              <Button
                mode="outlined"
                onPress={handleCancelRequest}
                style={styles.cancelButton}
                labelStyle={styles.cancelButtonLabel}
                icon="close"
              >
                Cancel
              </Button>
            </Dialog.Content>
          </Dialog>
        </Portal>

        {/* Train Search Progress Dialog */}
        <Portal>
          <Dialog visible={isSearchingTrains} dismissable={false} style={styles.loadingDialog}>
            <Dialog.Content style={styles.loadingDialogContent}>
              <View style={styles.loadingHeader}>
                <ActivityIndicator size={48} color="#006747" />
                <Text style={styles.loadingTitle}>Searching Trains</Text>
              </View>
              <Text style={styles.loadingMessage}>{trainSearchMessage}</Text>
              <ProgressBar 
                progress={trainSearchProgress} 
                color="#006747"
                style={styles.progressBar}
              />
              <Text style={styles.progressText}>
                {Math.round(trainSearchProgress * 100)}%
              </Text>
              <Button
                mode="outlined"
                onPress={handleCancelTrainSearch}
                style={styles.cancelButton}
                labelStyle={styles.cancelButtonLabel}
                icon="close"
              >
                Cancel
              </Button>
            </Dialog.Content>
          </Dialog>
        </Portal>

        {/* Update Available Dialog */}
        <Portal>
          <Dialog 
            visible={showUpdateDialog} 
            dismissable={false}
            style={styles.updateDialog}
          >
            <Dialog.Content style={styles.updateDialogContent}>
              <View style={styles.updateDialogHeader}>
                <View style={styles.updateIconContainer}>
                  <Icon source="update" size={48} color="#006747" />
                </View>
                <Text style={styles.updateDialogTitle}>
                  {updateInfo?.forceUpdate ? 'Update Required' : 'Update Available'}
                </Text>
              </View>
              <Text style={styles.updateDialogMessage}>
                {updateInfo?.message}
              </Text>
              <View style={styles.updateVersionContainer}>
                <View style={styles.updateVersionRow}>
                  <Text style={styles.updateVersionLabel}>Current Version:</Text>
                  <Text style={styles.updateVersionValue}>{updateInfo?.currentVersion}</Text>
                </View>
                <View style={styles.updateVersionRow}>
                  <Text style={styles.updateVersionLabel}>Latest Version:</Text>
                  <Text style={styles.updateVersionValueLatest}>{updateInfo?.latestVersion}</Text>
                </View>
              </View>
            </Dialog.Content>
            <Dialog.Actions style={styles.updateDialogActions}>
              {!updateInfo?.forceUpdate && (
                <Button
                  onPress={() => setShowUpdateDialog(false)}
                  style={styles.updateLaterButton}
                  labelStyle={styles.updateLaterButtonLabel}
                  textColor="#49454F"
                >
                  Later
                </Button>
              )}
              <Button
                onPress={async () => {
                  if (updateInfo?.updateUrl) {
                    await openUpdateUrl(updateInfo.updateUrl);
                  }
                }}
                mode="contained"
                style={styles.updateNowButton}
                labelStyle={styles.updateNowButtonLabel}
              >
                Update Now
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {/* Notice Dialog */}
        <Portal>
          <Dialog 
            visible={showNoticeDialog} 
            dismissable={false}
            style={styles.noticeDialog}
          >
            <Dialog.Content style={styles.noticeDialogContent}>
              <View style={styles.noticeDialogHeader}>
                <Text style={styles.noticeDialogTitle}>
                  {noticeInfo?.title}
                </Text>
              </View>
              <Text style={styles.noticeDialogMessage}>
                {noticeInfo?.message}
              </Text>
            </Dialog.Content>
            {noticeInfo?.dismissible && (
              <Dialog.Actions style={styles.noticeDialogActions}>
                <Button
                  onPress={async () => {
                    if (noticeInfo?.version) {
                      await dismissNotice(noticeInfo.version);
                    }
                    setShowNoticeDialog(false);
                  }}
                  mode="contained"
                  style={styles.noticeOkButton}
                  labelStyle={styles.noticeOkButtonLabel}
                >
                  {noticeInfo?.buttonText || 'OK'}
                </Button>
              </Dialog.Actions>
            )}
          </Dialog>
        </Portal>

        {/* Origin Station Dialog */}
        <Portal>
          <Dialog 
            visible={showOriginDialog} 
            onDismiss={() => {
              setShowOriginDialog(false);
              setOriginSearchQuery('');
            }}
            style={styles.trainDialog}
          >
            <Dialog.Content style={styles.trainDialogContent}>
              <View style={styles.customSearchContainer}>
                <Icon source="magnify" color="#006747" size={20} style={styles.searchIcon} />
                <RNTextInput
                  ref={originSearchInputRef}
                  placeholder="Search origin stations..."
                  value={originSearchQuery}
                  onChangeText={setOriginSearchQuery}
                  style={styles.customSearchInput}
                  placeholderTextColor="#8F9E8D"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {originSearchQuery ? (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => {
                      setOriginSearchQuery('');
                    }}
                  >
                    <Icon source="close-circle" color="#8F9E8D" size={20} />
                  </TouchableOpacity>
                ) : null}
              </View>
              
              <View style={styles.trainListWrapper}>
                <FlatList
                  data={filteredOriginStations}
                  keyExtractor={(item, index) => index.toString()}
                  showsVerticalScrollIndicator={false}
                  style={styles.trainList}
                  contentContainerStyle={styles.trainListContainer}
                  fadingEdgeLength={30}
                  keyboardShouldPersistTaps="always"
                  renderItem={({ item, index }) => (
                    <StationListItem
                      item={item}
                      index={index}
                      onPress={handleOriginStationSelect}
                      showDivider={true}
                      totalItems={filteredOriginStations.length}
                    />
                  )}
                  ListEmptyComponent={() => (
                    <View style={styles.noResultsContainer}>
                      <Text style={styles.noResultsText}>No stations found</Text>
                      {originSearchQuery.trim() && (
                        <TouchableOpacity 
                          onPress={() => {
                            setOriginStation(originSearchQuery.trim());
                            setShowOriginDialog(false);
                            setOriginSearchQuery('');
                          }}
                          style={styles.customTrainButtonAlt}
                        >
                          <Text style={styles.customTrainTextAlt}>
                            Use "{originSearchQuery.trim()}" as station name
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                />
                {/* Top gradient overlay */}
                <View style={styles.gradientTop} pointerEvents="none" />
                {/* Bottom gradient overlay */}
                <View style={styles.gradientBottom} pointerEvents="none" />
              </View>
            </Dialog.Content>
            <Dialog.Actions>
              <Button 
                onPress={() => {
                  setShowOriginDialog(false);
                  setOriginSearchQuery('');
                }}
                textColor="#006747"
              >
                Cancel
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {/* Destination Station Dialog */}
        <Portal>
          <Dialog 
            visible={showDestinationDialog} 
            onDismiss={() => {
              setShowDestinationDialog(false);
              setDestinationSearchQuery('');
            }}
            style={styles.trainDialog}
          >
            <Dialog.Content style={styles.trainDialogContent}>
              <View style={styles.customSearchContainer}>
                <Icon source="magnify" color="#006747" size={20} style={styles.searchIcon} />
                <RNTextInput
                  ref={destinationSearchInputRef}
                  placeholder="Search destination stations..."
                  value={destinationSearchQuery}
                  onChangeText={setDestinationSearchQuery}
                  style={styles.customSearchInput}
                  placeholderTextColor="#8F9E8D"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {destinationSearchQuery ? (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => {
                      setDestinationSearchQuery('');
                    }}
                  >
                    <Icon source="close-circle" color="#8F9E8D" size={20} />
                  </TouchableOpacity>
                ) : null}
              </View>
              
              <View style={styles.trainListWrapper}>
                <FlatList
                  data={filteredDestinationStations}
                  keyExtractor={(item, index) => index.toString()}
                  showsVerticalScrollIndicator={false}
                  style={styles.trainList}
                  contentContainerStyle={styles.trainListContainer}
                  fadingEdgeLength={30}
                  keyboardShouldPersistTaps="always"
                  renderItem={({ item, index }) => (
                    <StationListItem
                      item={item}
                      index={index}
                      onPress={handleDestinationStationSelect}
                      showDivider={true}
                      totalItems={filteredDestinationStations.length}
                    />
                  )}
                  ListEmptyComponent={() => (
                    <View style={styles.noResultsContainer}>
                      <Text style={styles.noResultsText}>No stations found</Text>
                      {destinationSearchQuery.trim() && (
                        <TouchableOpacity 
                          onPress={() => {
                            setDestinationStation(destinationSearchQuery.trim());
                            setShowDestinationDialog(false);
                            setDestinationSearchQuery('');
                          }}
                          style={styles.customTrainButtonAlt}
                        >
                          <Text style={styles.customTrainTextAlt}>
                            Use "{destinationSearchQuery.trim()}" as station name
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                />
                {/* Top gradient overlay */}
                <View style={styles.gradientTop} pointerEvents="none" />
                {/* Bottom gradient overlay */}
                <View style={styles.gradientBottom} pointerEvents="none" />
              </View>
            </Dialog.Content>
            <Dialog.Actions>
              <Button 
                onPress={() => {
                  setShowDestinationDialog(false);
                  setDestinationSearchQuery('');
                }}
                textColor="#006747"
              >
                Cancel
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    flex: 1,
  },
  fullContainer: {
    flex: 1,
    minHeight: '100%',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 30,
  },
  refreshControl: {
    backgroundColor: '#F0F8F5',
  },
  
  // Search Card
  searchCard: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    marginBottom: 20,
  },
  searchContent: {
    padding: 24,
  },
  
  // Input Styles
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    marginBottom: 8,
    color: '#006747',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  input: {
    backgroundColor: '#FFFFFF',
    fontSize: 16,
  },
  inputContent: {
    fontSize: 16,
    paddingLeft: 8,
    paddingRight: 8,
  },
  trainInputContent: {
    textAlign: 'left',
    paddingRight: 16,
  },
  dateInputContent: {
    paddingRight: 8,
  },
  inputOutline: {
    borderRadius: 12,
  },
  
  // Button Styles
  matrixButton: {
    borderRadius: 16,
    marginTop: 10,
    elevation: 2,
    shadowColor: '#006747',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  matrixButtonContent: {
    paddingVertical: 8,
  },
  matrixButtonLabel: {
    fontSize: 16,
    letterSpacing: 0.5,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#FFFFFF',
    marginLeft: 8,
  },

  // Calendar Dialog Styles
  calendarDialog: {
    margin: 20,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  calendarTitle: {
    color: '#006747',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  calendarContent: {
    borderRadius: 16,
    overflow: 'hidden',
  },

  // Train Dialog Styles
  trainDialog: {
    margin: 20,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    maxHeight: '80%',
  },
  trainDialogTitle: {
    color: '#006747',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  trainDialogContent: {
    paddingHorizontal: 0,
    maxHeight: 500,
  },
  trainSearchbar: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    elevation: 0,
  },
  customSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  customSearchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#000000',
    height: '100%',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  trainSearchInput: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Regular',
  },
  trainList: {
    maxHeight: 400,
    paddingVertical: 8,
  },
  trainListContainer: {
    paddingBottom: 16,
  },
  trainListWrapper: {
    position: 'relative',
    maxHeight: 400,
  },
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 30,
    zIndex: 1,
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
    zIndex: 1,
  },
  trainListItem: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 70,
  },
  trainTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#006747',
    marginBottom: 4,
    fontFamily: 'PlusJakartaSans-SemiBold',
    lineHeight: 20,
    flexWrap: 'wrap',
  },
  trainRouteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  trainRoute: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'PlusJakartaSans-Regular',
    flex: 1,
  },
  trainZoneBadge: {
    backgroundColor: '#f1f8f3',
    borderColor: '#006747',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  trainZoneText: {
    fontSize: 10,
    color: '#006747',
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  trainDivider: {
    marginHorizontal: 20,
    backgroundColor: '#D1D5DB',
    height: 1,
  },
  noResultsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans-Regular',
    marginBottom: 16,
  },
  customTrainButtonAlt: {
    backgroundColor: 'transparent',
    borderColor: '#006747',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  customTrainTextAlt: {
    color: '#006747',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans-SemiBold',
  },

  // Error Dialog Styles
  errorDialog: {
    margin: 24,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    elevation: 6,
  },
  errorDialogContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  errorDialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorDialogTitle: {
    color: '#B3261E',
    fontSize: 24,
    fontWeight: '500',
    fontFamily: 'PlusJakartaSans-SemiBold',
    marginLeft: 12,
    marginTop: 0,
    marginBottom: 0,
  },
  errorDialogText: {
    fontSize: 14,
    color: '#49454F',
    fontFamily: 'PlusJakartaSans-Regular',
    lineHeight: 20,
    textAlign: 'left',
  },
  errorDialogActions: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  errorDialogButton: {
    borderRadius: 100,
    marginLeft: 8,
  },
  errorDialogButtonLabel: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'PlusJakartaSans-SemiBold',
    textTransform: 'none',
  },
  
  // Loading dialog styles (Material Design 3)
  loadingDialog: {
    margin: 24,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    elevation: 6,
  },
  loadingDialogContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },
  loadingHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#1C1B1F',
    marginTop: 12,
  },
  loadingMessage: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#49454F',
    textAlign: 'center',
    marginBottom: 16,
    minHeight: 20,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  progressText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#006747',
    textAlign: 'center',
    marginBottom: 20,
  },
  cancelButton: {
    borderRadius: 20,
    borderColor: '#79747E',
  },
  cancelButtonLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#49454F',
  },
  
  // Train Search styles
  trainSearchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 16,
  },
  trainSearchHeaderCollapsed: {
    marginBottom: 0,
  },
  trainSearchHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trainSearchTitle: {
    color: '#006747',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  trainSearchForm: {
    marginTop: 8,
    gap: 20,
  },
  stationsRow: {
    flexDirection: 'column',
    marginBottom: 20,
  },
  stationInputContainer: {
    flex: 1,
    position: 'relative',
    marginBottom: 8,
  },
  swapButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  swapButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#006747',
    elevation: 3,
    shadowColor: '#006747',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    transform: [{ rotate: '90deg' }],
  },
  trainSearchButton: {
    borderRadius: 16,
    marginTop: 0,
    elevation: 2,
    shadowColor: '#006747',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  trainSearchButtonContent: {
    paddingVertical: 8,
  },
  trainSearchButtonLabel: {
    fontSize: 16,
    letterSpacing: 0.5,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  trainResultsContainer: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E7E0EC',
    paddingTop: 20,
  },
  trainResultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  trainResultsTitle: {
    color: '#006747',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Bold',
    marginLeft: 8,
  },
  trainResultsIcon: {
    marginTop: 3,
  },
  trainResultsSubtext: {
    color: '#6B7280',
    fontFamily: 'PlusJakartaSans-Regular',
    marginBottom: 16,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  // Material Design 3 Train Card
  trainResultItem: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
    overflow: 'hidden',
  },
  trainResultTouchable: {
    padding: 16,
  },
  trainResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  trainIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#006747',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  trainResultHeaderText: {
    flex: 1,
  },
  trainResultName: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
    lineHeight: 20,
  },
  trainResultRoute: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#49454F',
    lineHeight: 18,
    marginBottom: 4,
  },
  trainResultDivider: {
    backgroundColor: '#E7E0EC',
    marginVertical: 12,
  },
  trainResultTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  trainResultTimeColumn: {
    flex: 1,
    alignItems: 'center',
  },
  trainResultTimeSeparator: {
    marginHorizontal: 12,
  },
  trainResultTimeLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#49454F',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trainResultStation: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#1C1B1F',
    marginBottom: 4,
    textAlign: 'center',
  },
  trainResultTimeValue: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#6B7280',
    lineHeight: 14,
  },
  trainResultContent: {
    alignItems: 'center',
    width: '100%',
  },
  trainResultTimeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Station Dialog Styles
  stationListItem: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 56,
  },
  stationTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1B1F',
    fontFamily: 'PlusJakartaSans-Medium',
    lineHeight: 20,
  },
  stationDivider: {
    backgroundColor: '#E8E8E8',
    height: 1,
    marginHorizontal: 20,
  },
  stationOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  stationOptionText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#1C1B1F',
  },
  fullWidthDivider: {
    marginBottom: 16,
    marginHorizontal: 0,
    backgroundColor: '#DDE5DB',
    height: 1,
  },

  // Update Dialog Styles
  updateDialog: {
    margin: 24,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    elevation: 3,
  },
  updateDialogContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  updateDialogHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  updateIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  updateDialogTitle: {
    color: '#1C1B1F',
    fontSize: 24,
    fontFamily: 'PlusJakartaSans-Bold',
    textAlign: 'center',
    lineHeight: 32,
  },
  updateDialogMessage: {
    fontSize: 14,
    color: '#49454F',
    fontFamily: 'PlusJakartaSans-Regular',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  updateVersionContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  updateVersionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  updateVersionLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#49454F',
  },
  updateVersionValue: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#1C1B1F',
  },
  updateVersionValueLatest: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
  },
  updateDialogActions: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  updateLaterButton: {
    borderRadius: 20,
    minWidth: 80,
  },
  updateLaterButtonLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-SemiBold',
    marginHorizontal: 8,
  },
  updateNowButton: {
    borderRadius: 20,
    backgroundColor: '#006747',
    minWidth: 100,
  },
  updateNowButtonLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-SemiBold',
    marginHorizontal: 8,
  },

  // Notice Dialog Styles
  noticeDialog: {
    margin: 24,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    elevation: 3,
  },
  noticeDialogContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  noticeDialogHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  noticeDialogTitle: {
    color: '#1C1B1F',
    fontSize: 24,
    fontFamily: 'PlusJakartaSans-Bold',
    textAlign: 'center',
    lineHeight: 32,
  },
  noticeDialogMessage: {
    fontSize: 14,
    color: '#49454F',
    fontFamily: 'PlusJakartaSans-Regular',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 8,
  },
  noticeDialogActions: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  noticeOkButton: {
    borderRadius: 20,
    backgroundColor: '#006747',
    minWidth: 120,
  },
  noticeOkButtonLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-SemiBold',
    marginHorizontal: 16,
  },
});