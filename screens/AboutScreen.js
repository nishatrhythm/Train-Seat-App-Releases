import { 
  StyleSheet, 
  View, 
  ScrollView,
  StatusBar,
  Linking,
  Alert,
} from 'react-native';
import { 
  Text, 
  useTheme,
  Surface,
  Icon,
  Button,
  Card,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';

export default function AboutScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const handleDownloadLink = async () => {
    const url = 'https://github.com/nishatrhythm/Train-Seat-App-Releases/blob/main/README.md';
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Error', 'An error occurred while trying to open the link');
    }
  };

  const handleChangelogLink = async () => {
    const url = 'https://github.com/nishatrhythm/Train-Seat-App-Releases/releases';
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Error', 'An error occurred while trying to open the link');
    }
  };

  const handleFeedbackLink = async () => {
    const url = 'https://forms.gle/NV72PC1z75sq77tg7';
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Error', 'An error occurred while trying to open the feedback form');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar backgroundColor="#006747" barStyle="light-content" />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* App Icon and Name Section */}
        <Surface style={styles.appHeaderSection} elevation={1}>
          <View style={styles.appIconContainer}>
            <View style={styles.appIcon}>
              <Icon source="train" size={48} color="#006747" />
            </View>
          </View>
          <Text variant="headlineMedium" style={styles.appName}>
            Train Seat
          </Text>
          <Text variant="titleMedium" style={styles.appVersion}>
            Version 2.4.2
          </Text>
        </Surface>

        {/* About App Section */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            About This App
          </Text>
          <View style={styles.sectionContent}>
            <Text variant="bodyMedium" style={styles.aboutText}>
              Train Seat is a comprehensive mobile application designed to help passengers check real-time train seat availability and access detailed seat matrix information for Bangladesh Railway. Whether you're planning a journey or checking last-minute availability, this app provides up-to-date information to make your travel planning easier and more convenient.
            </Text>
          </View>
        </Surface>

        {/* Updates Section */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Updates & More Information
          </Text>
          <View style={styles.sectionContent}>
            <Text variant="bodyMedium" style={styles.githubDescription}>
              Stay updated with the latest features, download new versions, view change logs, and share your feedback to help us improve the app.
            </Text>
            
            <Button
              mode="outlined"
              onPress={handleDownloadLink}
              style={styles.githubButton}
              contentStyle={styles.githubButtonContent}
              icon="download"
            >
              Visit App Download Page
            </Button>
            
            <Button
              mode="outlined"
              onPress={handleChangelogLink}
              style={styles.changelogButton}
              contentStyle={styles.changelogButtonContent}
              icon="history"
            >
              View Change Log
            </Button>
            
            <Button
              mode="outlined"
              onPress={handleFeedbackLink}
              style={styles.feedbackButton}
              contentStyle={styles.feedbackButtonContent}
              icon="message-text"
            >
              Give Feedback
            </Button>
          </View>
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
  appHeaderSection: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  appIconContainer: {
    marginBottom: 16,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0F8F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#1C1B1F',
    textAlign: 'center',
    marginBottom: 8,
  },
  appVersion: {
    fontFamily: 'PlusJakartaSans-Medium',
    color: '#006747',
    textAlign: 'center',
  },
  section: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 0,
    marginBottom: 16,
  },
  sectionTitle: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#1C1B1F',
    backgroundColor: '#F7F9FC',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  sectionContent: {
    padding: 16,
  },
  aboutText: {
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#49454F',
    lineHeight: 22,
    marginBottom: 16,
  },
  githubDescription: {
    fontFamily: 'PlusJakartaSans-Regular',
    color: '#49454F',
    lineHeight: 22,
    marginBottom: 16,
  },
  githubButton: {
    borderColor: '#006747',
    borderWidth: 1,
    borderRadius: 8,
  },
  githubButtonContent: {
    paddingVertical: 4,
  },
  changelogButton: {
    borderColor: '#006747',
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 12,
  },
  changelogButtonContent: {
    paddingVertical: 4,
  },
  feedbackButton: {
    borderColor: '#006747',
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 12,
  },
  feedbackButtonContent: {
    paddingVertical: 4,
  },
});