import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Animated,
  Linking,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {
  Card,
  Text,
  Button,
  useTheme,
  IconButton,
  Divider,
  Chip,
  Portal,
  Dialog,
  Icon,
  DataTable,
  Surface,
  ProgressBar,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function SeatAvailabilityResultsScreen({ route, navigation }) {
  const theme = useTheme();
  const { availabilityData, origin, destination, date, seatClass } = route.params;
  
  const [expandedTrains, setExpandedTrains] = useState({});
  const [expandedSeatTypes, setExpandedSeatTypes] = useState({});
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [shouldNavigateBackOnError, setShouldNavigateBackOnError] = useState(false);
  
  // Pull to refresh states
  const [refreshing, setRefreshing] = useState(false);
  const [showRefreshDialog, setShowRefreshDialog] = useState(false);
  const [isRefreshLoading, setIsRefreshLoading] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [refreshMessage, setRefreshMessage] = useState('');
  const [refreshAbortController, setRefreshAbortController] = useState(null);
  
  const scrollViewRef = useRef(null);
  const trainCardRefs = useRef({});

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
      title: 'Seat Availability Results',
    });
  }, [navigation]);

  // Auto-expand first train if there's only one
  useEffect(() => {
    if (availabilityData && Object.keys(availabilityData).length === 1) {
      const firstTripNumber = Object.keys(availabilityData)[0];
      setExpandedTrains({ [firstTripNumber]: true });
    }
  }, [availabilityData]);

  const toggleTrainExpansion = (tripNumber) => {
    setExpandedTrains(prev => {
      const isCurrentlyExpanded = prev[tripNumber];
      
      // If clicking on an already expanded train, collapse it
      if (isCurrentlyExpanded) {
        // Also collapse all seat type expansions for this train
        setExpandedSeatTypes(prevSeatTypes => {
          const updatedSeatTypes = { ...prevSeatTypes };
          Object.keys(updatedSeatTypes).forEach(key => {
            if (key.startsWith(`${tripNumber}-`)) {
              delete updatedSeatTypes[key];
            }
          });
          return updatedSeatTypes;
        });
        
        return {
          ...prev,
          [tripNumber]: false
        };
      }
      
      // If clicking on a collapsed train, collapse all others and expand this one
      // Also reset all seat type expansions
      setExpandedSeatTypes({});
      
      // Scroll to the train card after a short delay to allow state update
      setTimeout(() => {
        trainCardRefs.current[tripNumber]?.measureLayout(
          scrollViewRef.current,
          (x, y) => {
            scrollViewRef.current?.scrollTo({ y: y - 10, animated: true });
          },
          () => {}
        );
      }, 100);
      
      return {
        [tripNumber]: true
      };
    });
  };

  const toggleSeatTypeExpansion = (tripNumber, seatType) => {
    const key = `${tripNumber}-${seatType}`;
    setExpandedSeatTypes(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleBuyTickets = () => {
    const url = `https://eticket.railway.gov.bd/booking/train/search?fromcity=${encodeURIComponent(origin)}&tocity=${encodeURIComponent(destination)}&doj=${encodeURIComponent(date)}&class=${seatClass}`;
    Linking.openURL(url).catch(err => {
      setErrorMessage('Could not open Bangladesh Railway booking website');
      setShowErrorDialog(true);
    });
  };

  // Handle pull to refresh - show confirmation dialog
  const onRefresh = () => {
    setRefreshing(true);
    // Show dialog to confirm refresh
    setShowRefreshDialog(true);
  };

  // Handle refresh confirmation - recheck seat availability
  const handleRefreshConfirm = async () => {
    setShowRefreshDialog(false);
    setIsRefreshLoading(true);
    setRefreshProgress(0);
    setRefreshMessage('Starting...');

    // Create abort controller for cancellation
    const controller = new AbortController();
    setRefreshAbortController(controller);

    try {
      console.log('Refreshing seat availability with same parameters:', { 
        origin, 
        destination, 
        date, 
        seatClass 
      });

      // Progress callback - matches SeatAvailabilityScreen logic
      const onProgress = (message, progress) => {
        console.log('Refresh Progress:', message, progress + '%');
        setRefreshMessage(message);
        setRefreshProgress(progress / 100);
      };

      // Import checkSeatAvailability
      const { checkSeatAvailability } = require('../utils/railwayAPI');
      
      // Recheck seat availability with same parameters
      const newAvailabilityData = await checkSeatAvailability(
        origin, 
        destination, 
        date, 
        seatClass,
        onProgress,
        controller.signal
      );

      setRefreshProgress(1.0);
      setRefreshMessage('Complete!');

      setIsRefreshLoading(false);
      setRefreshAbortController(null);
      setRefreshing(false);

      console.log('Seat availability refreshed successfully');

      // Update the route params with new data
      navigation.setParams({ availabilityData: newAvailabilityData });

      // Reset UI states
      setExpandedTrains({});
      setExpandedSeatTypes({});

      // Auto-expand first train if there's only one
      if (newAvailabilityData && Object.keys(newAvailabilityData).length === 1) {
        const firstTripNumber = Object.keys(newAvailabilityData)[0];
        setExpandedTrains({ [firstTripNumber]: true });
      }

    } catch (error) {
      setIsRefreshLoading(false);
      setRefreshAbortController(null);
      setRefreshing(false);
      console.error('Seat availability refresh error:', error);

      // Handle cancellation
      if (error.name === 'AbortError' || error.message.includes('canceled') || error.message.includes('aborted')) {
        console.log('Refresh was cancelled by user');
        return;
      }

      // Show error dialog
      let errorMsg = error.message || 'Failed to refresh seat availability. Please try again.';
      let shouldGoBack = false;
      
      // Check if this is an error that requires going back to search
      if (errorMsg.includes('At this moment, no trains are found') ||
          errorMsg.includes('Ticket purchasing for the selected criteria is not yet available') ||
          errorMsg.includes('Your purchase process for some tickets is ongoing') ||
          errorMsg.includes('You already have an active reservation process') ||
          errorMsg.includes('maximum order limit for all trains') ||
          errorMsg.includes('An error occurred while fetching seat details') ||
          errorMsg.includes('Authentication failed') || 
          errorMsg.includes('Mobile Number or Password is incorrect') ||
          errorMsg.includes('Railway account credentials not found')) {
        shouldGoBack = true;
      }
      
      // Handle specific errors
      if (errorMsg.includes('Authentication failed') || errorMsg.includes('Mobile Number or Password is incorrect')) {
        errorMsg = 'Authentication failed. Please check your auth token and device key in Settings.';
      } else if (errorMsg.includes('Railway account credentials not found')) {
        errorMsg = 'Railway account credentials not found. Please add your credentials in Settings.';
      }

      setErrorMessage(errorMsg);
      setShouldNavigateBackOnError(shouldGoBack);
      setShowErrorDialog(true);
    }
  };

  // Handle refresh cancellation
  const handleRefreshCancel = () => {
    setShowRefreshDialog(false);
    setRefreshing(false);
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

  // Handle error dialog dismiss - navigate back if needed
  const handleErrorDialogDismiss = () => {
    setShowErrorDialog(false);
    if (shouldNavigateBackOnError) {
      setShouldNavigateBackOnError(false);
      navigation.navigate('SeatAvailability');
    }
  };

  const renderSeatTypeSection = (tripNumber, seatTypeData) => {
    const { type, available_count, booking_process_count, grouped_seats, grouped_booking_process, ticket_types, is_422, error_message } = seatTypeData;
    const key = `${tripNumber}-${type}`;
    const isExpanded = expandedSeatTypes[key];
    
    // Check if all seats are booked
    const allSeatsBooked = available_count === 0 && booking_process_count === 0;
    const issuedCount = ticket_types?.issued_total?.count || 0;

    // Skip rendering individual seat types with 422 errors (matches Python results.html line 95: {% if not seat_type['is_422'] %})
    // Individual 422 errors are only shown at train level when all_seats_422 is true
    if (is_422) {
      return null;
    }

    return (
      <View key={type} style={styles.seatTypeSection}>
        <View style={styles.seatTypeHeader}>
          <View style={styles.seatTypeHeaderLeft}>
            <View style={styles.iconContainer}>
              <Icon source="seat" size={20} color="#006747" />
            </View>
            <Text style={styles.seatTypeTitle}>Seat Type: {type}</Text>
          </View>
        </View>

        {/* Issued Tickets Section */}
        {ticket_types && issuedCount > 0 && (
          <View style={styles.issuedTicketsSection}>
            <TouchableOpacity
              style={styles.collapsibleToggle}
              onPress={() => toggleSeatTypeExpansion(tripNumber, type)}
              activeOpacity={0.7}
            >
              <Icon 
                source={isExpanded ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#006747" 
              />
              <Text style={styles.collapsibleToggleText}>
                {isExpanded ? 'Collapse' : 'Expand'} to view Issued Ticket List
              </Text>
            </TouchableOpacity>

            {isExpanded && (
              <View style={styles.collapsibleContent}>
                <View style={styles.issuedCountBadge}>
                  <Icon source="ticket-confirmation" size={18} color="#006747" />
                  <Text style={styles.issuedCountText}>
                    {issuedCount} Ticket{issuedCount !== 1 ? 's' : ''} Issued for Purchase
                  </Text>
                </View>

                <DataTable style={styles.dataTable}>
                <DataTable.Header style={styles.tableHeader}>
                  <DataTable.Title style={styles.tableHeaderCellCoach} numberOfLines={3}>
                    <Text style={styles.tableHeaderText}>Ticket Category</Text>
                  </DataTable.Title>
                  <DataTable.Title style={styles.tableHeaderCellCoach} numberOfLines={3}>
                    <Text style={styles.tableHeaderText}>Coach (Count)</Text>
                  </DataTable.Title>
                  <DataTable.Title style={styles.tableHeaderCellWide} numberOfLines={3}>
                    <Text style={styles.tableHeaderText}>Seat Numbers</Text>
                  </DataTable.Title>
                </DataTable.Header>                  {/* Issued Combined Tickets */}
                  {ticket_types.issued_combined && Object.entries(ticket_types.issued_combined.grouped).map(([coach, group]) => (
                    <DataTable.Row key={`issued-${coach}`} style={styles.tableRow}>
                      <DataTable.Cell style={styles.tableCellCoach} numeric={false}>
                        <Text style={styles.tableCellText}>{ticket_types.issued_combined.label}</Text>
                      </DataTable.Cell>
                      <DataTable.Cell style={styles.tableCellCoach} numeric={false}>
                        <Text style={styles.tableCellText}>
                          {coach} ({group.count} {group.count === 1 ? 'ticket' : 'tickets'})
                        </Text>
                      </DataTable.Cell>
                      <DataTable.Cell style={styles.tableCellWide} numeric={false}>
                        <Text style={styles.tableCellTextCenter}>{group.seats.join(', ')}</Text>
                      </DataTable.Cell>
                    </DataTable.Row>
                  ))}

                    {/* Other Ticket Types */}
                    {seatTypeData.grouped_ticket_types && Object.entries(seatTypeData.grouped_ticket_types).map(([typeId, typeGroups]) => {
                      const ticketTypeInfo = ticket_types[typeId];
                      if (!ticketTypeInfo || ![2, 4].includes(parseInt(typeId))) return null;
                      
                      return Object.entries(typeGroups).map(([coach, group]) => (
                        <DataTable.Row key={`type-${typeId}-${coach}`} style={styles.tableRow}>
                          <DataTable.Cell style={styles.tableCellCoach} numeric={false}>
                            <Text style={styles.tableCellText}>{ticketTypeInfo.label}</Text>
                          </DataTable.Cell>
                          <DataTable.Cell style={styles.tableCellCoach} numeric={false}>
                            <Text style={styles.tableCellText}>
                              {coach} ({group.count} {group.count === 1 ? 'ticket' : 'tickets'})
                            </Text>
                          </DataTable.Cell>
                          <DataTable.Cell style={styles.tableCellWide} numeric={false}>
                            <Text style={styles.tableCellTextCenter}>{group.seats.join(', ')}</Text>
                          </DataTable.Cell>
                        </DataTable.Row>
                      ));
                    })}
                  </DataTable>
              </View>
            )}
          </View>
        )}

        {/* No Seats Available Message */}
        {allSeatsBooked ? (
          <View style={styles.noSeatsContainer}>
            <Text style={styles.noSeatsText}>
              {issuedCount > 0 
                ? `All seats have been booked for seat type ${type}`
                : `No seats were issued for seat type ${type}`
              }
            </Text>
          </View>
        ) : (
          <View>
            {/* Availability Status */}
            <View style={styles.statusRow}>
              <Chip 
                icon="check-circle" 
                style={styles.availableChip}
                textStyle={styles.chipText}
              >
                Available: {available_count} {available_count === 1 ? 'ticket' : 'tickets'}
              </Chip>
              <Chip 
                icon={({ size, color }) => <Icon source="clock" size={size} color="#E09B00" />}
                style={styles.bookingChip}
                textStyle={styles.chipText}
              >
                In Booking: {booking_process_count} {booking_process_count === 1 ? 'ticket' : 'tickets'}
              </Chip>
            </View>

            {/* Available and Booking Seats Table */}
            <DataTable style={styles.dataTable}>
              <DataTable.Header style={styles.tableHeader}>
                <DataTable.Title style={styles.tableHeaderCellStatus} numberOfLines={3}>
                  <Text style={styles.tableHeaderText}>Status</Text>
                </DataTable.Title>
                <DataTable.Title style={styles.tableHeaderCellCoach} numberOfLines={3}>
                  <Text style={styles.tableHeaderText}>Coach (Count)</Text>
                </DataTable.Title>
                <DataTable.Title style={styles.tableHeaderCellWide} numberOfLines={3}>
                  <Text style={styles.tableHeaderText}>Seat Numbers</Text>
                </DataTable.Title>
              </DataTable.Header>

                {/* Available Seats */}
                {grouped_seats && Object.entries(grouped_seats).map(([coach, group]) => (
                  <DataTable.Row key={`available-${coach}`} style={styles.tableRow}>
                    <DataTable.Cell style={styles.tableCellStatus} numeric={false}>
                      <View style={styles.statusBadge}>
                        <Icon source="check-circle" size={10} color="#006747" style={styles.statusBadgeIcon} />
                        <Text style={styles.statusBadgeText}>Available</Text>
                      </View>
                    </DataTable.Cell>
                    <DataTable.Cell style={styles.tableCellCoach} numeric={false}>
                      <Text style={styles.tableCellText}>
                        {coach} ({group.count} {group.count === 1 ? 'ticket' : 'tickets'})
                      </Text>
                    </DataTable.Cell>
                    <DataTable.Cell style={styles.tableCellWide} numeric={false}>
                      <Text style={styles.tableCellTextCenter}>{group.seats.join(', ')}</Text>
                    </DataTable.Cell>
                  </DataTable.Row>
                ))}

                {/* Booking Process Seats */}
                {grouped_booking_process && Object.entries(grouped_booking_process).map(([coach, group]) => (
                  <DataTable.Row key={`booking-${coach}`} style={styles.tableRow}>
                    <DataTable.Cell style={styles.tableCellStatus} numeric={false}>
                      <View style={styles.statusBadgeBooking}>
                        <Icon source="clock" size={10} color="#E09B00" style={styles.statusBadgeIcon} />
                        <Text style={styles.statusBadgeText}>In Booking</Text>
                      </View>
                    </DataTable.Cell>
                    <DataTable.Cell style={styles.tableCellCoach} numeric={false}>
                      <Text style={styles.tableCellText}>
                        {coach} ({group.count} {group.count === 1 ? 'ticket' : 'tickets'})
                      </Text>
                    </DataTable.Cell>
                    <DataTable.Cell style={styles.tableCellWide} numeric={false}>
                      <Text style={styles.tableCellTextCenter}>{group.seats.join(', ')}</Text>
                    </DataTable.Cell>
                  </DataTable.Row>
                ))}
              </DataTable>
          </View>
        )}
      </View>
    );
  };

  const renderTrainCard = (tripNumber, trainDetails) => {
    const isExpanded = expandedTrains[tripNumber];
    const hasMultipleTrains = Object.keys(availabilityData).length > 1;

    return (
      <View 
        key={tripNumber} 
        ref={(ref) => trainCardRefs.current[tripNumber] = ref}
        collapsable={false}
      >
        <Card style={styles.trainCard}>
        <Card.Content style={styles.trainCardContent}>
          {/* Train Header */}
          <View style={styles.trainHeader}>
            <View style={styles.trainTitleRow}>
              <View style={styles.iconContainer}>
                <Icon source="train" size={20} color="#006747" />
              </View>
              <Text style={styles.trainTitle}>{tripNumber}</Text>
            </View>
          </View>

          {/* Journey Timeline */}
          <View style={styles.journeyTimeline}>
            <View style={styles.journeyPointDeparture}>
              <Text style={styles.journeyLabel}>Departure</Text>
              <Text style={styles.cityName}>{trainDetails.from_station}</Text>
              <Text style={styles.timeInfo}>{trainDetails.departure_time}</Text>
            </View>

            <View style={styles.journeyConnector}>
              <View style={styles.journeyLine}>
                <View style={styles.journeyLineDot} />
              </View>
              <Text style={styles.journeyDuration}>{trainDetails.journey_duration}</Text>
            </View>

            <View style={styles.journeyPointArrival}>
              <Text style={styles.journeyLabel}>Arrival</Text>
              <Text style={styles.cityName}>{trainDetails.to_station}</Text>
              <Text style={styles.timeInfo}>{trainDetails.arrival_time}</Text>
            </View>
          </View>

          {/* Train Details Section */}
          <View style={styles.trainDetailsSection}>
            {hasMultipleTrains && (
              <TouchableOpacity
                style={styles.expandButton}
                onPress={() => toggleTrainExpansion(tripNumber)}
                activeOpacity={0.7}
              >
                <Icon 
                  source={isExpanded ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color="#006747" 
                />
                <Text style={styles.expandButtonText}>
                  {isExpanded ? 'HIDE' : 'VIEW'} SEAT DETAILS
                </Text>
              </TouchableOpacity>
            )}

            {(isExpanded || !hasMultipleTrains) && (
              <View style={styles.seatDetailsContainer}>
                {trainDetails.all_seats_422 ? (
                  <View style={styles.errorBadge}>
                    <Text style={styles.errorBadgeText}>
                      {trainDetails.seat_data[0]?.error_message || 'Error fetching seat information'}
                    </Text>
                  </View>
                ) : (
                  trainDetails.seat_data.map(seatTypeData => 
                    renderSeatTypeSection(tripNumber, seatTypeData)
                  )
                )}
              </View>
            )}
          </View>
        </Card.Content>
      </Card>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
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
          />
        }
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.noteContainer}>
            <Text style={styles.noteText}>
              <Text style={styles.noteBold}>Note: </Text>
              Seat availability info may change frequently as this app does not dynamically fetch the seat data in real time. 
              To get the latest info, please perform a new search. Also, the issued tickets and the reserved tickets info may not be fully accurate.
            </Text>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.buyButton}
              onPress={handleBuyTickets}
              activeOpacity={0.7}
            >
              <View style={styles.buyButtonContent}>
                <Icon source="web" size={20} color="#FFFFFF" />
                <Text style={styles.buyButtonLabel} numberOfLines={2}>
                  Visit Official Website for This Search
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Train Cards */}
        {availabilityData && Object.entries(availabilityData).map(([tripNumber, trainDetails]) => 
          renderTrainCard(tripNumber, trainDetails)
        )}
      </ScrollView>

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
            Update Seat Availability?
          </Dialog.Title>
          <Dialog.Content style={styles.refreshDialogContent}>
            <Text style={styles.refreshDialogText}>
              Do you want to update the seat availability with the same information?
            </Text>
            <Surface style={styles.refreshInfoCard} elevation={0}>
              <View style={styles.refreshInfoRow}>
                <Icon source="train" size={16} color="#006747" />
                <Text style={styles.refreshInfoText}>{origin} → {destination}</Text>
              </View>
              <View style={styles.refreshInfoRow}>
                <Icon source="calendar" size={16} color="#006747" />
                <Text style={styles.refreshInfoText}>{date}</Text>
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
              <Text style={styles.loadingTitle}>Updating Seat Availability...</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 24,
  },
  
  // Header Section
  headerSection: {
    marginBottom: 12,
  },
  buttonRow: {
    marginBottom: 10,
  },
  backButton: {
    flex: 1,
    borderColor: '#006747',
    borderWidth: 2,
    borderRadius: 12,
    minHeight: 44, // Better touch target
  },
  backButtonLabel: {
    color: '#006747',
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 13,
    paddingVertical: 2,
  },
  buyButton: {
    flex: 1,
    backgroundColor: '#006747',
    borderRadius: 12,
    minHeight: 44, // Better touch target
    justifyContent: 'center',
    alignItems: 'center',
  },
  buyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  buyButtonLabel: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 13,
    marginLeft: 8,
    textAlign: 'center',
  },
  noteContainer: {
    flexDirection: 'row',
    backgroundColor: '#E6F4EA',
    padding: 10,
    borderRadius: 12,
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  noteText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#1C1B1F',
    lineHeight: 16,
    textAlign: 'justify',
  },
  noteBold: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
  },

  // Train Card
  trainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 12,
  },
  trainCardContent: {
    padding: 12,
  },
  trainHeader: {
    marginBottom: 20,
  },
  trainTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 103, 71, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    alignSelf: 'center',
  },
  iconContainer: {
    marginRight: 6,
    alignSelf: 'flex-end',
  },
  trainTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
    flexWrap: 'wrap',
  },
  trainIcon: {
    marginRight: 12,
    alignSelf: 'center',
  },

  // Journey Timeline
  journeyTimeline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fffe',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0f2e0',
    shadowColor: '#006747',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 12,
  },
  journeyPoint: {
    flex: 0,
    alignItems: 'center',
  },
  journeyPointDeparture: {
    flex: 0,
    alignItems: 'flex-end',
    paddingRight: 5,
  },
  journeyPointArrival: {
    flex: 0,
    alignItems: 'flex-start',
    paddingLeft: 5,
  },
  journeyLabel: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 3,
    letterSpacing: 0.5,
  },
  cityName: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
    marginBottom: 4,
  },
  timeInfo: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#5a6c57',
  },
  journeyConnector: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginHorizontal: 10,
  },
  journeyLine: {
    width: '100%',
    height: 1,
    backgroundColor: '#006747',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyLineDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    backgroundColor: '#006747',
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#f8fffe',
    top: '50%',
    left: '50%',
    marginLeft: -4,
    marginTop: -4,
    shadowColor: '#006747',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  journeyDuration: {
    position: 'absolute',
    top: 13,
    fontSize: 9,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#888',
  },

  // Train Details Section
  trainDetailsSection: {
    marginTop: 8,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#d0d7de',
  },
  expandButtonText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  seatDetailsContainer: {
    marginTop: 8,
  },

  // Seat Type Section
  seatTypeSection: {
    marginBottom: 14,
  },
  seatTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  seatTypeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(0, 103, 71, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  seatTypeTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
    flexWrap: 'wrap',
  },
  seatIcon: {
    marginRight: 12,
    alignSelf: 'center',
  },

  // Status Row
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  availableChip: {
    backgroundColor: '#E6F4EA',
    flexShrink: 1,
    height: 32,
  },
  bookingChip: {
    backgroundColor: '#FFF8E1',
    flexShrink: 1,
    height: 32,
  },
  chipText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#1C1B1F',
  },
  availableChipSmall: {
    backgroundColor: '#E6F4EA',
    height: 18,
    marginHorizontal: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    minWidth: 0,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingChipSmall: {
    backgroundColor: '#FFF8E1',
    height: 18,
    marginHorizontal: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    minWidth: 0,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipTextSmall: {
    fontSize: 8,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#1C1B1F',
    lineHeight: 8,
    marginVertical: 0,
    marginHorizontal: 0,
    textAlign: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },

  // Custom Status Badges
  statusBadge: {
    backgroundColor: '#E6F4EA',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  statusBadgeBooking: {
    backgroundColor: '#FFF8E1',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  statusBadgeText: {
    fontSize: 8,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#1C1B1F',
    textAlign: 'center',
    marginLeft: 2,
  },
  statusBadgeIcon: {
    marginRight: 0,
  },

  // Issued Tickets Section
  issuedTicketsSection: {
    marginBottom: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E0B000',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#FFFEF5',
    justifyContent: 'center',
  },
  collapsibleToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0EDDF',
    padding: 12,
    borderRadius: 10,
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#B5D1BE',
  },
  collapsibleToggleText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#006747',
    marginLeft: 8,
    flex: 1,
  },
  collapsibleContent: {
    marginTop: 8,
  },
  issuedCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E6F4EA',
    padding: 10,
    borderRadius: 12,
    marginBottom: 10,
  },
  issuedCountText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
    marginLeft: 8,
    textAlign: 'center',
  },

  // Data Table
  dataTable: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    width: '100%',
  },
  tableHeader: {
    backgroundColor: '#F0F8F5',
    borderBottomWidth: 2,
    borderBottomColor: '#006747',
    minHeight: 48,
  },
  tableHeaderCell: {
    justifyContent: 'center',
    paddingHorizontal: 4,
    flex: 1,
  },
  tableHeaderCellStatus: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
    flex: 0.6,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  tableHeaderCellCoach: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
    flex: 0.7,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  tableHeaderCellNarrow: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
    flex: 0.7,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  tableHeaderCellWide: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
    flex: 1.4,
  },
  tableHeaderText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
    textAlign: 'center',
    lineHeight: 14,
  },
  tableRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    minHeight: 48,
  },
  tableCell: {
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
    flex: 1,
  },
  tableCellStatus: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 6,
    paddingLeft: 4,
    paddingRight: 4,
    flex: 0.6,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  tableCellCoach: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
    flex: 0.7,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  tableCellNarrow: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 6,
    flex: 0.7,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  tableCellWide: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
    flex: 1.4,
  },
  tableCellText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#1C1B1F',
    flexWrap: 'wrap',
    lineHeight: 13,
    textAlign: 'center',
  },
  tableCellTextCenter: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#1C1B1F',
    flexWrap: 'wrap',
    lineHeight: 13,
    textAlign: 'center',
  },

  // Error & No Seats
  errorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDECEA',
    padding: 10,
    borderRadius: 12,
  },
  errorBadgeText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#B3261E',
    lineHeight: 16,
  },
  noSeatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8E1',
    padding: 10,
    borderRadius: 12,
  },
  noSeatsText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#92400E',
    lineHeight: 16,
    textAlign: 'center',
  },

  // Error Dialog
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
  
  // Loading Dialog Styles (Material Design 3)
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
});
