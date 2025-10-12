import { 
  StyleSheet, 
  View, 
  ScrollView,
  Alert,
  StatusBar,
  TouchableWithoutFeedback,
  Keyboard,
  Linking,
} from 'react-native';
import { useState, useEffect } from 'react';
import { RailwayAccountStorage } from '../utils/storage';
import { verifyCredentials as verifyCredentialsAPI } from '../utils/railwayAPI';
import { 
  Card, 
  Text, 
  IconButton,
  useTheme,
  Surface,
  TextInput,
  Button,
  Portal,
  Dialog,
  Icon,
  ActivityIndicator
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import React from 'react';
import * as ScreenCapture from 'expo-screen-capture';

export default function RailwayAccountScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  
  // Railway Credentials states
  const [authToken, setAuthToken] = useState('');
  const [deviceKey, setDeviceKey] = useState('');
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [dialogMessage, setDialogMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [verificationResult, setVerificationResult] = useState({ success: false, message: '' });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savedAuthToken, setSavedAuthToken] = useState('');
  const [savedDeviceKey, setSavedDeviceKey] = useState('');
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  // Load saved railway credentials on component mount
  useEffect(() => {
    loadRailwayAccountData();
  }, []);

  // Prevent navigation if there are unsaved changes
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!hasUnsavedChanges) {
        // If we don't have unsaved changes, let the user leave
        return;
      }

      // Prevent default behavior of leaving the screen
      e.preventDefault();

      // Store the navigation event for later
      setPendingNavigation(e.data.action);
      
      // Show confirmation dialog
      setShowUnsavedDialog(true);
    });

    return unsubscribe;
  }, [navigation, hasUnsavedChanges]);

  // Prevent screenshots and screen recording when this screen is focused
  useFocusEffect(
    useCallback(() => {
      // Enable screenshot prevention when screen is focused
      const preventScreenCapture = async () => {
        try {
          await ScreenCapture.preventScreenCaptureAsync();
        } catch (error) {
          console.log('Screenshot prevention not supported on this device');
        }
      };
      
      preventScreenCapture();
      
      return () => {
        // Allow screenshot capture when leaving screen
        const allowScreenCapture = async () => {
          try {
            await ScreenCapture.allowScreenCaptureAsync();
          } catch (error) {
            console.log('Screenshot prevention not supported on this device');
          }
        };
        
        allowScreenCapture();
      };
    }, [])
  );

  const handleAuthTokenChange = (text) => {
    setAuthToken(text);
    // Check for unsaved changes
    setHasUnsavedChanges(text !== savedAuthToken || deviceKey !== savedDeviceKey);
  };

  const handleDeviceKeyChange = (text) => {
    setDeviceKey(text);
    // Check for unsaved changes
    setHasUnsavedChanges(authToken !== savedAuthToken || text !== savedDeviceKey);
  };

  const loadRailwayAccountData = async () => {
    try {
      const credentials = await RailwayAccountStorage.getCredentials();
      if (credentials.authToken) {
        setAuthToken(credentials.authToken);
        setSavedAuthToken(credentials.authToken);
      }
      if (credentials.deviceKey) {
        setDeviceKey(credentials.deviceKey);
        setSavedDeviceKey(credentials.deviceKey);
      }
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error loading railway credentials:', error);
    }
  };

  const saveRailwayAccountData = async () => {
    // Dismiss keyboard when save button is pressed
    Keyboard.dismiss();
    
    try {
      if (authToken.trim() === '' || deviceKey.trim() === '') {
        setDialogMessage('Please enter both Auth Token and Device Key');
        setShowErrorDialog(true);
        return false;
      }

      const success = await RailwayAccountStorage.saveCredentials(authToken, deviceKey);
      
      if (success) {
        // Small delay to ensure all async storage operations complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Update saved state variables immediately
        setSavedAuthToken(authToken);
        setSavedDeviceKey(deviceKey);
        setHasUnsavedChanges(false);
        setDialogMessage('Railway credentials saved successfully!');
        setShowSuccessDialog(true);
        return true;
      } else {
        setDialogMessage('Failed to save railway credentials');
        setShowErrorDialog(true);
        return false;
      }
    } catch (error) {
      console.error('Error saving railway credentials:', error);
      setDialogMessage('Failed to save railway credentials');
      setShowErrorDialog(true);
      return false;
    }
  };

  const clearRailwayAccountData = async () => {
    // Dismiss keyboard when clear button is pressed
    Keyboard.dismiss();
    
    try {
      const success = await RailwayAccountStorage.clearCredentials();
      if (success) {
        setAuthToken('');
        setDeviceKey('');
        setSavedAuthToken('');
        setSavedDeviceKey('');
        setHasUnsavedChanges(false);
        setDialogMessage('Railway credentials cleared successfully');
        setShowSuccessDialog(true);
      } else {
        setDialogMessage('Failed to clear railway credentials');
        setShowErrorDialog(true);
      }
    } catch (error) {
      console.error('Error clearing railway credentials:', error);
      setDialogMessage('Failed to clear railway credentials');
      setShowErrorDialog(true);
    }
  };

  const verifyCredentials = async () => {
    // Dismiss keyboard when verify button is pressed
    Keyboard.dismiss();
    
    // Validate inputs first
    if (!authToken || !deviceKey) {
      setVerificationResult({
        success: false,
        message: 'Please enter both Auth Token and Device Key before verifying.'
      });
      setShowVerificationDialog(true);
      return;
    }

    // Check if tokens are not empty after trim
    if (authToken.trim() === '' || deviceKey.trim() === '') {
      setVerificationResult({
        success: false,
        message: 'Auth Token and Device Key cannot be empty.'
      });
      setShowVerificationDialog(true);
      return;
    }

    setIsVerifying(true);

    try {
      const result = await verifyCredentialsAPI(authToken, deviceKey);
      
      setVerificationResult({
        success: true,
        message: 'Credentials verified successfully! Your Bangladesh Railway credentials are correctly configured.'
      });
    } catch (error) {
      let errorMessage = 'Verification failed. ';
      
      if (error.message === 'AUTH_TOKEN_EXPIRED') {
        errorMessage = 'Auth Token has expired or is invalid (valid for 24 hours). Please update your credentials with a new token and device key.';
      } else if (error.message === 'AUTH_DEVICE_KEY_EXPIRED') {
        errorMessage = 'Device Key has expired or is invalid. Please update your credentials with a new token and device key.';
      } else if (error.message.includes('Network') || error.message.includes('connection')) {
        errorMessage = 'Unable to connect to Bangladesh Railway servers. Please check your internet connection and try again.';
      } else {
        errorMessage += error.message || 'Unable to verify your credentials. Please check your Auth Token and Device Key, then try again.';
      }
      
      setVerificationResult({
        success: false,
        message: errorMessage
      });
    } finally {
      setIsVerifying(false);
      setShowVerificationDialog(true);
    }
  };

  const showClearConfirmation = () => {
    // Dismiss keyboard when clear button is pressed
    Keyboard.dismiss();
    setShowClearDialog(true);
  };

  const handleInstructionLink = async () => {
    const url = 'https://raw.githubusercontent.com/nishatrhythm/Train-Seat-App-Releases/main/mobile_instruction.png';
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Error', 'An error occurred while trying to open the instruction image');
    }
  };

  return (
    <View style={styles.container}>
      {/* Status Bar */}
      <StatusBar backgroundColor="#006747" barStyle="light-content" />
      
      <ScrollView 
        style={styles.scrollContainer} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.fullContainer}>
            <View style={styles.contentContainer}>
              
              {/* Railway Credentials Settings */}
              <Card style={styles.accountCard} elevation={4}>
                <Card.Content style={styles.accountContent}>
                  
                  {/* Card Header */}
                  <View style={styles.cardHeader}>
                    <View style={styles.titleContainer}>
                      <Text variant="headlineSmall" style={styles.cardTitle}>
                        Railway Credentials
                      </Text>
                    </View>
                  </View>
                  
                  {/* Instruction Link */}
                  <View style={styles.instructionContainer}>
                    <Text style={styles.instructionText}>
                      Don't know how to get your credentials?
                    </Text>
                    <Text 
                      style={styles.instructionLink}
                      onPress={handleInstructionLink}
                    >
                      See instructions here
                    </Text>
                  </View>
                  
                  {/* Auth Token Input */}
                  <View style={styles.inputContainer}>
                    <Text variant="titleSmall" style={styles.inputLabel}>
                      Auth Token
                    </Text>
                    <TextInput
                      mode="outlined"
                      value={authToken}
                      onChangeText={handleAuthTokenChange}
                      placeholder="Enter your auth token"
                      left={<TextInput.Icon icon="key" iconColor="#006747" />}
                      right={
                        authToken ? (
                          <TextInput.Icon 
                            icon="close-circle" 
                            iconColor="#666"
                            onPress={() => {
                              setAuthToken('');
                              setHasUnsavedChanges('' !== savedAuthToken || deviceKey !== savedDeviceKey);
                            }} 
                          />
                        ) : null
                      }
                      style={styles.input}
                      contentStyle={styles.inputContent}
                      outlineColor="#006747"
                      activeOutlineColor="#006747"
                      outlineStyle={styles.inputOutline}
                      multiline={false}
                      enablesReturnKeyAutomatically={true}
                    />
                  </View>
                  
                  {/* Device Key Input */}
                  <View style={styles.inputContainer}>
                    <Text variant="titleSmall" style={styles.inputLabel}>
                      Device Key
                    </Text>
                    <TextInput
                      mode="outlined"
                      value={deviceKey}
                      onChangeText={handleDeviceKeyChange}
                      placeholder="Enter your device key"
                      left={<TextInput.Icon icon="shield-key" iconColor="#006747" />}
                      right={
                        deviceKey ? (
                          <TextInput.Icon 
                            icon="close-circle" 
                            iconColor="#666"
                            onPress={() => {
                              setDeviceKey('');
                              setHasUnsavedChanges(authToken !== savedAuthToken || '' !== savedDeviceKey);
                            }} 
                          />
                        ) : null
                      }
                      style={styles.input}
                      contentStyle={styles.inputContent}
                      outlineColor="#006747"
                      activeOutlineColor="#006747"
                      outlineStyle={styles.inputOutline}
                      multiline={false}
                      enablesReturnKeyAutomatically={true}
                    />
                  </View>
                  
                  {/* Action Buttons */}
                  <View style={styles.buttonContainer}>
                    <Button 
                      mode="contained" 
                      onPress={saveRailwayAccountData}
                      style={styles.saveButton}
                      contentStyle={styles.saveButtonContent}
                      icon="content-save"
                      labelStyle={styles.saveButtonLabel}
                    >
                      Save Account Info
                    </Button>
                    
                    <Button 
                      mode="outlined" 
                      onPress={verifyCredentials}
                      style={styles.verifyButton}
                      contentStyle={styles.verifyButtonContent}
                      icon={isVerifying ? undefined : "shield-check"}
                      labelStyle={styles.verifyButtonLabel}
                      disabled={isVerifying}
                    >
                      {isVerifying ? (
                        <View style={styles.verifyingContainer}>
                          <ActivityIndicator size="small" color="#1976D2" />
                          <Text style={styles.verifyingText}>Verifying...</Text>
                        </View>
                      ) : (
                        'Verify Credentials'
                      )}
                    </Button>
                    
                    <Button 
                      mode="outlined" 
                      onPress={showClearConfirmation}
                      style={styles.clearButton}
                      contentStyle={styles.clearButtonContent}
                      textColor="#B3261E"
                      icon="delete"
                      labelStyle={styles.clearButtonLabel}
                    >
                      Clear
                    </Button>
                  </View>
                  
                </Card.Content>
              </Card>

              {/* Important Notice Card */}
              <Card style={styles.noticeCard} elevation={2}>
                <Card.Content style={styles.noticeContent}>
                  <View style={styles.noticeHeader}>
                    <Icon source="information" size={24} color="#006747" />
                    <Text variant="titleMedium" style={styles.noticeTitle}>
                      Why Railway Credentials are Needed
                    </Text>
                  </View>
                  
                  <View style={styles.noticeTextContainer}>
                    <Text style={styles.noticeText}>
                      To search for train tickets on the official e-ticket website or Rail Sheba app, you need to be logged in with your railway account. This is because the railway system checks if you're a registered user before showing any information. Without proper login details, the app can't access the official data.
                    </Text>

                    <Text style={styles.noticeText}>
                      Recently, Bangladesh Railway added extra security with Cloudflare verification for logins. Because of this change, we can't automatically get your Auth Token and Device Key from just your phone number and password. You'll need to get these codes yourself from the official website, then enter them here manually.
                    </Text>
                  </View>
                </Card.Content>
              </Card>

            </View>
          </View>
        </TouchableWithoutFeedback>
      </ScrollView>

      {/* Clear Confirmation Dialog */}
      <Portal>
        <Dialog
          visible={showClearDialog}
          onDismiss={() => setShowClearDialog(false)}
          style={styles.confirmDialog}
        >
          <Dialog.Content style={styles.confirmDialogContent}>
            <View style={styles.confirmDialogHeader}>
              <Icon source="alert-circle" size={24} color="#B3261E" />
              <Dialog.Title style={styles.confirmDialogTitle}>Clear Credentials</Dialog.Title>
            </View>
            <Text style={styles.confirmDialogText}>
              Are you sure you want to clear the saved railway credentials?
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.confirmDialogActions}>
            <Button
              onPress={() => setShowClearDialog(false)}
              style={styles.dialogButton}
              labelStyle={styles.dialogButtonLabel}
              textColor="#006747"
            >
              Cancel
            </Button>
            <Button
              onPress={() => {
                setShowClearDialog(false);
                clearRailwayAccountData();
              }}
              style={styles.dialogButton}
              labelStyle={styles.dialogButtonLabel}
              textColor="#B3261E"
            >
              Clear
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Success Dialog */}
      <Portal>
        <Dialog
          visible={showSuccessDialog}
          onDismiss={() => setShowSuccessDialog(false)}
          style={styles.successDialog}
        >
          <Dialog.Content style={styles.successDialogContent}>
            <View style={styles.successDialogHeader}>
              <Icon source="check-circle" size={24} color="#006747" />
              <Dialog.Title style={styles.successDialogTitle}>Success</Dialog.Title>
            </View>
            <Text style={styles.successDialogText}>{dialogMessage}</Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.successDialogActions}>
            <Button
              onPress={() => setShowSuccessDialog(false)}
              style={styles.dialogButton}
              labelStyle={styles.dialogButtonLabel}
              textColor="#006747"
            >
              OK
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
            <Text style={styles.errorDialogText}>{dialogMessage}</Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.errorDialogActions}>
            <Button
              onPress={() => setShowErrorDialog(false)}
              style={styles.dialogButton}
              labelStyle={styles.dialogButtonLabel}
              textColor="#B3261E"
            >
              OK
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Verification Result Dialog */}
      <Portal>
        <Dialog
          visible={showVerificationDialog}
          onDismiss={() => setShowVerificationDialog(false)}
          style={verificationResult.success ? styles.successDialog : styles.errorDialog}
        >
          <Dialog.Content style={verificationResult.success ? styles.successDialogContent : styles.errorDialogContent}>
            <View style={verificationResult.success ? styles.successDialogHeader : styles.errorDialogHeader}>
              <Icon 
                source={verificationResult.success ? "check-circle" : "alert-circle"} 
                size={24} 
                color={verificationResult.success ? "#006747" : "#B3261E"} 
              />
              <Dialog.Title style={verificationResult.success ? styles.successDialogTitle : styles.errorDialogTitle}>
                {verificationResult.success ? "Verification Successful" : "Verification Failed"}
              </Dialog.Title>
            </View>
            <Text style={verificationResult.success ? styles.successDialogText : styles.errorDialogText}>
              {verificationResult.message}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={verificationResult.success ? styles.successDialogActions : styles.errorDialogActions}>
            <Button
              onPress={() => setShowVerificationDialog(false)}
              style={styles.dialogButton}
              labelStyle={styles.dialogButtonLabel}
              textColor={verificationResult.success ? "#006747" : "#B3261E"}
            >
              OK
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Unsaved Changes Dialog */}
      <Portal>
        <Dialog
          visible={showUnsavedDialog}
          onDismiss={() => {
            setShowUnsavedDialog(false);
            setPendingNavigation(null);
          }}
          style={styles.errorDialog}
        >
          <Dialog.Content style={styles.errorDialogContent}>
            <View style={styles.errorDialogHeader}>
              <Icon source="alert-circle" size={24} color="#B3261E" />
              <Dialog.Title style={styles.errorDialogTitle}>Unsaved Changes</Dialog.Title>
            </View>
            <Text style={styles.errorDialogText}>
              You have unsaved changes to your railway credentials. Would you like to save them before leaving?
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.errorDialogActions}>
            <Button
              onPress={() => {
                setShowUnsavedDialog(false);
                // Reset changes and allow navigation
                setAuthToken(savedAuthToken);
                setDeviceKey(savedDeviceKey);
                setHasUnsavedChanges(false);
                
                // Execute the pending navigation
                if (pendingNavigation) {
                  navigation.dispatch(pendingNavigation);
                } else {
                  navigation.goBack();
                }
                setPendingNavigation(null);
              }}
              style={styles.dialogButton}
              labelStyle={styles.dialogButtonLabel}
              textColor="#666"
            >
              Don't Save
            </Button>
            <Button
              onPress={async () => {
                // Save first, then handle navigation based on the result
                try {
                  const saveSuccess = await saveRailwayAccountData();
                  
                  // Close the unsaved dialog
                  setShowUnsavedDialog(false);
                  
                  if (saveSuccess) {
                    // Small delay to ensure all async operations complete
                    await new Promise(resolve => setTimeout(resolve, 150));
                    
                    // Navigate after ensuring credentials are properly saved
                    if (pendingNavigation) {
                      navigation.dispatch(pendingNavigation);
                    } else {
                      navigation.goBack();
                    }
                    setPendingNavigation(null);
                  } else {
                    // If save fails, reset pending navigation to keep user on screen
                    setPendingNavigation(null);
                    // Error dialog will be shown by saveRailwayAccountData function
                  }
                } catch (error) {
                  console.error('Failed to save before navigation:', error);
                  setShowUnsavedDialog(false);
                  setPendingNavigation(null);
                  // Show error dialog
                  setDialogMessage('Failed to save railway credentials');
                  setShowErrorDialog(true);
                }
              }}
              style={styles.dialogButton}
              labelStyle={styles.dialogButtonLabel}
              textColor="#006747"
            >
              Save & Exit
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

  // Account Card Styles
  accountCard: {
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
    marginBottom: 24,
  },
  accountContent: {
    padding: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    justifyContent: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    color: '#006747',
    fontFamily: 'PlusJakartaSans-Bold',
  },
  infoButton: {
    margin: 0,
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
  inputOutline: {
    borderRadius: 12,
  },
  errorText: {
    color: '#B3261E',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 12,
    fontFamily: 'PlusJakartaSans-Regular',
  },

  // Button Styles
  buttonContainer: {
    flexDirection: 'column',
    marginTop: 8,
    marginBottom: 20,
  },
  saveButton: {
    marginBottom: 12,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#006747',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  saveButtonContent: {
    paddingVertical: 6,
  },
  saveButtonLabel: {
    fontSize: 16,
    letterSpacing: 0.5,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#FFFFFF',
  },
  clearButton: {
    borderRadius: 16,
    borderColor: '#B3261E',
  },
  clearButtonContent: {
    paddingVertical: 4,
  },
  clearButtonLabel: {
    fontSize: 16,
    letterSpacing: 0.5,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#B3261E',
  },
  verifyButton: {
    marginBottom: 12,
    borderRadius: 16,
    borderColor: '#1976D2',
  },
  verifyButtonContent: {
    paddingVertical: 4,
  },
  verifyButtonLabel: {
    fontSize: 16,
    letterSpacing: 0.5,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#1976D2',
  },
  verifyingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyingText: {
    marginLeft: 8,
    fontSize: 16,
    letterSpacing: 0.5,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#1976D2',
  },

  // Dialog Styles - Success
  successDialog: {
    margin: 24,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    elevation: 6,
  },
  successDialogContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  successDialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  successDialogTitle: {
    color: '#006747',
    fontSize: 24,
    fontWeight: '500',
    fontFamily: 'PlusJakartaSans-SemiBold',
    marginLeft: 12,
    marginTop: 0,
    marginBottom: 0,
  },
  successDialogText: {
    fontSize: 14,
    color: '#49454F',
    fontFamily: 'PlusJakartaSans-Regular',
    lineHeight: 20,
    textAlign: 'left',
  },
  successDialogActions: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  // Dialog Styles - Error
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

  // Dialog Styles - Confirm
  confirmDialog: {
    margin: 24,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    elevation: 6,
  },
  confirmDialogContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  confirmDialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmDialogTitle: {
    color: '#B3261E',
    fontSize: 24,
    fontWeight: '500',
    fontFamily: 'PlusJakartaSans-SemiBold',
    marginLeft: 12,
    marginTop: 0,
    marginBottom: 0,
  },
  unsavedDialogTitle: {
    color: '#FF6B35',
    fontSize: 24,
    fontWeight: '500',
    fontFamily: 'PlusJakartaSans-SemiBold',
    marginLeft: 12,
    marginTop: 0,
    marginBottom: 0,
  },
  confirmDialogText: {
    fontSize: 14,
    color: '#49454F',
    fontFamily: 'PlusJakartaSans-Regular',
    lineHeight: 20,
    textAlign: 'left',
  },
  confirmDialogActions: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  // Common Dialog Button Styles
  dialogButton: {
    borderRadius: 100,
    marginLeft: 8,
  },
  dialogButtonLabel: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'PlusJakartaSans-SemiBold',
    textTransform: 'none',
  },

  // Notice Card Styles
  noticeCard: {
    marginTop: 20,
    marginBottom: 24,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  noticeContent: {
    padding: 20,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  noticeTitle: {
    flex: 1,
    color: '#006747',
    fontSize: 18,
    fontFamily: 'PlusJakartaSans-Bold',
    lineHeight: 24,
  },
  noticeTextContainer: {
    gap: 16,
  },
  noticeText: {
    fontSize: 14,
    color: '#49454F',
    fontFamily: 'PlusJakartaSans-Regular',
    lineHeight: 22,
    textAlign: 'justify',
  },

  // Instruction Link Styles
  instructionContainer: {
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  instructionText: {
    fontSize: 14,
    color: '#49454F',
    fontFamily: 'PlusJakartaSans-Regular',
    lineHeight: 20,
  },
  instructionLink: {
    color: '#006747',
    fontFamily: 'PlusJakartaSans-Bold',
    textDecorationLine: 'underline',
  },
});