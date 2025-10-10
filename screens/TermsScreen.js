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

export default function TermsScreen() {
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
            Terms and Conditions
          </Text>
          <Text variant="bodySmall" style={styles.lastUpdated}>
            Last Updated: October 09, 2025
          </Text>
        </Surface>

        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            1. What This App Does
          </Text>
          <Text variant="bodyMedium" style={styles.sectionContent}>
            Train Seat checks Bangladesh Railway train seat availability and calculates seat matrices. It retrieves data directly from Bangladesh Railway's official system.
          </Text>
        </Surface>

        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            2. Not Official
          </Text>
          <Text variant="bodyMedium" style={styles.sectionContent}>
            This app is NOT affiliated with Bangladesh Railway. It's an independent tool for checking seat information.
          </Text>
        </Surface>

        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            3. Your Railway Account (Required for Most Features)
          </Text>
          <Text variant="bodyMedium" style={styles.sectionContent}>
            To use most features of this app, you need to provide your Bangladesh Railway account credentials (auth token and device key). Without credentials, the app has limited functionality. This data:
          </Text>
          <Text variant="bodyMedium" style={styles.listContent}>
            • Stays only on your device (encrypted local storage){'\n'}
            • Is sent directly to Bangladesh Railway servers when checking availability{'\n'}
            • Is never stored on our servers{'\n'}
            • You are responsible for keeping your credentials secure
          </Text>
        </Surface>

        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            4. How the App Works
          </Text>
          <Text variant="bodyMedium" style={styles.sectionContent}>
            All main features require Bangladesh Railway credentials:
          </Text>
          <Text variant="bodyMedium" style={styles.listContent}>
            • Searches trains between stations{'\n'}
            • Calculates seat matrices for specific trains and dates{'\n'}
            • Checks real-time seat availability{'\n'}
            • Shows train and station information{'\n'}
            • All data comes from Bangladesh Railway's API
          </Text>
        </Surface>

        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            5. No Guarantees
          </Text>
          <Text variant="bodyMedium" style={styles.sectionContent}>
            The app shows information "as is" from Bangladesh Railway. We cannot guarantee accuracy or availability. Always verify important information before traveling.
          </Text>
        </Surface>

        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            6. Liability
          </Text>
          <Text variant="bodyMedium" style={styles.sectionContent}>
            We are not responsible for missed trains, incorrect information, or any issues arising from using this app. Use it as a reference tool only.
          </Text>
        </Surface>

        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            7. Your Responsibilities
          </Text>
          <Text variant="bodyMedium" style={styles.sectionContent}>
            • Use the app legally and appropriately{'\n'}
            • Don't try to hack or abuse the system{'\n'}
            • Verify information independently{'\n'}
            • Keep your railway credentials private
          </Text>
        </Surface>

        <Surface style={[styles.section, styles.lastSection]} elevation={1}>
          <Text variant="bodyMedium" style={styles.acknowledgment}>
            By using Train Seat app, you agree to these Terms and Conditions.
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
