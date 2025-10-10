import { 
  StyleSheet, 
  View, 
  ScrollView,
  StatusBar,
  Animated,
} from 'react-native';
import { 
  List,
  Text, 
  useTheme,
  Surface,
  Divider,
  Icon
} from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useRef } from 'react';

export default function SettingsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const highlightAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const animationRef = useRef(null);

  // Check if we should highlight the Account section
  useEffect(() => {
    if (route.params?.highlightAccount) {
      // Reset animation values first
      highlightAnim.setValue(0);
      scaleAnim.setValue(1);
      
      // Start highlight animation with pulsing effect (2 pulses)
      animationRef.current = Animated.parallel([
        // Background color and border animation (non-native)
        Animated.sequence([
          Animated.timing(highlightAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: false,
          }),
          Animated.timing(highlightAnim, {
            toValue: 0,
            duration: 300,
            delay: 1200,
            useNativeDriver: false,
          }),
        ]),
        // Pulsing scale animation (native) - 2 pulses
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.03,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1.03,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ]);
      
      animationRef.current.start(() => {
        // Clear the navigation params after animation completes
        navigation.setParams({ highlightAccount: undefined });
        animationRef.current = null;
      });
    }
    
    // Cleanup function to stop animation if component unmounts
    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
    };
  }, [route.params?.highlightAccount]);

  const accountSectionBackgroundColor = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FFFFFF', '#F0F8F5'],
  });

  const accountSectionBorderColor = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', '#006747'],
  });

  const accountSectionBorderWidth = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 3],
  });

  const accountSectionShadowOpacity = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.18, 0.4],
  });

  const accountSectionElevation = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 6],
  });

  const handleRailwayAccount = () => {
    // Stop animation immediately if it's running
    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
      // Reset animation values to default
      highlightAnim.setValue(0);
      scaleAnim.setValue(1);
      // Clear navigation params
      navigation.setParams({ highlightAccount: undefined });
    }
    navigation.navigate('RailwayAccount');
  };

  const handleAbout = () => {
    navigation.navigate('About');
  };

  const handleTerms = () => {
    navigation.navigate('Terms');
  };

  const handlePrivacyPolicy = () => {
    navigation.navigate('PrivacyPolicy');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar backgroundColor="#006747" barStyle="light-content" />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Settings Section */}
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Animated.View 
            style={[
              styles.section, 
              { 
                backgroundColor: accountSectionBackgroundColor,
                borderColor: accountSectionBorderColor,
                borderWidth: accountSectionBorderWidth,
                shadowOpacity: accountSectionShadowOpacity,
                elevation: accountSectionElevation,
              }
            ]}
          >
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Account
            </Text>
            <List.Item
              title="Railway Credentials"
              description="Manage your Bangladesh Railway credentials"
              left={(props) => (
                <View style={styles.iconContainer}>
                  <List.Icon {...props} icon="account-circle" color="#006747" />
                </View>
              )}
              right={(props) => (
                <View style={styles.iconContainer}>
                  <List.Icon {...props} icon="chevron-right" color="#49454F" />
                </View>
              )}
              onPress={handleRailwayAccount}
              style={styles.listItem}
              titleStyle={styles.listItemTitle}
              descriptionStyle={styles.listItemDescription}
            />
          </Animated.View>
        </Animated.View>

        {/* Legal Section */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Legal
          </Text>
          <List.Item
            title="Terms and Conditions"
            description="Terms of use and service agreement"
            left={(props) => (
              <View style={styles.iconContainer}>
                <List.Icon {...props} icon="file-document" color="#006747" />
              </View>
            )}
            right={(props) => (
              <View style={styles.iconContainer}>
                <List.Icon {...props} icon="chevron-right" color="#49454F" />
              </View>
            )}
            onPress={handleTerms}
            style={styles.listItem}
            titleStyle={styles.listItemTitle}
            descriptionStyle={styles.listItemDescription}
          />
          <Divider style={styles.itemDivider} />
          <List.Item
            title="Privacy Policy"
            description="How we handle your data and privacy"
            left={(props) => (
              <View style={styles.iconContainer}>
                <List.Icon {...props} icon="shield-check" color="#006747" />
              </View>
            )}
            right={(props) => (
              <View style={styles.iconContainer}>
                <List.Icon {...props} icon="chevron-right" color="#49454F" />
              </View>
            )}
            onPress={handlePrivacyPolicy}
            style={styles.listItem}
            titleStyle={styles.listItemTitle}
            descriptionStyle={styles.listItemDescription}
          />
        </Surface>

        {/* General Settings Section */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            General
          </Text>
          <List.Item
            title="About"
            description="App information and version"
            left={(props) => (
              <View style={styles.iconContainer}>
                <List.Icon {...props} icon="information" color="#006747" />
              </View>
            )}
            right={(props) => (
              <View style={styles.iconContainer}>
                <List.Icon {...props} icon="chevron-right" color="#49454F" />
              </View>
            )}
            onPress={handleAbout}
            style={styles.listItem}
            titleStyle={styles.listItemTitle}
            descriptionStyle={styles.listItemDescription}
          />
        </Surface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 0,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
  },
  sectionTitle: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
    backgroundColor: '#F7F9FC',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  itemDivider: {
    marginHorizontal: 16,
    height: 1,
    backgroundColor: '#E6E1E5',
  },
  listItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  listItemTitle: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 16,
    color: '#1C1B1F',
  },
  listItemDescription: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: '#49454F',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 56, // Standard List.Item height
    paddingVertical: 8,
  },
});