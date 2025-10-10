import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Modal,
  Linking,
  Pressable,
  Animated,
  RefreshControl,
} from 'react-native';
import {
  Card,
  Text,
  Button,
  useTheme,
  Surface,
  Chip,
  Badge,
  IconButton,
  Divider,
  Portal,
  Dialog,
  TouchableRipple,
  TextInput,
  Menu,
  Icon,
  ActivityIndicator,
  ProgressBar,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { SEAT_TYPES } from '../utils/railwayAPI';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

// Seat type labels for display
const SEAT_TYPE_LABELS = {
  'S_CHAIR': 'S_CHAIR',
  'SHOVAN': 'SHOVAN',
  'SNIGDHA': 'SNIGDHA',
  'F_SEAT': 'F_SEAT',
  'F_CHAIR': 'F_CHAIR',
  'AC_S': 'AC_S',
  'F_BERTH': 'F_BERTH',
  'AC_B': 'AC_B',
  'SHULOV': 'SHULOV',
  'AC_CHAIR': 'AC_CHAIR'
};

const MatrixResultsScreen = ({ route, navigation }) => {
  const theme = useTheme();
  const { matrixData } = route.params;
  
  const [selectedSeatType, setSelectedSeatType] = useState(null);
  const [cellDetailModal, setCellDetailModal] = useState(null);
  const [matrixKey, setMatrixKey] = useState(0); // Force re-render key
  
  // Error dialog states
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isRefreshError, setIsRefreshError] = useState(false); // Track if error is from refresh
  
  // Route checking states
  const [fromStation, setFromStation] = useState('');
  const [toStation, setToStation] = useState('');
  const [fromDropdownVisible, setFromDropdownVisible] = useState(false);
  const [toDropdownVisible, setToDropdownVisible] = useState(false);
  const [routeResults, setRouteResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  
  // Train route collapse state
  const [showTrainRoute, setShowTrainRoute] = useState(false);
  
  // Pull to refresh states
  const [refreshing, setRefreshing] = useState(false);
  const [showRefreshDialog, setShowRefreshDialog] = useState(false);
  const [isRefreshLoading, setIsRefreshLoading] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [refreshMessage, setRefreshMessage] = useState('');
  const [refreshAbortController, setRefreshAbortController] = useState(null);
  
  // Scroll-aware shadow states
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(true); // Start with right shadow if there are multiple items
  
  // Animated values for smooth shadow transitions
  const leftShadowOpacity = useRef(new Animated.Value(0)).current;
  const rightShadowOpacity = useRef(new Animated.Value(1)).current;
  
  // Refs for synchronized scrolling
  const headerScrollRef = useRef(null);
  const bodyScrollRef = useRef(null);
  const leftScrollRef = useRef(null);
  
  // Refs for route results section smooth scrolling
  const mainScrollViewRef = useRef(null);
  const routeResultsRef = useRef(null);

  // Find the first available seat type
  useEffect(() => {
    if (matrixData && !selectedSeatType) {
      const availableSeatType = SEAT_TYPES.find(seatType => 
        matrixData.hasDataMap[seatType]
      );
      setSelectedSeatType(availableSeatType);
    }
  }, [matrixData, selectedSeatType]);

  // Force scroll position reset when seat type changes
  useEffect(() => {
    if (selectedSeatType) {
      // Optimize matrix re-render - only force key change if absolutely necessary
      // This reduces the delay when switching seat types
      setMatrixKey(prev => prev + 1);
      
      // Reset scroll positions immediately for better responsiveness
      // Use requestAnimationFrame for smoother performance
      requestAnimationFrame(() => {
        if (headerScrollRef.current && bodyScrollRef.current && leftScrollRef.current) {
          headerScrollRef.current?.scrollTo({ x: 0, animated: false });
          bodyScrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
          leftScrollRef.current?.scrollTo({ y: 0, animated: false });
        }
      });
    }
  }, [selectedSeatType]);

  // Set navigation options
  useEffect(() => {
    navigation.setOptions({
      headerStyle: {
        backgroundColor: '#006747',
      },
      headerTintColor: '#ffffff',
      headerTitleStyle: {
        fontFamily: 'PlusJakartaSans-SemiBold',
        fontSize: 18,
        color: '#FFFFFF',
        fontWeight: '600',
      },
      title: 'Matrix Results',
    });
  }, [navigation]);

  const availableSeatTypes = useMemo(() => {
    if (!matrixData) return [];
    return SEAT_TYPES.filter(seatType => matrixData.hasDataMap[seatType]);
  }, [matrixData]);

  const filteredStations = useMemo(() => {
    // Always show ALL stations like the web version, don't filter by seat availability
    return matrixData?.stations || [];
  }, [matrixData]);

  // Filtered station lists for dropdowns - exclude selected station from the other dropdown
  const availableFromStations = useMemo(() => {
    if (!matrixData?.stations) return [];
    return matrixData.stations.filter(station => station !== toStation);
  }, [matrixData?.stations, toStation]);

  const availableToStations = useMemo(() => {
    if (!matrixData?.stations) return [];
    return matrixData.stations.filter(station => station !== fromStation);
  }, [matrixData?.stations, fromStation]);

  // Calculate dynamic dimensions
  const dynamicDimensions = useMemo(() => {
    const stationCount = filteredStations.length;
    const leftColumnWidth = 80;
    const containerPadding = 40; // 40 for margins and paddings
    const availableWidth = width - leftColumnWidth - containerPadding;
    const minCellWidth = 70;
    
    // For very few columns (1-3), limit the max width per cell to keep table within container
    const maxCellWidth = stationCount <= 3 ? availableWidth / stationCount : 120;
    
    // Calculate cell width to fill the container (accounting for margins between columns)
    const columnMargins = stationCount > 1 ? stationCount - 1 : 0; // margins between columns
    const availableWidthForCells = availableWidth - columnMargins;
    let cellWidth = stationCount > 0 ? Math.min(maxCellWidth, availableWidthForCells / stationCount) : minCellWidth;
    
    // Ensure minimum width but allow expansion to fill container (within limits)
    if (cellWidth < minCellWidth) {
      cellWidth = minCellWidth;
    }
    
    const cellHeight = 70;
    const headerHeight = 50;
    
    // Ensure we have enough height for the table
    const minRowCount = Math.max(stationCount, 3); // At least 3 rows
    const minTableHeight = headerHeight + (cellHeight * minRowCount) + (minRowCount - 1) + 20; // Add space for margins between rows
    const maxTableHeight = height * 0.65;
    
    // Always use at least 40% of screen height for the table, or natural height if larger
    const containerHeight = Math.max(
      height * 0.4, 
      Math.min(maxTableHeight, minTableHeight)
    );
    
    // Calculate the content height (used for row distribution)
    const contentHeight = containerHeight - headerHeight;
    const rowHeight = stationCount > 0 ? contentHeight / stationCount : cellHeight;
    
    return {
      cellWidth: Math.floor(cellWidth),
      cellHeight: stationCount <= 3 ? Math.max(rowHeight, cellHeight) : cellHeight, // Taller cells for few rows
      leftColumnWidth,
      headerHeight,
      containerHeight,
      stationCount,
      totalTableWidth: Math.min(availableWidth, Math.floor(cellWidth * stationCount) + columnMargins), // Include column margins in total width
      availableWidth,
      shouldFillWidth: stationCount <= 3, // Flag to indicate if we should fill container width
      shouldFillHeight: stationCount <= 3, // Flag to indicate if we should fill container height
      contentHeight
    };
  }, [filteredStations, width, height]);

  // Route finding algorithms
  const findDirectRoute = (origin, destination, seatType) => {
    if (!matrixData?.fareMatrices?.[seatType]?.[origin]?.[destination]) {
      return null;
    }
    
    const route = matrixData.fareMatrices[seatType][origin][destination];
    if (route.online > 0) {
      const base = parseFloat(route.fare);
      const vat = parseFloat(route.vat_amount || 0);
      const charge = 20;
      const total = base + vat + charge;
      
      return {
        type: 'DIRECT',
        seatType,
        segments: [{
          from: origin,
          to: destination,
          seatType,
          base,
          vat,
          charge,
          total,
          seats: route.online + route.offline,
          date: matrixData.stationDatesFormatted?.[origin] || matrixData.date // Use formatted date
        }],
        totalFare: total
      };
    }
    return null;
  };

  const findSegmentedRoutes = (origin, destination, seatType, stations, fareMatrices) => {
    const queue = [[origin, [], 0]];
    const visited = new Set();

    while (queue.length) {
      const [currentStation, path, totalFare] = queue.shift();

      if (visited.has(currentStation)) continue;
      visited.add(currentStation);

      if (currentStation === destination) {
        return {
          type: 'SEGMENTED',
          seatType,
          segments: path,
          totalFare
        };
      }

      const currentIndex = stations.indexOf(currentStation);
      for (let i = currentIndex + 1; i < stations.length; i++) {
        const nextStation = stations[i];
        const seatInfo = fareMatrices[seatType]?.[currentStation]?.[nextStation];
        if (seatInfo && seatInfo.online > 0) {
          const base = parseFloat(seatInfo.fare);
          const vat = parseFloat(seatInfo.vat_amount || 0);
          const charge = 20;
          const total = base + vat + charge;
          const newPath = [...path, {
            from: currentStation,
            to: nextStation,
            seatType,
            base,
            vat,
            charge,
            total,
            seats: seatInfo.online + seatInfo.offline,
            date: matrixData.stationDatesFormatted?.[currentStation] || matrixData.date // Use formatted date
          }];
          queue.push([nextStation, newPath, totalFare + total]);
        }
      }
    }
    return null;
  };

  const findMixedSegmentedRoutes = (origin, destination, stations, fareMatrices, seatTypes) => {
    const queue = [[origin, [], 0]];
    const visited = new Set();

    while (queue.length) {
      const [currentStation, path, totalFare] = queue.shift();

      if (visited.has(currentStation)) continue;
      visited.add(currentStation);

      if (currentStation === destination) {
        return {
          type: 'MIXED_SEGMENTED',
          segments: path,
          totalFare
        };
      }

      const currentIndex = stations.indexOf(currentStation);
      for (let i = currentIndex + 1; i < stations.length; i++) {
        const nextStation = stations[i];
        let bestSegment = null;
        for (const seatType of seatTypes) {
          const seatInfo = fareMatrices[seatType]?.[currentStation]?.[nextStation];
          if (seatInfo && seatInfo.online > 0) {
            bestSegment = { seatType, seatInfo };
            break;
          }
        }

        if (bestSegment) {
          const { seatType, seatInfo } = bestSegment;
          const base = parseFloat(seatInfo.fare);
          const vat = parseFloat(seatInfo.vat_amount || 0);
          const charge = 20;
          const total = base + vat + charge;
          const seg = {
            from: currentStation,
            to: nextStation,
            seatType,
            base,
            vat,
            charge,
            total,
            seats: seatInfo.online + seatInfo.offline,
            date: matrixData.stationDatesFormatted?.[currentStation] || matrixData.date // Use formatted date
          };
          queue.push([nextStation, [...path, seg], totalFare + total]);
        }
      }
    }
    return null;
  };

  const checkRouteAvailability = () => {
    if (!fromStation || !toStation) {
      setErrorMessage('Please select both origin and destination stations');
      setShowErrorDialog(true);
      return;
    }

    if (fromStation === toStation) {
      setErrorMessage('Origin and destination cannot be the same');
      setShowErrorDialog(true);
      return;
    }

    const fromIndex = matrixData.stations.indexOf(fromStation);
    const toIndex = matrixData.stations.indexOf(toStation);
    
    if (fromIndex >= toIndex) {
      setErrorMessage('Origin station must come before destination station in the train route');
      setShowErrorDialog(true);
      return;
    }

    setIsSearching(true);
    
    // Simulate search delay for better UX
    setTimeout(() => {
      const results = [];
      
      // Check for direct routes first
      for (const seatType of availableSeatTypes) {
        const directRoute = findDirectRoute(fromStation, toStation, seatType);
        if (directRoute) {
          results.push(directRoute);
        }
      }

      // If no direct routes, check for segmented routes
      if (results.length === 0) {
        for (const seatType of availableSeatTypes) {
          const segmentedRoute = findSegmentedRoutes(
            fromStation, 
            toStation, 
            seatType, 
            matrixData.stations, 
            matrixData.fareMatrices
          );
          if (segmentedRoute) {
            results.push(segmentedRoute);
          }
        }
      }

      // If still no routes, try mixed segmented
      if (results.length === 0) {
        const mixedRoute = findMixedSegmentedRoutes(
          fromStation,
          toStation,
          matrixData.stations,
          matrixData.fareMatrices,
          availableSeatTypes
        );
        if (mixedRoute) {
          results.push(mixedRoute);
        }
      }

      setRouteResults(results);
      setIsSearching(false);
      
      // Smooth scroll to results after a short delay to ensure render is complete
      setTimeout(() => {
        if (routeResultsRef.current && mainScrollViewRef.current) {
          routeResultsRef.current.measureLayout(
            mainScrollViewRef.current,
            (x, y, width, height) => {
              // Scroll to the route results with some offset for better visibility
              mainScrollViewRef.current.scrollTo({
                x: 0,
                y: y - 50, // 50px offset from top for better UX
                animated: true,
              });
            },
            (error) => {
              console.log('Error measuring layout:', error);
            }
          );
        }
      }, 100);
    }, 1000);
  };

  const swapStations = () => {
    const temp = fromStation;
    setFromStation(toStation);
    setToStation(temp);
  };

  // Handle pull to refresh - show confirmation dialog
  const onRefresh = () => {
    setRefreshing(true);
    // Show dialog to confirm refresh
    setShowRefreshDialog(true);
  };

  // Handle refresh confirmation - recompute matrix
  const handleRefreshConfirm = async () => {
    setShowRefreshDialog(false);
    setIsRefreshLoading(true);
    setRefreshProgress(0);
    setRefreshMessage('Starting...');

    // Create abort controller for cancellation
    const controller = new AbortController();
    setRefreshAbortController(controller);

    try {
      console.log('Refreshing matrix with same parameters:', { 
        trainModel: matrixData.trainModel, 
        trainName: matrixData.trainName,
        date: matrixData.date 
      });

      // Progress callback
      const onProgress = (message, progress) => {
        console.log('Refresh Progress:', message, progress + '%');
        setRefreshMessage(message);
        setRefreshProgress(progress / 100);
      };

      // Import computeMatrix
      const { computeMatrix } = require('../utils/matrixCalculator');
      const { parseDateString } = require('../utils/railwayAPI');

      // Parse the date for API
      const apiDateFormat = parseDateString(matrixData.date);
      console.log('Parsed date for refresh:', { original: matrixData.date, parsed: apiDateFormat });

      // Recompute the matrix with same parameters
      const newMatrixData = await computeMatrix(
        matrixData.trainModel, 
        matrixData.date, 
        apiDateFormat, 
        onProgress, 
        controller.signal
      );

      setIsRefreshLoading(false);
      setRefreshAbortController(null);
      setRefreshing(false);

      console.log('Matrix refreshed successfully');

      // Update the route params with new data and force re-render
      navigation.setParams({ matrixData: newMatrixData });

      // Reset UI states
      setSelectedSeatType(null); // This will trigger useEffect to select first available
      setFromStation('');
      setToStation('');
      setRouteResults(null);
      setCellDetailModal(null);

    } catch (error) {
      setIsRefreshLoading(false);
      setRefreshAbortController(null);
      setRefreshing(false);
      console.error('Matrix refresh error:', error);

      // Handle cancellation
      if (error.name === 'AbortError' || error.message.includes('canceled') || error.message.includes('aborted')) {
        console.log('Refresh was cancelled by user');
        return;
      }

      // Show error dialog
      let errorMsg = error.message || 'Failed to refresh matrix. Please try again.';
      let shouldGoBack = false;
      
      // Check if this is an error that requires going back to search
      if (errorMsg.includes('No seats available for the selected train and date') ||
          errorMsg.includes('Authentication failed') || 
          errorMsg.includes('Mobile Number or Password is incorrect') ||
          errorMsg.includes('AUTH_CREDENTIALS_REQUIRED') ||
          errorMsg.includes('Railway account credentials not found')) {
        shouldGoBack = true;
      }
      
      // Handle specific errors
      if (errorMsg.includes('Authentication failed') || errorMsg.includes('Mobile Number or Password is incorrect')) {
        errorMsg = 'Authentication failed. Please check your auth token and device key in Settings.';
      } else if (errorMsg.includes('AUTH_CREDENTIALS_REQUIRED') || errorMsg.includes('Railway account credentials not found')) {
        errorMsg = 'Railway credentials not found. Please add your credentials in Settings.';
      }

      setErrorMessage(errorMsg);
      setIsRefreshError(shouldGoBack); // Mark as refresh error that needs navigation back
      setShowErrorDialog(true);
    }
  };

  // Handle refresh cancellation
  const handleRefreshCancel = () => {
    setShowRefreshDialog(false);
    setRefreshing(false);
  };

  // Handle error dialog dismissal
  const handleErrorDialogDismiss = () => {
    setShowErrorDialog(false);
    
    // Navigate back to home if it's a refresh error that requires going back
    // (no seats available, authentication failed, or credentials not found)
    if (isRefreshError) {
      setIsRefreshError(false); // Reset refresh error flag
      navigation.goBack();
    }
  };

  // Cancel loading operation
  const cancelRefreshLoading = () => {
    if (refreshAbortController) {
      refreshAbortController.abort();
      setRefreshAbortController(null);
    }
    setIsRefreshLoading(false);
    setRefreshing(false);
    setRefreshProgress(0);
    setRefreshMessage('');
  };

  const handleSeatTypePress = useCallback((seatType) => {
    // Only update if it's actually different to avoid unnecessary re-renders
    if (seatType !== selectedSeatType) {
      setSelectedSeatType(seatType);
    }
  }, [selectedSeatType]);

  // Handle scroll events for seat types to show/hide shadows appropriately
  const handleSeatTypesScroll = useCallback((event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollX = contentOffset.x;
    const contentWidth = contentSize.width;
    const containerWidth = layoutMeasurement.width;
    
    // Show left shadow if scrolled away from the start
    const shouldShowLeftShadow = scrollX > 5; // 5px threshold to avoid flickering
    
    // Show right shadow if there's more content to scroll to
    const shouldShowRightShadow = scrollX < (contentWidth - containerWidth - 5); // 5px threshold
    
    // Animate shadow transitions smoothly
    if (shouldShowLeftShadow !== showLeftShadow) {
      Animated.timing(leftShadowOpacity, {
        toValue: shouldShowLeftShadow ? 1 : 0,
        duration: 200, // Smooth 200ms transition
        useNativeDriver: true,
      }).start();
      setShowLeftShadow(shouldShowLeftShadow);
    }
    
    if (shouldShowRightShadow !== showRightShadow) {
      Animated.timing(rightShadowOpacity, {
        toValue: shouldShowRightShadow ? 1 : 0,
        duration: 200, // Smooth 200ms transition
        useNativeDriver: true,
      }).start();
      setShowRightShadow(shouldShowRightShadow);
    }
  }, [showLeftShadow, showRightShadow, leftShadowOpacity, rightShadowOpacity]);

  // Initialize shadow visibility when seat types change
  useEffect(() => {
    // Reset shadows when seat types change - initially hide left, show right if needed
    const hasMultipleItems = availableSeatTypes.length > 3;
    
    // Animate initial state
    Animated.timing(leftShadowOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    
    Animated.timing(rightShadowOpacity, {
      toValue: hasMultipleItems ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    
    setShowLeftShadow(false);
    setShowRightShadow(hasMultipleItems);
  }, [availableSeatTypes, leftShadowOpacity, rightShadowOpacity]);

  const renderSeatTypeChip = ({ item: seatType }) => {
    const isSelected = seatType === selectedSeatType;
    const hasData = matrixData?.hasDataMap[seatType];
    
    return (
      <Chip
        key={seatType}
        selected={isSelected}
        onPress={() => handleSeatTypePress(seatType)}
        mode={isSelected ? "flat" : "outlined"}
        style={[
          styles.seatTypeChip,
          isSelected && { 
            backgroundColor: theme.colors.secondaryContainer,
            borderColor: theme.colors.primary 
          }
        ]}
        textStyle={[
          styles.seatTypeText,
          isSelected && { color: theme.colors.onSecondaryContainer, fontFamily: 'PlusJakartaSans-SemiBold' }
        ]}
        disabled={!hasData}
        icon={hasData ? (isSelected ? "check-circle" : undefined) : "close-circle"}
        showSelectedOverlay={isSelected}
      >
        {SEAT_TYPE_LABELS[seatType]}
      </Chip>
    );
  };

  const renderMatrixCell = useCallback((fromStation, toStation) => {
    const fromIndex = filteredStations.indexOf(fromStation);
    const toIndex = filteredStations.indexOf(toStation);
    
    // Disable diagonal and upper-right triangle (like web version)
    if (fromIndex >= toIndex) {
      return (
        <View style={styles.emptyCell}>
          <Text style={styles.emptyText}>—</Text>
        </View>
      );
    }

    const seatData = matrixData?.fareMatrices[selectedSeatType]?.[fromStation]?.[toStation];
    
    if (!seatData) {
      return (
        <View style={styles.emptyCell}>
          <Text style={styles.emptyText}>—</Text>
        </View>
      );
    }

    const totalSeats = seatData.online + seatData.offline;
    const hasSeats = totalSeats > 0;
    const fare = seatData.fare + seatData.vat_amount;

    if (!hasSeats) {
      return (
        <View style={styles.emptyCell}>
          <Text style={styles.emptyText}>—</Text>
        </View>
      );
    }

    return (
      <TouchableRipple
        style={styles.availableCell}
        onPress={() => {
          // Get the correct departure date for this route
          const departureDate = matrixData.stationDatesFormatted?.[fromStation] || matrixData.date;
          
          setCellDetailModal({
            fromStation,
            toStation,
            seatType: selectedSeatType,
            seatData,
            totalSeats,
            fare,
            departureDate // Add departure date to modal data
          });
        }}
        rippleColor="rgba(0, 103, 71, 0.2)"
        borderless={false}
      >
        <Surface style={styles.cellContent} elevation={1}>
          <Surface style={styles.ticketCountContainer} elevation={0}>
            <Text style={styles.ticketCountText}>{totalSeats}</Text>
          </Surface>
          <View style={styles.fareContainer}>
            <Text style={styles.fareText}>৳{Math.round(fare)}</Text>
          </View>
        </Surface>
      </TouchableRipple>
    );
  }, [filteredStations, matrixData, selectedSeatType]); // Add dependencies for useCallback

  const renderTrainInfo = () => (
    <Surface style={styles.infoCard} elevation={2}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderContent}>
          <Text variant="headlineSmall" style={styles.trainName}>
            {matrixData.trainName}
          </Text>
        </View>
      </View>
      
      <Divider style={styles.divider} />
      
      <Surface style={styles.dateContainer} elevation={1}>
        <View style={styles.dateHeader}>
          <Ionicons name="calendar" size={20} color={theme.colors.primary} />
          <Text variant="titleMedium" style={styles.dateTitle}>
            Journey Date: {matrixData.date}
          </Text>
        </View>
      </Surface>

      {matrixData.hasSegmentedDates && (
        <Surface style={styles.warningCard} elevation={1}>
          <View style={styles.warningHeader}>
            <Ionicons name="information-circle-outline" size={20} color="#0369A1" />
            <Text variant="titleSmall" style={styles.warningTitle}>Journey Spans Multiple Days</Text>
          </View>
          <Text variant="bodySmall" style={styles.warningText}>
            This train departs from {matrixData.stations[0]} on {matrixData.date}, but reaches certain stations after midnight
            — in the early hours of {matrixData.nextDayStr}. Ticket availability for those post-midnight arrivals may
            appear under {matrixData.nextDayStr}.
          </Text>
          <View style={styles.alertTip}>
            <Ionicons name="information-circle-outline" size={16} color="#166534" />
            <Text style={styles.alertTipText}>
              Tip: To find tickets for arrivals early on {matrixData.date}, try searching with {matrixData.prevDayStr} as your journey date.
            </Text>
          </View>
        </Surface>
      )}
    </Surface>
  );

  const renderTrainRouteSection = () => {
    // Helper function to format duration from "HH:MM" string
    const formatDuration = (duration) => {
      if (!duration || duration === '---') return '———';
      try {
        const [hours, minutes] = duration.split(':').map(val => parseInt(val, 10));
        if (hours > 0 && minutes > 0) {
          return `${hours} h ${minutes} min`;
        } else if (hours > 0) {
          return `${hours} h`;
        } else if (minutes > 0) {
          return `${minutes} min`;
        }
        return '———';
      } catch (error) {
        return '———';
      }
    };

    // Helper function to format halt time
    const formatHalt = (halt) => {
      if (!halt || halt === '---') return '———';
      try {
        const haltInt = parseInt(halt, 10);
        return `${haltInt} min`;
      } catch (error) {
        return '———';
      }
    };

    // Helper function to clean time string (remove BST)
    const cleanTime = (timeStr) => {
      if (!timeStr) return '———';
      return timeStr.replace(' BST', '').trim();
    };

    return (
      <Surface style={styles.routeCard} elevation={2}>
        <TouchableRipple
          onPress={() => setShowTrainRoute(!showTrainRoute)}
          style={[styles.routeToggleBtn, !showTrainRoute && styles.routeToggleBtnCollapsed]}
          rippleColor="rgba(0, 103, 71, 0.12)"
        >
          <View style={styles.routeToggleContent}>
            <View style={styles.routeToggleLeft}>
              <Ionicons name="git-branch-outline" size={20} color="#006747" />
              <Text style={styles.routeToggleText}>
                {showTrainRoute ? 'Collapse Train Route' : 'Expand Train Route'}
              </Text>
            </View>
            <Ionicons 
              name={showTrainRoute ? "chevron-up" : "chevron-down"} 
              size={24} 
              color="#006747" 
            />
          </View>
        </TouchableRipple>

        {showTrainRoute && (
          <>
            <Divider style={styles.routeDivider} />
            
            <View style={styles.routeBody}>
              {/* Train Header with Days */}
              <View style={styles.routeTrainHeader}>
                <View style={styles.routeTrainNameContainer}>
                  <Ionicons name="train" size={20} color="#006747" />
                  <Text style={styles.routeTrainName}>{matrixData.trainName}</Text>
                </View>
                
                <View style={styles.runDaysList}>
                  <Text style={styles.runDaysTitle}>Runs on:</Text>
                  <View style={styles.runDaysRow}>
                    {['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => {
                      const isActive = matrixData.days.includes(day);
                      return (
                        <View 
                          key={day}
                          style={[
                            styles.runDayChip,
                            isActive ? styles.runDayChipActive : styles.runDayChipInactive
                          ]}
                        >
                          <Text style={[
                            styles.runDayText,
                            isActive ? styles.runDayTextActive : styles.runDayTextInactive
                          ]}>
                            {day}
                          </Text>
                          {!isActive && <Text style={styles.runDayOff}>off</Text>}
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* Station Timeline */}
              <View style={styles.stationTimelineWrapper}>
                <ScrollView 
                  style={styles.stationTimelineContainer}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                >
                  <View style={styles.stationTimeline}>
                    {matrixData.routes.map((stop, index) => {
                    const isFirst = index === 0;
                    const isLast = index === matrixData.routes.length - 1;
                    
                    return (
                      <View 
                        key={`${stop.city}-${index}`} 
                        style={[
                          styles.stationItem,
                          isFirst && styles.stationItemStart,
                          isLast && styles.stationItemEnd
                        ]}
                      >
                        {/* Station Node with Line */}
                        <View style={styles.stationNode}>
                          <View style={[
                            styles.stationIconCircle,
                            isFirst && styles.stationIconCircleStart,
                            isLast && styles.stationIconCircleEnd
                          ]}>
                            <Ionicons 
                              name={isFirst ? "play-circle" : isLast ? "checkmark-circle" : "location"} 
                              size={isFirst || isLast ? 20 : 16} 
                              color="#FFFFFF" 
                            />
                          </View>
                          {!isLast && <View style={styles.stationLine} />}
                        </View>

                        {/* Station Info */}
                        <View style={styles.stationInfo}>
                          <View style={styles.stationHeader}>
                            <View style={styles.stationNameContainer}>
                              <Text style={styles.stationNameText}>{stop.city}</Text>
                              {stop.display_date && (
                                <Surface style={styles.stationDateBadge} elevation={0}>
                                  <Text style={styles.stationDateText}>{stop.display_date}</Text>
                                </Surface>
                              )}
                            </View>
                            {isFirst && (
                              <View style={[styles.stationTypeLabel, styles.stationTypeLabelStart]}>
                                <Text style={styles.stationTypeLabelText}>Origin</Text>
                              </View>
                            )}
                            {isLast && (
                              <View style={[styles.stationTypeLabel, styles.stationTypeLabelEnd]}>
                                <Text style={styles.stationTypeLabelText}>Destination</Text>
                              </View>
                            )}
                          </View>

                          {/* Station Meta Row */}
                          <View style={styles.stationMetaRow}>
                            <View style={styles.metaItem}>
                              <Text style={styles.metaItemLabel}>Arrival:</Text>
                              <Text style={styles.metaItemValue}>
                                {cleanTime(stop.arrival_time)}
                              </Text>
                            </View>

                            <View style={styles.metaItem}>
                              <Text style={styles.metaItemLabel}>Departure:</Text>
                              <Text style={styles.metaItemValue}>
                                {cleanTime(stop.departure_time)}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.stationMetaRow}>
                            <View style={styles.metaItem}>
                              <Text style={styles.metaItemLabel}>Halt:</Text>
                              <Text style={styles.metaItemValue}>
                                {formatHalt(stop.halt)}
                              </Text>
                            </View>

                            <View style={styles.metaItem}>
                              <Text style={styles.metaItemLabel}>Duration:</Text>
                              <Text style={styles.metaItemValue}>
                                {formatDuration(stop.duration)}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
              
              {/* Top gradient overlay */}
              <View style={styles.routeGradientTop} pointerEvents="none">
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0)']}
                  locations={[0, 1]}
                  style={styles.routeGradient}
                />
              </View>
              
              {/* Bottom gradient overlay */}
              <View style={styles.routeGradientBottom} pointerEvents="none">
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.95)']}
                  locations={[0, 1]}
                  style={styles.routeGradient}
                />
              </View>
            </View>

              {/* Total Journey Time */}
              <Surface style={styles.totalJourneyTime} elevation={1}>
                <Ionicons name="time" size={20} color="#006747" />
                <Text style={styles.totalJourneyTimeLabel}>Total Duration:</Text>
                <Text style={styles.totalJourneyTimeValue}>
                  {formatDuration(matrixData.totalDuration)}
                </Text>
              </Surface>
            </View>
          </>
        )}
      </Surface>
    );
  };

  const renderCellDetailModal = () => {
    if (!cellDetailModal) return null;

    const { fromStation, toStation, seatType, seatData, totalSeats, fare, departureDate } = cellDetailModal;
    
    const handleBuyTicket = () => {
      // Use the correct departure date for this specific route
      const formattedDate = departureDate; // This is already in DD-MMM-YYYY format
      const bookingUrl = `https://eticket.railway.gov.bd/booking/train/search?fromcity=${encodeURIComponent(fromStation)}&tocity=${encodeURIComponent(toStation)}&doj=${encodeURIComponent(formattedDate)}&class=${encodeURIComponent(seatType)}`;
      
      setCellDetailModal(null); // Close dialog first
      Linking.openURL(bookingUrl).catch(err => {
        setErrorMessage('Could not open booking website');
        setShowErrorDialog(true);
      });
    };

    return (
      <Portal>
        <Dialog
          visible={true}
          onDismiss={() => setCellDetailModal(null)}
          style={styles.dialogContainer}
        >
          <Dialog.Title style={styles.dialogTitle}>
            {fromStation} → {toStation}
          </Dialog.Title>
          
          <Dialog.Content style={styles.dialogContent}>
            <View style={styles.dialogInfoRow}>
              <Text variant="bodyMedium" style={styles.dialogLabel}>Departure Date:</Text>
              <Text variant="bodyLarge" style={styles.dialogValue}>{departureDate}</Text>
            </View>
            
            <View style={styles.dialogInfoRow}>
              <Text variant="bodyMedium" style={styles.dialogLabel}>Seat Type:</Text>
              <Text variant="bodyLarge" style={styles.dialogValue}>{SEAT_TYPE_LABELS[seatType]}</Text>
            </View>
            
            <View style={styles.dialogInfoRow}>
              <Text variant="bodyMedium" style={styles.dialogLabel}>Available Seats:</Text>
              <Text variant="bodyLarge" style={styles.dialogValue}>{totalSeats}</Text>
            </View>
            
            <Divider style={styles.dialogDivider} />
            
            <View style={styles.fareBreakdownContainer}>
              <Text variant="titleSmall" style={styles.fareBreakdownTitle}>Fare Breakdown</Text>
              
              <View style={styles.dialogInfoRow}>
                <Text variant="bodyMedium" style={styles.dialogLabel}>Base Fare:</Text>
                <Text variant="bodyMedium" style={styles.dialogValue}>৳{Math.round(seatData.fare)}</Text>
              </View>
              
              {seatData.vat_amount > 0 && (
                <View style={styles.dialogInfoRow}>
                  <Text variant="bodyMedium" style={styles.dialogLabel}>VAT:</Text>
                  <Text variant="bodyMedium" style={styles.dialogValue}>৳{Math.round(seatData.vat_amount)}</Text>
                </View>
              )}
              
              <View style={styles.dialogInfoRow}>
                <Text variant="bodyMedium" style={styles.dialogLabel}>Service Charge:</Text>
                <Text variant="bodyMedium" style={styles.dialogValue}>৳20</Text>
              </View>
              
              <Divider style={styles.dialogDivider} />
              
              <View style={styles.dialogInfoRow}>
                <Text variant="bodyLarge" style={styles.dialogLabelBold}>Total Fare:</Text>
                <Text variant="bodyLarge" style={styles.dialogFare}>৳{Math.round(fare + 20)}</Text>
              </View>
            </View>
          </Dialog.Content>
          
          <Dialog.Actions style={styles.dialogActions}>
            <Button
              mode="text"
              onPress={() => setCellDetailModal(null)}
              style={styles.cancelButton}
              labelStyle={styles.cancelButtonLabel}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleBuyTicket}
              style={styles.bookButton}
              labelStyle={styles.bookButtonLabel}
              icon="open-in-new"
            >
              Book Ticket
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    );
  };

  const renderRouteResults = () => {
    if (!routeResults || routeResults.length === 0) {
      return (
        <Surface style={styles.noResultCard} elevation={1}>
          <View style={styles.noResultContent}>
            <View style={styles.noResultIconContainer}>
              <Ionicons name="alert-circle" size={48} color="#FF9800" />
            </View>
            <Text style={styles.noResultTitle}>No Routes Available</Text>
            <Text style={styles.noResultText}>
              Unfortunately, no direct, segmented, or mixed-seat-type tickets are available between{' '}
              <Text style={styles.stationHighlight}>{fromStation}</Text> and{' '}
              <Text style={styles.stationHighlight}>{toStation}</Text> for the selected travel date.
            </Text>
            <Surface style={styles.suggestionContainer} elevation={0}>
              <View style={styles.suggestionHeader}>
                <Ionicons name="information-circle" size={16} color="#006747" />
                <Text style={styles.suggestionTitle}>Suggestions</Text>
              </View>
              <Text style={styles.suggestionText}>
                • Try selecting intermediate stations{'\n'}
                • Check different travel dates{'\n'}
                • Generate a fresh matrix for updated data
              </Text>
            </Surface>
          </View>
        </Surface>
      );
    }

    return routeResults.map((result, index) => (
      <Surface key={index} style={styles.routeResultCard} elevation={2}>
        {/* Route Type Header */}
        <View style={[
          styles.routeTypeHeader,
          result.type === 'DIRECT' && styles.directHeader,
          result.type === 'SEGMENTED' && styles.segmentedHeader,
          result.type === 'MIXED_SEGMENTED' && styles.mixedHeader
        ]}>
          <View style={styles.routeTypeLeft}>
            <View style={[
              styles.routeTypeIcon,
              result.type === 'DIRECT' && styles.directIcon,
              result.type === 'SEGMENTED' && styles.segmentedIcon,
              result.type === 'MIXED_SEGMENTED' && styles.mixedIcon
            ]}>
              <Ionicons 
                name={
                  result.type === 'DIRECT' ? 'arrow-forward' :
                  result.type === 'SEGMENTED' ? 'git-branch' : 'shuffle'
                }
                size={20} 
                color="#FFFFFF" 
              />
            </View>
            <View style={styles.routeTypeTextContainer}>
              <Text style={styles.routeTypeTitle}>
                {result.type === 'DIRECT' ? 'Direct Route' :
                 result.type === 'SEGMENTED' ? 'Segmented Route' :
                 'Mixed Segmented Route'}
              </Text>
              <Text style={styles.routeTypeSubtitle}>
                {result.seatType ? SEAT_TYPE_LABELS[result.seatType] : 
                 `${result.segments.length} segment${result.segments.length > 1 ? 's' : ''}`}
              </Text>
            </View>
          </View>
        </View>

        {/* Route Segments */}
        <View style={styles.segmentsContainer}>
          {result.segments.map((segment, segIndex) => {
            // Check if all segments have the same date
            const allSameDay = result.segments.every(seg => seg.date === result.segments[0].date);
            // Show date for ALL segments when they span multiple dates (like web version)
            const showDate = !allSameDay;
            
            // Determine date chip color based on whether it's the original journey date or a different date
            const segmentDate = segment.date || matrixData.date;
            const isOriginalDate = segmentDate === matrixData.date;
            const chipStyle = isOriginalDate ? styles.segmentDateChipOriginal : styles.segmentDateChipDifferent;
            
            return (
            <View key={segIndex} style={styles.segmentCard}>
              <View style={styles.segmentHeader}>
                <View style={styles.segmentRouteContainer}>
                  <View style={styles.segmentRouteInfo}>
                    <Text style={styles.segmentRoute}>
                      {segment.from} → {segment.to}
                    </Text>
                    {showDate && (
                      <View style={[styles.segmentDateChip, chipStyle]}>
                        <Ionicons name="calendar" size={12} color="#FFFFFF" />
                        <Text style={styles.segmentDateText}>
                          {segmentDate}
                        </Text>
                      </View>
                    )}
                  </View>
                  {result.type === 'MIXED_SEGMENTED' && (
                    <Chip 
                      mode="outlined" 
                      compact 
                      style={styles.segmentSeatChip}
                      textStyle={styles.segmentSeatChipText}
                    >
                      {SEAT_TYPE_LABELS[segment.seatType]}
                    </Chip>
                  )}
                </View>
                {result.segments.length > 1 && (
                  <View style={styles.segmentNumber}>
                    <Text style={styles.segmentNumberText}>{segIndex + 1}</Text>
                  </View>
                )}
              </View>

              {/* Fare Details */}
              <View style={styles.fareDetailsContainer}>
                <View style={styles.fareGrid}>
                  <View style={styles.fareGridItem}>
                    <Text style={styles.fareGridLabel}>Base Fare</Text>
                    <Text style={styles.fareGridValue}>৳{segment.base}</Text>
                  </View>
                  {segment.vat > 0 && (
                    <View style={styles.fareGridItem}>
                      <Text style={styles.fareGridLabel}>VAT</Text>
                      <Text style={styles.fareGridValue}>৳{segment.vat}</Text>
                    </View>
                  )}
                  <View style={styles.fareGridItem}>
                    <Text style={styles.fareGridLabel}>Service</Text>
                    <Text style={styles.fareGridValue}>৳{segment.charge}</Text>
                  </View>
                </View>
                
                <Divider style={styles.fareGridDivider} />
                
                <View style={styles.segmentTotal}>
                  <Text style={styles.segmentTotalLabel}>Total Amount</Text>
                  <Text style={styles.segmentTotalValue}>৳{segment.total}</Text>
                </View>
              </View>

              {/* Ticket Action */}
              <View style={styles.ticketActionRow}>
                <View style={styles.availabilityInfo}>
                  <Ionicons name="ticket" size={16} color="#006747" />
                  <Text style={styles.availabilityText}>
                    {segment.seats} {segment.seats === 1 ? 'ticket' : 'tickets'} available
                  </Text>
                </View>
                <Button
                  mode="contained-tonal"
                  style={styles.buyTicketButton}
                  labelStyle={styles.buyTicketButtonText}
                  contentStyle={styles.buyTicketButtonContent}
                  onPress={() => {
                    const formattedDate = segment.date || matrixData.date;
                    const bookingUrl = `https://eticket.railway.gov.bd/booking/train/search?fromcity=${encodeURIComponent(segment.from)}&tocity=${encodeURIComponent(segment.to)}&doj=${encodeURIComponent(formattedDate)}&class=${encodeURIComponent(segment.seatType)}`;
                    Linking.openURL(bookingUrl).catch(() => {
                      setErrorMessage('Could not open booking website');
                      setShowErrorDialog(true);
                    });
                  }}
                  icon="open-in-new"
                  compact
                >
                  Book Now
                </Button>
              </View>
            </View>
            );
          })}
        </View>

        {/* Grand Total */}
        <View style={styles.grandTotalContainer}>
          <View style={styles.grandTotalLeft}>
            <Ionicons name="wallet" size={20} color="#FFFFFF" />
            <Text style={styles.grandTotalLabel}>Grand Total</Text>
          </View>
          <Text style={styles.grandTotalValue}>৳{result.totalFare}</Text>
        </View>
      </Surface>
    ));
  };

  const renderRouteChecker = () => {
    return (
      <Surface style={styles.routeCheckerCard} elevation={2}>
        <View style={styles.routeCheckerHeader}>
          <View style={styles.routeCheckerTitleContainer}>
            <View style={styles.routeCheckerTitleWrapper}>
              <Text style={styles.routeCheckerTitle}>Check Route Availability</Text>
              <Text style={styles.routeCheckerSubtitle}>
                Find direct, segmented, or mixed ticket options
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.stationSelectionContainer}>
          <View style={styles.stationInputRow}>
            <View style={styles.stationInputGroup}>
              <Text style={styles.stationInputLabel}>From Station</Text>
              <TouchableRipple
                onPress={() => setFromDropdownVisible(true)}
                style={[
                  styles.stationSelector,
                  fromDropdownVisible && styles.stationSelectorActive
                ]}
                rippleColor="rgba(0, 103, 71, 0.12)"
              >
                <View style={styles.stationSelectorContent}>
                  <View style={styles.stationSelectorLeft}>
                    <Ionicons 
                      name="train" 
                      size={20} 
                      color={fromStation ? '#006747' : '#9CA3AF'} 
                    />
                    <Text style={[
                      styles.stationSelectorText,
                      fromStation ? styles.stationSelectorTextActive : styles.stationSelectorTextPlaceholder
                    ]}>
                      {fromStation || 'Select departure station'}
                    </Text>
                  </View>
                  <Ionicons 
                    name="chevron-down" 
                    size={20} 
                    color="#9CA3AF"
                    style={[
                      styles.chevronIcon,
                      fromDropdownVisible && styles.chevronIconRotated
                    ]}
                  />
                </View>
              </TouchableRipple>
              
              <Modal
                visible={fromDropdownVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setFromDropdownVisible(false)}
              >
                <Pressable 
                  style={styles.modalOverlay}
                  onPress={() => setFromDropdownVisible(false)}
                >
                  <View style={styles.dropdownModal}>
                    <View style={styles.dropdownHeader}>
                      <Text style={styles.dropdownTitle}>Select Departure Station</Text>
                      <IconButton
                        icon="close"
                        size={20}
                        onPress={() => setFromDropdownVisible(false)}
                      />
                    </View>
                    <ScrollView style={styles.dropdownList}>
                      {availableFromStations.map((station) => (
                        <TouchableRipple
                          key={station}
                          onPress={() => {
                            setFromStation(station);
                            setFromDropdownVisible(false);
                            if (routeResults) setRouteResults(null);
                          }}
                          style={[
                            styles.dropdownItem,
                            fromStation === station && styles.dropdownItemSelected
                          ]}
                          rippleColor="rgba(0, 103, 71, 0.1)"
                        >
                          <View style={styles.dropdownItemContent}>
                            <Text style={[
                              styles.dropdownItemText,
                              fromStation === station && styles.dropdownItemTextSelected
                            ]}>
                              {station}
                            </Text>
                            {fromStation === station && (
                              <Ionicons name="checkmark" size={20} color="#006747" />
                            )}
                          </View>
                        </TouchableRipple>
                      ))}
                    </ScrollView>
                  </View>
                </Pressable>
              </Modal>
            </View>

            <TouchableRipple
              onPress={swapStations}
              style={styles.swapButtonContainer}
              rippleColor="rgba(0, 103, 71, 0.12)"
              borderless
            >
              <View style={styles.swapButton}>
                <Ionicons name="swap-vertical" size={24} color="#006747" />
              </View>
            </TouchableRipple>

            <View style={styles.stationInputGroup}>
              <Text style={styles.stationInputLabel}>To Station</Text>
              <TouchableRipple
                onPress={() => setToDropdownVisible(true)}
                style={[
                  styles.stationSelector,
                  toDropdownVisible && styles.stationSelectorActive
                ]}
                rippleColor="rgba(0, 103, 71, 0.12)"
              >
                <View style={styles.stationSelectorContent}>
                  <View style={styles.stationSelectorLeft}>
                    <Ionicons 
                      name="location" 
                      size={20} 
                      color={toStation ? '#006747' : '#9CA3AF'} 
                    />
                    <Text style={[
                      styles.stationSelectorText,
                      toStation ? styles.stationSelectorTextActive : styles.stationSelectorTextPlaceholder
                    ]}>
                      {toStation || 'Select arrival station'}
                    </Text>
                  </View>
                  <Ionicons 
                    name="chevron-down" 
                    size={20} 
                    color="#9CA3AF"
                    style={[
                      styles.chevronIcon,
                      toDropdownVisible && styles.chevronIconRotated
                    ]}
                  />
                </View>
              </TouchableRipple>
              
              <Modal
                visible={toDropdownVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setToDropdownVisible(false)}
              >
                <Pressable 
                  style={styles.modalOverlay}
                  onPress={() => setToDropdownVisible(false)}
                >
                  <View style={styles.dropdownModal}>
                    <View style={styles.dropdownHeader}>
                      <Text style={styles.dropdownTitle}>Select Arrival Station</Text>
                      <IconButton
                        icon="close"
                        size={20}
                        onPress={() => setToDropdownVisible(false)}
                      />
                    </View>
                    <ScrollView style={styles.dropdownList}>
                      {availableToStations.map((station) => (
                        <TouchableRipple
                          key={station}
                          onPress={() => {
                            setToStation(station);
                            setToDropdownVisible(false);
                            if (routeResults) setRouteResults(null);
                          }}
                          style={[
                            styles.dropdownItem,
                            toStation === station && styles.dropdownItemSelected
                          ]}
                          rippleColor="rgba(0, 103, 71, 0.1)"
                        >
                          <View style={styles.dropdownItemContent}>
                            <Text style={[
                              styles.dropdownItemText,
                              toStation === station && styles.dropdownItemTextSelected
                            ]}>
                              {station}
                            </Text>
                            {toStation === station && (
                              <Ionicons name="checkmark" size={20} color="#006747" />
                            )}
                          </View>
                        </TouchableRipple>
                      ))}
                    </ScrollView>
                  </View>
                </Pressable>
              </Modal>
            </View>
          </View>

          <Button
            mode="contained"
            onPress={checkRouteAvailability}
            style={[
              styles.searchButton,
              (!fromStation || !toStation || isSearching) && styles.searchButtonDisabled
            ]}
            labelStyle={styles.searchButtonText}
            contentStyle={styles.searchButtonContent}
            disabled={!fromStation || !toStation || isSearching}
            loading={isSearching}
            icon={isSearching ? undefined : ({ size, color }) => (
              <Ionicons name="search" size={24} color={color} />
            )}
          >
            {isSearching ? 'Searching Routes...' : 'Search Available Routes'}
          </Button>

          <Surface style={styles.infoContainer} elevation={0}>
            <View style={styles.infoRow}>
              <Ionicons name="information-circle" size={16} color="#006747" />
              <Text style={styles.infoText}>
                Results are based on current matrix data. For real-time availability, generate a fresh matrix.
              </Text>
            </View>
          </Surface>
        </View>
      </Surface>
    );
  };

  if (!matrixData) {
    return (
      <View style={styles.errorContainer}>
        <Text variant="headlineMedium">No Data Available</Text>
        <Button
          mode="contained"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          Go Back
        </Button>
      </View>
    );
  }

  return (
    <ScrollView 
      ref={mainScrollViewRef}
      style={styles.container}
      keyboardShouldPersistTaps="handled"
      scrollToOverflowEnabled={true}
      nestedScrollEnabled={true}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#006747', '#006747']}
          tintColor="#006747"
          title=""
          progressBackgroundColor="#F0F8F5"
          size="large"
        />
      }
    >
      {renderTrainInfo()}
      
      {/* Train Route Section - Added collapsible section */}
      {renderTrainRouteSection()}
      
      <Surface style={styles.seatTypesCard} elevation={2}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <Ionicons name="grid" size={20} color={theme.colors.primary} />
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Available Seat Types
            </Text>
          </View>
        </View>
        <View style={styles.seatTypesScrollContainer}>
          <FlatList
            data={availableSeatTypes}
            renderItem={renderSeatTypeChip}
            keyExtractor={(item) => item}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.seatTypesList}
            contentContainerStyle={styles.seatTypesContainer}
            onScroll={handleSeatTypesScroll}
            scrollEventThrottle={16} // Smooth scroll events (60fps)
          />
          {/* Left shadow gradient - only show when scrolled */}
          <Animated.View style={[styles.leftShadow, { opacity: leftShadowOpacity }]}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.7)', 'rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0)']}
              locations={[0, 0.3, 0.7, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shadowGradient}
              pointerEvents="none"
            />
          </Animated.View>
          {/* Right shadow gradient - only show when more content available */}
          <Animated.View style={[styles.rightShadow, { opacity: rightShadowOpacity }]}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.7)', 'rgba(255, 255, 255, 0.95)']}
              locations={[0, 0.3, 0.7, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shadowGradient}
              pointerEvents="none"
            />
          </Animated.View>
        </View>
      </Surface>

      {selectedSeatType && (
        <Surface style={styles.matrixCard} elevation={2}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Ionicons name="grid" size={20} color={theme.colors.primary} />
              <Text variant="titleMedium" style={styles.sectionTitle}>
                {SEAT_TYPE_LABELS[selectedSeatType]} Matrix
              </Text>
            </View>
          </View>
          
          <View style={[styles.matrixContainer, { height: dynamicDimensions.containerHeight }]} key={`${selectedSeatType}-${matrixKey}`}>
            {/* Fixed Corner Cell */}
            <View style={[styles.fixedCornerCell, { width: dynamicDimensions.leftColumnWidth, height: dynamicDimensions.headerHeight }]}>
              <Surface style={[styles.cornerCell, { width: dynamicDimensions.leftColumnWidth, height: dynamicDimensions.headerHeight }]} elevation={2}>
                <Text style={styles.cornerCellText}>From → To</Text>
              </Surface>
            </View>
            
            {/* Fixed Header Row */}
            <View style={[styles.fixedHeaderRow, { left: dynamicDimensions.leftColumnWidth, height: dynamicDimensions.headerHeight }]}>
              <ScrollView 
                key={`header-${selectedSeatType}`}
                horizontal 
                showsHorizontalScrollIndicator={false}
                ref={headerScrollRef}
                scrollEnabled={false}
                bounces={false}
                contentContainerStyle={dynamicDimensions.shouldFillWidth ? { width: dynamicDimensions.availableWidth } : undefined}
              >
                <View style={[
                  styles.headerRowContent, 
                  { 
                    height: dynamicDimensions.headerHeight,
                    width: dynamicDimensions.shouldFillWidth ? dynamicDimensions.availableWidth : undefined
                  }
                ]}>
                  {filteredStations.map((station, colIndex) => {
                    const cellWidth = dynamicDimensions.shouldFillWidth
                      ? dynamicDimensions.availableWidth / filteredStations.length
                      : dynamicDimensions.cellWidth;
                    
                    return (
                      <Surface 
                        key={`header-${station}`} 
                        style={[
                          styles.headerCell, 
                          { 
                            width: cellWidth, 
                            height: dynamicDimensions.headerHeight 
                          },
                          (colIndex < filteredStations.length - 1) && { marginRight: 1 } // Only add margin between columns, not after last column
                        ]} 
                        elevation={1}
                      >
                        <Text style={styles.headerCellText}>{station}</Text>
                      </Surface>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
            
            {/* Matrix Body with Fixed First Column */}
            <View style={[styles.matrixBodyContainer, { marginTop: dynamicDimensions.headerHeight }]}>
              {/* Fixed First Column */}
              <View style={[styles.fixedFirstColumn, { width: dynamicDimensions.leftColumnWidth }]}>
                <ScrollView
                  key={`left-${selectedSeatType}`}
                  showsVerticalScrollIndicator={false}
                  ref={leftScrollRef}
                  scrollEnabled={false}
                  bounces={false}
                  contentContainerStyle={dynamicDimensions.shouldFillHeight ? { 
                    height: dynamicDimensions.contentHeight,
                    justifyContent: 'space-evenly'
                  } : undefined}
                >
                  <View style={dynamicDimensions.shouldFillHeight ? { 
                    height: dynamicDimensions.contentHeight,
                    justifyContent: 'space-evenly'
                  } : undefined}>
                    {filteredStations.map((fromStation, rowIndex) => (
                      <Surface 
                        key={`row-header-${fromStation}`} 
                        style={[
                          styles.rowHeaderCell, 
                          { 
                            width: dynamicDimensions.leftColumnWidth, 
                            height: dynamicDimensions.cellHeight,
                            ...(dynamicDimensions.shouldFillHeight && { marginBottom: 0 }),
                            ...(rowIndex < filteredStations.length - 1 && { marginBottom: 1 }) // Only add margin between rows, not after last row
                          }
                        ]} 
                        elevation={1}
                      >
                        <Text style={styles.rowHeaderText}>{fromStation}</Text>
                      </Surface>
                    ))}
                  </View>
                </ScrollView>
              </View>
              
              {/* Scrollable Matrix Content */}
              <ScrollView 
                key={`matrix-h-${selectedSeatType}`}
                horizontal={true}
                showsHorizontalScrollIndicator={true}
                showsVerticalScrollIndicator={false}
                style={styles.matrixScrollView}
                contentContainerStyle={dynamicDimensions.shouldFillWidth ? { 
                  width: dynamicDimensions.availableWidth 
                } : undefined}
                ref={bodyScrollRef}
                onScroll={(event) => {
                  const { contentOffset } = event.nativeEvent;
                  
                  // Sync horizontal scroll with header in real-time
                  if (headerScrollRef.current) {
                    headerScrollRef.current.scrollTo({ x: contentOffset.x, animated: false });
                  }
                }}
                scrollEventThrottle={16}
                bounces={false}
                directionalLockEnabled={false}
                nestedScrollEnabled={true}
                simultaneousHandlers={['outer-scroll']}
              >
                <ScrollView
                  key={`matrix-v-${selectedSeatType}`}
                  showsVerticalScrollIndicator={true}
                  bounces={false}
                  directionalLockEnabled={false}
                  nestedScrollEnabled={true}
                  contentContainerStyle={dynamicDimensions.shouldFillHeight ? { 
                    height: dynamicDimensions.contentHeight 
                  } : undefined}
                  onScroll={(event) => {
                    const { contentOffset } = event.nativeEvent;
                    
                    // Sync vertical scroll with left column in real-time
                    if (leftScrollRef.current) {
                      leftScrollRef.current.scrollTo({ y: contentOffset.y, animated: false });
                    }
                  }}
                  scrollEventThrottle={16}
                >
                  <View 
                    key={`matrix-content-${selectedSeatType}`}
                    style={[
                    styles.matrixContent, 
                    dynamicDimensions.shouldFillHeight ? {
                      height: dynamicDimensions.contentHeight,
                      justifyContent: 'space-evenly'
                    } : undefined,
                    dynamicDimensions.shouldFillWidth ? {
                      width: dynamicDimensions.availableWidth
                    } : undefined
                  ]}>
                    {filteredStations.map((fromStation, rowIndex) => {
                      // Calculate cell width based on filling container or not
                      const cellWidth = dynamicDimensions.shouldFillWidth
                        ? dynamicDimensions.availableWidth / filteredStations.length
                        : dynamicDimensions.cellWidth;
                      
                      return (
                        <View key={fromStation} style={[
                          styles.matrixRow, 
                          { height: dynamicDimensions.cellHeight },
                          dynamicDimensions.shouldFillWidth ? { width: dynamicDimensions.availableWidth } : undefined,
                          (rowIndex < filteredStations.length - 1) && { marginBottom: 1 } // Match left column spacing
                        ]}>
                          {filteredStations.map((toStation, colIndex) => (
                            <View 
                              key={`${fromStation}-${toStation}`} 
                              style={[
                                styles.cellContainer, 
                                { 
                                  width: cellWidth, 
                                  height: dynamicDimensions.cellHeight 
                                },
                                (colIndex < filteredStations.length - 1) && { marginRight: 1 } // Match header column spacing
                              ]}
                            >
                              {renderMatrixCell(fromStation, toStation)}
                            </View>
                          ))}
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </ScrollView>
            </View>
          </View>
        </Surface>
      )}

      {/* Always show route checker */}
      {renderRouteChecker()}
      
      {routeResults && routeResults.length > 0 && (
        <View ref={routeResultsRef} style={styles.routeResultsContainer}>
          <Text style={styles.routeResultsTitle}>Available Route Options</Text>
          {renderRouteResults()}
        </View>
      )}
      
      {routeResults && routeResults.length === 0 && fromStation && toStation && !isSearching && (
        <View ref={routeResultsRef} style={styles.routeResultsContainer}>
          {renderRouteResults()}
        </View>
      )}
      
      <View style={styles.bottomSpacing} />
      
      {renderCellDetailModal()}
      
      {/* Error Dialog */}
      <Portal>
        {/* Refresh Confirmation Dialog */}
        <Dialog
          visible={showRefreshDialog}
          onDismiss={handleRefreshCancel}
          style={styles.refreshDialog}
        >
          <Dialog.Icon icon="refresh" size={28} color="#006747" />
          <Dialog.Title style={styles.refreshDialogTitle}>
            Update Matrix Data?
          </Dialog.Title>
          <Dialog.Content style={styles.refreshDialogContent}>
            <Text style={styles.refreshDialogText}>
              Do you want to update the matrix with the same information?
            </Text>
            <Surface style={styles.refreshInfoCard} elevation={0}>
              <View style={styles.refreshInfoRow}>
                <Ionicons name="train" size={16} color="#006747" />
                <Text style={styles.refreshInfoText}>{matrixData.trainName}</Text>
              </View>
              <View style={styles.refreshInfoRow}>
                <Ionicons name="calendar" size={16} color="#006747" />
                <Text style={styles.refreshInfoText}>{matrixData.date}</Text>
              </View>
            </Surface>
            <Text style={styles.refreshDialogHint}>
              This will fetch fresh seat availability data from the server.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.refreshDialogActions}>
            <Button
              mode="text"
              onPress={handleRefreshCancel}
              textColor="#49454F"
              labelStyle={styles.refreshCancelButtonLabel}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleRefreshConfirm}
              buttonColor="#006747"
              textColor="#FFFFFF"
              style={styles.refreshUpdateButton}
              labelStyle={styles.refreshUpdateButtonLabel}
            >
              Update
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Refresh Loading Dialog */}
        <Dialog
          visible={isRefreshLoading}
          dismissable={false}
          style={styles.loadingDialog}
        >
          <Dialog.Content style={styles.loadingDialogContent}>
            <View style={styles.loadingHeader}>
              <ActivityIndicator size={48} color="#006747" />
              <Text style={styles.loadingTitle}>Updating Matrix...</Text>
            </View>
            <Text style={styles.loadingMessage}>{refreshMessage}</Text>
            <ProgressBar 
              progress={refreshProgress} 
              color="#006747"
              style={styles.progressBar}
            />
            <Text style={styles.progressText}>
              {Math.round(refreshProgress * 100)}%
            </Text>
            <Button
              mode="outlined"
              onPress={cancelRefreshLoading}
              style={styles.cancelButton}
              labelStyle={styles.cancelButtonLabel}
              icon="close"
            >
              Cancel
            </Button>
          </Dialog.Content>
        </Dialog>

        {/* Error Dialog */}
        <Dialog
          visible={showErrorDialog}
          onDismiss={handleErrorDialogDismiss}
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
              onPress={handleErrorDialogDismiss}
              style={styles.errorDialogButton}
              labelStyle={styles.errorDialogButtonLabel}
            >
              OK
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC', // theme.colors.background
  },
  
  // Train Info Card Styles
  infoCard: {
    margin: 16,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderContent: {
    flex: 1,
  },
  trainName: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
    marginBottom: 4,
    textAlign: 'center',
  },
  divider: {
    backgroundColor: '#DDE5DB',
    height: 1,
    marginBottom: 16,
  },
  
  // Date Container
  dateContainer: {
    backgroundColor: '#E8F5F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTitle: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#006747',
    marginLeft: 8,
  },
  
  // Warning Card
  warningCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginBottom: 16,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  warningTitle: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#0369A1',
    marginLeft: 8,
    fontSize: 13,
  },
  warningText: {
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#0F172A',
    lineHeight: 18,
    fontSize: 12,
    marginBottom: 2,
  },
  alertTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: 12,
  },
  alertTipText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#166534',
    marginLeft: 8,
    lineHeight: 16,
    flex: 1,
  },
  
  // Seat Types Card
  seatTypesCard: {
    margin: 16,
    marginVertical: 8,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#006747',
    marginLeft: 8,
  },
  seatTypesList: {
    marginVertical: 4,
  },
  seatTypesScrollContainer: {
    position: 'relative',
  },
  seatTypesContainer: {
    paddingRight: 16,
    paddingLeft: 4, // Add small padding to ensure first chip is visible
  },
  leftShadow: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 32,
    zIndex: 1,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  rightShadow: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 32,
    zIndex: 1,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  shadowGradient: {
    flex: 1,
  },
  seatTypeChip: {
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#DDE5DB',
  },
  seatTypeText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
  },
  
  // Matrix Card
  matrixCard: {
    margin: 16,
    marginVertical: 8,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  
  // Matrix Container with Fixed Headers
  matrixContainer: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6F0E7',
    overflow: 'hidden',
    position: 'relative',
  },
  
  // Fixed Corner Cell
  fixedCornerCell: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 10,
  },
  
  // Fixed Header Row
  fixedHeaderRow: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 5,
    backgroundColor: '#FFFFFF',
  },
  headerRowContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  
  // Matrix Body Container
  matrixBodyContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  
  // Fixed First Column
  fixedFirstColumn: {
    backgroundColor: '#FFFFFF',
    zIndex: 5,
  },
  
  // Scrollable Matrix Content
  matrixScrollView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  matrixContent: {
    backgroundColor: '#FFFFFF',
    minHeight: '100%',
  },
  
  // Matrix Elements
  matrixRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cornerCell: {
    backgroundColor: '#006747',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cornerCellText: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 11,
    textAlign: 'center',
  },
  headerCell: {
    backgroundColor: '#006747',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCellText: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 8,
    textAlign: 'center',
    lineHeight: 10,
    flexWrap: 'wrap',
  },
  rowHeaderCell: {
    backgroundColor: '#006747',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  rowHeaderText: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 8,
    textAlign: 'center',
    lineHeight: 10,
    flexWrap: 'wrap',
  },
  cellContainer: {
    padding: 1,
  },
  availableCell: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  cellContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8F5F0',
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: '#CFE9D9',
  },
  ticketCountContainer: {
    backgroundColor: '#C1E1C1',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginBottom: 4,
  },
  ticketCountText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#006747',
    textAlign: 'center',
  },
  fareContainer: {
    marginBottom: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 4,
    paddingVertical: 0.15,
    borderRadius: 6,
  },
  fareText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#49454F',
    textAlign: 'center',
  },
  stationName: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans-Medium',
    textAlign: 'center',
    color: '#49454F',
  },
  emptyCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F9FC',
    borderRadius: 8,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Medium',
  },
  
  // Dialog Styles - Material Design 3
  dialogContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28, // M3 spec: 28dp rounded corners
    marginHorizontal: 24,
    elevation: 3,
  },
  dialogTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#1C1B1F', // M3 on-surface color
    fontSize: 20,
    lineHeight: 28,
    textAlign: 'center',
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  dialogContent: {
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 24,
  },
  dialogSeatType: {
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#49454F',
    textAlign: 'center',
    marginBottom: 20,
  },
  dialogInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 0,
  },
  dialogLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#49454F',
    fontSize: 14,
    lineHeight: 20,
  },
  dialogValue: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
    fontSize: 14,
    lineHeight: 20,
  },
  dialogFare: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
    fontSize: 16,
    lineHeight: 22,
  },
  dialogDivider: {
    marginVertical: 12,
    backgroundColor: '#E7E0EC', // M3 outline-variant color
  },
  fareBreakdownContainer: {
    backgroundColor: '#F6F2F7', // M3 surface-variant color
    borderRadius: 12,
    padding: 16,
    marginTop: 4,
  },
  fareBreakdownTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  dialogLabelBold: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#1C1B1F',
    fontSize: 15,
    lineHeight: 22,
  },
  dialogActions: {
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 24,
    gap: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    borderRadius: 20, // M3 spec: fully rounded buttons
    minWidth: 88,
  },
  cancelButtonLabel: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
    color: '#006747',
  },
  bookButton: {
    backgroundColor: '#006747',
    borderRadius: 20, // M3 spec: fully rounded buttons
    minWidth: 88,
    elevation: 0, // M3 filled buttons have no elevation
  },
  bookButtonLabel: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
    color: '#FFFFFF',
  },
  
  // Error State
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F7F9FC',
  },
  backButton: {
    marginTop: 20,
    backgroundColor: '#006747',
  },
  bottomSpacing: {
    height: 30,
  },

  // Route Checker Styles - Redesigned
  routeCheckerCard: {
    margin: 16,
    marginVertical: 8,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  routeCheckerHeader: {
    marginBottom: 20,
  },
  routeCheckerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeCheckerIconContainer: {
    backgroundColor: '#006747',
    borderRadius: 12,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  routeCheckerTitleWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  routeCheckerTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
    marginBottom: 4,
  },
  routeCheckerSubtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#49454F',
    lineHeight: 20,
    textAlign: 'center',
  },
  stationSelectionContainer: {
    gap: 16,
  },
  stationInputRow: {
    gap: 12,
  },
  stationInputGroup: {
    flex: 1,
  },
  stationInputLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#006747',
    marginBottom: 8,
  },
  stationSelector: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    minHeight: 56,
    justifyContent: 'center',
  },
  stationSelectorActive: {
    borderColor: '#006747',
    backgroundColor: '#F8FDF9',
  },
  stationSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  stationSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stationSelectorText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Medium',
    marginLeft: 12,
    flex: 1,
  },
  stationSelectorTextActive: {
    color: '#006747',
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  stationSelectorTextPlaceholder: {
    color: '#9CA3AF',
  },
  chevronIcon: {
    transform: [{ rotate: '0deg' }],
  },
  chevronIconRotated: {
    transform: [{ rotate: '180deg' }],
  },
  swapButtonContainer: {
    alignSelf: 'center',
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
  },
  swapButton: {
    width: 48,
    height: 48,
    backgroundColor: '#E8F5F0',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CFE9D9',
  },
  searchButton: {
    backgroundColor: '#006747',
    borderRadius: 12,
    marginTop: 4,
  },
  searchButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  searchButtonText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#FFFFFF',
  },
  searchButtonContent: {
    paddingVertical: 8,
  },
  infoContainer: {
    backgroundColor: '#E8F5F0',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#CFE9D9',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#006747',
    marginLeft: 8,
    lineHeight: 18,
    flex: 1,
  },
  
  // Custom Dropdown Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  dropdownTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
  },
  dropdownList: {
    maxHeight: 400,
  },
  dropdownItem: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  dropdownItemSelected: {
    backgroundColor: '#E8F5F0',
  },
  dropdownItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownItemText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#49454F',
    flex: 1,
  },
  dropdownItemTextSelected: {
    color: '#006747',
    fontFamily: 'PlusJakartaSans-Bold',
  },
  
  // Route Results Styles - Updated
  routeResultsContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  routeResultsTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
    marginBottom: 16,
    textAlign: 'center',
  },
  routeResultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  
  // No Results Card
  noResultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  noResultContent: {
    alignItems: 'center',
  },
  noResultIconContainer: {
    marginBottom: 16,
  },
  noResultTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#E65100',
    marginBottom: 8,
    textAlign: 'center',
  },
  noResultText: {
    textAlign: 'center',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#49454F',
    marginBottom: 16,
    lineHeight: 20,
  },
  stationHighlight: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
  },
  suggestionContainer: {
    backgroundColor: '#E8F5F0',
    borderRadius: 8,
    padding: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#CFE9D9',
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  suggestionTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#006747',
    marginLeft: 6,
  },
  suggestionText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#006747',
    lineHeight: 18,
  },
  
  // Route Type Header
  routeTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 12,
  },
  directHeader: {
    backgroundColor: '#E8F5E8',
  },
  segmentedHeader: {
    backgroundColor: '#E3F2FD',
  },
  mixedHeader: {
    backgroundColor: '#FCE4EC',
  },
  routeTypeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  routeTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  directIcon: {
    backgroundColor: '#4CAF50',
  },
  segmentedIcon: {
    backgroundColor: '#2196F3',
  },
  mixedIcon: {
    backgroundColor: '#E91E63',
  },
  routeTypeTextContainer: {
    flex: 1,
  },
  routeTypeTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
    marginBottom: 2,
  },
  routeTypeSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#49454F',
  },
  routeTypeBadge: {
    borderRadius: 12,
  },
  directBadge: {
    backgroundColor: '#C8E6C9',
  },
  segmentedBadge: {
    backgroundColor: '#BBDEFB',
  },
  mixedBadge: {
    backgroundColor: '#F8BBD9',
  },
  routeTypeBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
  },
  
  // Segments Container
  segmentsContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  segmentCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  segmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  segmentRouteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  segmentRouteInfo: {
    flexDirection: 'column',
    flex: 1,
  },
  segmentRoute: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
    marginBottom: 6,
  },
  segmentDateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  segmentDateChipOriginal: {
    backgroundColor: '#10B981', // Green for original date
  },
  segmentDateChipDifferent: {
    backgroundColor: '#F59E0B', // Amber for different date
  },

  segmentDateText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  segmentDate: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#666666',
    marginTop: 2,
    marginRight: 8,
  },
  segmentSeatChip: {
    height: 24,
    backgroundColor: 'transparent',
    borderColor: '#006747',
  },
  segmentSeatChipText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#006747',
  },
  segmentNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#006747',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentNumberText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#FFFFFF',
  },
  
  // Fare Details
  fareDetailsContainer: {
    marginBottom: 12,
  },
  fareGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  fareGridItem: {
    flex: 1,
    minWidth: 70,
    alignItems: 'center',
  },
  fareGridLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#9CA3AF',
    marginBottom: 2,
  },
  fareGridValue: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#49454F',
  },
  fareGridDivider: {
    backgroundColor: '#E0E0E0',
    height: 1,
    marginVertical: 4,
  },
  segmentTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E8F5F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  segmentTotalLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#006747',
  },
  segmentTotalValue: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
  },
  
  // Ticket Action
  ticketActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  availabilityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  availabilityText: {
    marginLeft: 6,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#006747',
  },
  buyTicketButton: {
    backgroundColor: '#E8F5F0',
    borderRadius: 8,
  },
  buyTicketButtonText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#006747',
  },
  buyTicketButtonContent: {
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  
  // Grand Total
  grandTotalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#006747',
    padding: 16,
    marginTop: 12,
  },
  grandTotalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  grandTotalLabel: {
    marginLeft: 8,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#FFFFFF',
  },
  grandTotalValue: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans-ExtraBold',
    color: '#FFFFFF',
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
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 0,
    elevation: 0,
  },
  errorDialogButtonLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#B3261E',
    marginHorizontal: 8,
  },
  
  // Refresh Dialog Styles (Material Design 3)
  refreshDialog: {
    margin: 24,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    elevation: 6,
  },
  refreshDialogTitle: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#1C1B1F',
    textAlign: 'center',
    marginTop: 8,
  },
  refreshDialogContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  refreshDialogText: {
    fontSize: 14,
    color: '#49454F',
    fontFamily: 'PlusJakartaSans-Regular',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  refreshInfoCard: {
    backgroundColor: '#E8F5F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  refreshInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  refreshInfoText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#006747',
    marginLeft: 8,
    flex: 1,
  },
  refreshDialogHint: {
    fontSize: 12,
    color: '#79747E',
    fontFamily: 'PlusJakartaSans-Regular',
    lineHeight: 16,
    textAlign: 'center',
  },
  refreshDialogActions: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  refreshCancelButtonLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-SemiBold',
    marginHorizontal: 12,
  },
  refreshUpdateButton: {
    borderRadius: 20,
    elevation: 0,
  },
  refreshUpdateButtonLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-SemiBold',
    marginHorizontal: 12,
  },
  
  // Loading Dialog Styles
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
  
  // Train Route Section Styles
  routeCard: {
    margin: 16,
    marginVertical: 8,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  routeToggleBtn: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  routeToggleBtnCollapsed: {
    paddingVertical: 16,
  },
  routeToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routeToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  routeToggleText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#006747',
    marginLeft: 10,
  },
  routeDivider: {
    backgroundColor: '#DDE5DB',
    height: 1,
  },
  routeBody: {
    padding: 20,
    paddingTop: 16,
  },
  routeTrainHeader: {
    marginBottom: 20,
  },
  routeTrainNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  routeTrainName: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
    marginLeft: 8,
  },
  runDaysList: {
    marginTop: 8,
  },
  runDaysTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#49454F',
    marginBottom: 8,
  },
  runDaysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  runDayChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 42,
    alignItems: 'center',
  },
  runDayChipActive: {
    backgroundColor: '#E8F5F0',
    borderWidth: 1,
    borderColor: '#C1E1C1',
  },
  runDayChipInactive: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  runDayText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  runDayTextActive: {
    color: '#006747',
  },
  runDayTextInactive: {
    color: '#9CA3AF',
  },
  runDayOff: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#9CA3AF',
    marginTop: 2,
  },
  stationTimelineWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  stationTimelineContainer: {
    maxHeight: 400,
  },
  routeGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 30,
    zIndex: 1,
  },
  routeGradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
    zIndex: 1,
  },
  routeGradient: {
    flex: 1,
  },
  stationTimeline: {
    paddingTop: 32,
    paddingBottom: 32,
  },
  stationItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  stationItemStart: {
    // First station styling
  },
  stationItemEnd: {
    marginBottom: 0,
  },
  stationNode: {
    alignItems: 'center',
    marginRight: 16,
    width: 32,
    marginTop: 10,
  },
  stationIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#006747',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  stationIconCircleStart: {
    backgroundColor: '#2E7D32',
  },
  stationIconCircleEnd: {
    backgroundColor: '#1565C0',
  },
  stationLine: {
    width: 3,
    flex: 1,
    backgroundColor: '#C1E1C1',
    marginTop: -10,
    marginBottom: -20,
  },
  stationInfo: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  stationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  stationNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stationNameText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
  },
  stationDateBadge: {
    backgroundColor: '#FFF3E0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  stationDateText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#E65100',
  },
  stationTypeLabel: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stationTypeLabelStart: {
    backgroundColor: '#E8F5E9',
  },
  stationTypeLabelEnd: {
    backgroundColor: '#E3F2FD',
  },
  stationTypeLabelText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
  },
  stationMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  metaItem: {
    flex: 1,
  },
  metaItemLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#49454F',
    marginBottom: 2,
  },
  metaItemValue: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
  },
  totalJourneyTime: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5F0',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  totalJourneyTimeLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#006747',
  },
  totalJourneyTimeValue: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
  },

});

export default MatrixResultsScreen;