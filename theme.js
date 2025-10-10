import { MD3LightTheme } from 'react-native-paper';

// Material 3 Custom Theme based on Bangladesh Railway colors
export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#006747', // Bangladesh Railway green
    primaryContainer: '#7CDAC5',
    onPrimaryContainer: '#002116',
    secondary: '#4D6357',
    secondaryContainer: '#CFE9D9',
    onSecondaryContainer: '#092017',
    tertiary: '#3F6373',
    tertiaryContainer: '#C3E8FB',
    onTertiaryContainer: '#001E28',
    error: '#BA1A1A',
    errorContainer: '#FFDAD6',
    onErrorContainer: '#410002',
    background: '#F7F9FC',
    onBackground: '#191C1A',
    surface: '#FFFFFF',
    onSurface: '#191C1A',
    surfaceVariant: '#DDE5DB',
    onSurfaceVariant: '#414942',
    outline: '#717971',
    outlineVariant: '#C1C9BF',
    inverseSurface: '#2E312F',
    inverseOnSurface: '#F0F1EE',
    inversePrimary: '#7CDAC5',
    elevation: {
      level0: 'transparent',
      level1: '#F4F8F4',
      level2: '#EDF4ED',
      level3: '#E6F0E7',
      level4: '#E4EFE5',
      level5: '#E0ECE2',
    },
  },
  fonts: {
    ...MD3LightTheme.fonts,
    displayLarge: {
      ...MD3LightTheme.fonts.displayLarge,
      fontFamily: 'PlusJakartaSans-ExtraBold',
    },
    displayMedium: {
      ...MD3LightTheme.fonts.displayMedium,
      fontFamily: 'PlusJakartaSans-Bold',
    },
    displaySmall: {
      ...MD3LightTheme.fonts.displaySmall,
      fontFamily: 'PlusJakartaSans-Bold',
    },
    headlineLarge: {
      ...MD3LightTheme.fonts.headlineLarge,
      fontFamily: 'PlusJakartaSans-Bold',
    },
    headlineMedium: {
      ...MD3LightTheme.fonts.headlineMedium,
      fontFamily: 'PlusJakartaSans-SemiBold',
    },
    headlineSmall: {
      ...MD3LightTheme.fonts.headlineSmall,
      fontFamily: 'PlusJakartaSans-SemiBold',
    },
    titleLarge: {
      ...MD3LightTheme.fonts.titleLarge,
      fontFamily: 'PlusJakartaSans-SemiBold',
    },
    titleMedium: {
      ...MD3LightTheme.fonts.titleMedium,
      fontFamily: 'PlusJakartaSans-Medium',
    },
    titleSmall: {
      ...MD3LightTheme.fonts.titleSmall,
      fontFamily: 'PlusJakartaSans-Medium',
    },
    labelLarge: {
      ...MD3LightTheme.fonts.labelLarge,
      fontFamily: 'PlusJakartaSans-Medium',
    },
    labelMedium: {
      ...MD3LightTheme.fonts.labelMedium,
      fontFamily: 'PlusJakartaSans-Medium',
    },
    labelSmall: {
      ...MD3LightTheme.fonts.labelSmall,
      fontFamily: 'PlusJakartaSans-Medium',
    },
    bodyLarge: {
      ...MD3LightTheme.fonts.bodyLarge,
      fontFamily: 'PlusJakartaSans-Regular',
    },
    bodyMedium: {
      ...MD3LightTheme.fonts.bodyMedium,
      fontFamily: 'PlusJakartaSans-Regular',
    },
    bodySmall: {
      ...MD3LightTheme.fonts.bodySmall,
      fontFamily: 'PlusJakartaSans-Regular',
    },
  },
};