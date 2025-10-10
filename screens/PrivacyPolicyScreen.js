import { 
  StyleSheet, 
  View, 
  ScrollView,
  StatusBar,
} from 'react-native';
import { 
  Text, 
  useTheme,
  Surface,
} from 'react-native-paper';

export default function PrivacyPolicyScreen() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar backgroundColor="#006747" barStyle="light-content" />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleLarge" style={styles.mainTitle}>
            Privacy Policy
          </Text>
          <Text variant="bodySmall" style={styles.lastUpdated}>
            Last Updated: October 09, 2025
          </Text>
        </Surface>

        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            1. What We Collect
          </Text>
          <Text variant="bodyMedium" style={styles.sectionContent}>
            <Text style={styles.bold}>What you provide (required for most features):</Text>
          </Text>
          <Text variant="bodyMedium" style={styles.listContent}>
            • Your Bangladesh Railway auth token and device key (stored locally on your device only){'\n'}
            • Train searches, station names, and dates you enter
          </Text>

          <Text variant="bodyMedium" style={styles.sectionContent}>
            <Text style={styles.bold}>What we automatically collect and store:</Text>
          </Text>
          <Text variant="bodyMedium" style={styles.listContent}>
            • Authentication tokens (temporary API access tokens from Bangladesh Railway, stored locally to avoid repeated authentication requests){'\n'}
            • App version (for update checking){'\n'}
            • Basic usage data (which features you use){'\n'}
            • Error logs when something goes wrong
          </Text>

          <Text variant="bodyMedium" style={styles.sectionContent}>
            <Text style={styles.bold}>What we DON'T collect:</Text>
          </Text>
          <Text variant="bodyMedium" style={styles.listContent}>
            • We don't store your railway auth token or device key on any server{'\n'}
            • We don't track your location{'\n'}
            • We don't access your contacts, photos, or files{'\n'}
            • We don't collect payment information{'\n'}
            • We don't collect device information or analytics
          </Text>
        </Surface>

        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            2. How We Use Your Data
          </Text>
          <Text variant="bodyMedium" style={styles.listContent}>
            • <Text style={styles.bold}>Your railway credentials:</Text> Sent directly to Bangladesh Railway servers to check seat availability. Never stored on our servers.{'\n'}
            • <Text style={styles.bold}>Authentication tokens:</Text> Temporarily stored locally to avoid repeated authentication and improve app performance.{'\n'}
            • <Text style={styles.bold}>Search data:</Text> Used to fetch train information from Bangladesh Railway.{'\n'}
            • <Text style={styles.bold}>Usage data:</Text> Helps us improve the app and fix bugs.{'\n'}
            • <Text style={styles.bold}>App updates:</Text> To notify you when new versions are available.
          </Text>
        </Surface>

        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            3. Where Your Data Goes
          </Text>
          <Text variant="bodyMedium" style={styles.sectionContent}>
            <Text style={styles.bold}>Your device (local storage):</Text>
          </Text>
          <Text variant="bodyMedium" style={styles.listContent}>
            • Railway credentials are encrypted and stored only on your phone{'\n'}
            • Authentication tokens are temporarily stored locally to improve performance and avoid repeated authentication
          </Text>

          <Text variant="bodyMedium" style={styles.sectionContent}>
            <Text style={styles.bold}>Bangladesh Railway servers:</Text>
          </Text>
          <Text variant="bodyMedium" style={styles.listContent}>
            • Your credentials and searches are sent directly to Bangladesh Railway's API to get seat information
          </Text>

          <Text variant="bodyMedium" style={styles.sectionContent}>
            <Text style={styles.bold}>Firebase (Google):</Text>
          </Text>
          <Text variant="bodyMedium" style={styles.listContent}>
            • We use Firebase for app updates and to store the list of trains/stations{'\n'}
            • No analytics or tracking data is collected
          </Text>
        </Surface>

        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            4. Data Security
          </Text>
          <Text variant="bodyMedium" style={styles.listContent}>
            • Your credentials are encrypted on your device{'\n'}
            • All connections use HTTPS (secure){'\n'}
            • Screen capture is blocked on the Railway Credentials screen{'\n'}
            • We never see or store your credentials on any server
          </Text>
        </Surface>

        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            5. Your Control
          </Text>
          <Text variant="bodyMedium" style={styles.listContent}>
            • You can delete your saved credentials anytime from Railway Account settings (this also clears stored tokens){'\n'}
            • Uninstalling the app removes all local data including tokens{'\n'}
            • You can use the app without saving credentials{'\n'}
            • However, most features require railway credentials to work
          </Text>
        </Surface>

        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            6. Third-Party Services
          </Text>
          <Text variant="bodyMedium" style={styles.sectionContent}>
            <Text style={styles.bold}>Bangladesh Railway:</Text> Your searches and credentials go to their servers. We're not responsible for their data practices.
          </Text>
          <Text variant="bodyMedium" style={styles.sectionContent}>
            <Text style={styles.bold}>Firebase (Google):</Text> Used for app updates and train/station data. No analytics or tracking.
          </Text>
        </Surface>

        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            7. Not Official
          </Text>
          <Text variant="bodyMedium" style={styles.sectionContent}>
            This app is NOT affiliated with Bangladesh Railway. We're an independent tool that uses their public API.
          </Text>
        </Surface>

        <Surface style={[styles.section, styles.lastSection]} elevation={1}>
          <Text variant="bodyMedium" style={styles.acknowledgment}>
            By using Train Seat app, you agree to our Privacy Policy.
          </Text>
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
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  lastSection: {
    marginBottom: 24,
  },
  mainTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#006747',
    marginBottom: 8,
  },
  lastUpdated: {
    fontFamily: 'PlusJakartaSans-Italic',
    color: '#49454F',
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#1C1B1F',
    marginBottom: 12,
  },
  sectionContent: {
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#49454F',
    lineHeight: 22,
    marginBottom: 8,
  },
  listContent: {
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#49454F',
    lineHeight: 24,
    marginLeft: 8,
    marginBottom: 8,
  },
  bold: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontWeight: '600',
  },
  link: {
    color: '#006747',
    textDecorationLine: 'underline',
  },
  acknowledgment: {
    fontFamily: 'PlusJakartaSans-Medium-Italic',
    color: '#1C1B1F',
    lineHeight: 22,
    textAlign: 'center',
  },
});
