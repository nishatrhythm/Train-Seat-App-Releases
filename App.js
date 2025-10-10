import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Icon } from 'react-native-paper';
import { PaperProvider } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFonts,
  PlusJakartaSans_200ExtraLight,
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  PlusJakartaSans_200ExtraLight_Italic,
  PlusJakartaSans_300Light_Italic,
  PlusJakartaSans_400Regular_Italic,
  PlusJakartaSans_500Medium_Italic,
  PlusJakartaSans_600SemiBold_Italic,
  PlusJakartaSans_700Bold_Italic,
  PlusJakartaSans_800ExtraBold_Italic,
} from '@expo-google-fonts/plus-jakarta-sans';

// Import screens and theme
import HomeScreen from './screens/HomeScreen';
import SeatAvailabilityScreen from './screens/SeatAvailabilityScreen';
import SeatAvailabilityResultsScreen from './screens/SeatAvailabilityResultsScreen';
import SettingsScreen from './screens/SettingsScreen';
import MatrixResultsScreen from './screens/MatrixResultsScreen';
import RailwayAccountScreen from './screens/RailwayAccountScreen';
import AboutScreen from './screens/AboutScreen';
import TermsScreen from './screens/TermsScreen';
import PrivacyPolicyScreen from './screens/PrivacyPolicyScreen';
import { theme } from './theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Custom Tab Icon Component with M3 Design and Animation
const TabIcon = ({ focused, iconName, size, color }) => {
  const opacityAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  React.useEffect(() => {
    // Opacity animation for background
    Animated.timing(opacityAnim, {
      toValue: focused ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [focused, opacityAnim]);

  return (
    <View style={{
      alignItems: 'center',
      justifyContent: 'center',
      height: 28, // Consistent height for all states
    }}>
      <Animated.View style={{
        backgroundColor: '#CFE9D9',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 16,
        minWidth: 64,
        minHeight: 32,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: opacityAnim,
        position: 'absolute',
      }} />
      <View style={{
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Ionicons name={iconName} size={20} color={color} />
      </View>
    </View>
  );
};

const HeaderTitle = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ marginBottom: 0 }}>
      <Ionicons name="grid" size={24} color="#FFFFFF" />
    </View>
    <Text style={{ 
      fontFamily: 'PlusJakartaSans-Bold',
      fontSize: 18,
      color: '#FFFFFF',
      marginLeft: 6,
      lineHeight: 24,
      textAlignVertical: 'center'
    }}>
      Seat Matrix
    </Text>
  </View>
);

const SettingsHeaderTitle = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ marginBottom: 0 }}>
      <Icon source="cog" size={24} color="#FFFFFF" />
    </View>
    <Text style={{ 
      fontFamily: 'PlusJakartaSans-Bold',
      fontSize: 18,
      color: '#FFFFFF',
      marginLeft: 6,
      lineHeight: 24,
      textAlignVertical: 'center'
    }}>
      Settings
    </Text>
  </View>
);

const SeatAvailabilityHeaderTitle = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ marginBottom: 0 }}>
      <Ionicons name="list" size={24} color="#FFFFFF" />
    </View>
    <Text style={{ 
      fontFamily: 'PlusJakartaSans-Bold',
      fontSize: 18,
      color: '#FFFFFF',
      marginLeft: 6,
      lineHeight: 24,
      textAlignVertical: 'center'
    }}>
      Seat Availability
    </Text>
  </View>
);

// Tab Navigator Component
const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, size }) => {
          let iconName;
          let tabColor = focused ? '#006747' : '#49454F';

          if (route.name === 'Matrix') {
            iconName = focused ? 'grid' : 'grid-outline';
          } else if (route.name === 'Availability') {
            iconName = focused ? 'list' : 'list-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return (
            <TabIcon
              focused={focused}
              iconName={iconName}
              size={size}
              color={tabColor}
            />
          );
        },
        tabBarActiveTintColor: '#006747',
        tabBarInactiveTintColor: '#49454F',
        tabBarStyle: {
          backgroundColor: '#F0F8F5', // Slightly lighter version of the green
          borderTopWidth: 0,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8), // Use safe area insets
          paddingHorizontal: 16,
          height: 68 + Math.max(insets.bottom, 8), // Reduced height back to original
          elevation: 3,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: -1,
          },
          shadowOpacity: 0.08,
          shadowRadius: 3,
        },
        tabBarLabel: ({ focused, children }) => (
          <Text 
            numberOfLines={1}
            style={{
              fontFamily: focused ? 'PlusJakartaSans-ExtraBold' : 'PlusJakartaSans-Medium',
              fontSize: 12,
              color: focused ? '#006747' : '#49454F',
              marginTop: 4,
              letterSpacing: 0.5,
              textAlign: 'center',
              lineHeight: 16,
              marginBottom: 2,
            }}>
            {children}
          </Text>
        ),
        headerStyle: {
          backgroundColor: '#006747',
          elevation: 4,
          shadowOpacity: 0.12,
          shadowOffset: {
            width: 0,
            height: 2,
          },
          shadowRadius: 4,
          borderBottomWidth: 0,
        },
        headerTitleStyle: {
          fontFamily: 'PlusJakartaSans-SemiBold',
          fontSize: 22,
          color: '#FFFFFF',
          fontWeight: '600',
        },
        headerTitleAlign: 'center',
      })}
    >
      <Tab.Screen 
        name="Matrix" 
        component={HomeScreen}
        options={{
          headerTitle: () => <HeaderTitle />,
        }}
      />
      <Tab.Screen 
        name="Availability" 
        component={SeatAvailabilityScreen}
        options={{
          headerTitle: () => <SeatAvailabilityHeaderTitle />,
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          headerTitle: () => <SettingsHeaderTitle />,
        }}
      />
    </Tab.Navigator>
  );
};

export default function App() {
  let [fontsLoaded] = useFonts({
    'PlusJakartaSans-ExtraLight': PlusJakartaSans_200ExtraLight,
    'PlusJakartaSans-Light': PlusJakartaSans_300Light,
    'PlusJakartaSans-Regular': PlusJakartaSans_400Regular,
    'PlusJakartaSans-Medium': PlusJakartaSans_500Medium,
    'PlusJakartaSans-SemiBold': PlusJakartaSans_600SemiBold,
    'PlusJakartaSans-Bold': PlusJakartaSans_700Bold,
    'PlusJakartaSans-ExtraBold': PlusJakartaSans_800ExtraBold,
    'PlusJakartaSans-ExtraLight-Italic': PlusJakartaSans_200ExtraLight_Italic,
    'PlusJakartaSans-Light-Italic': PlusJakartaSans_300Light_Italic,
    'PlusJakartaSans-Italic': PlusJakartaSans_400Regular_Italic,
    'PlusJakartaSans-Medium-Italic': PlusJakartaSans_500Medium_Italic,
    'PlusJakartaSans-SemiBold-Italic': PlusJakartaSans_600SemiBold_Italic,
    'PlusJakartaSans-Bold-Italic': PlusJakartaSans_700Bold_Italic,
    'PlusJakartaSans-ExtraBold-Italic': PlusJakartaSans_800ExtraBold_Italic,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <PaperProvider theme={theme}>
      <View style={{ flex: 1 }}>
        <StatusBar style="dark" backgroundColor="#ffffff" />
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="MainTabs"
            screenOptions={{
              headerStyle: {
                backgroundColor: '#006747',
              },
              headerTitleStyle: {
                fontFamily: 'PlusJakartaSans-SemiBold',
                fontSize: 22,
                color: '#FFFFFF',
                fontWeight: '600',
              },
              headerTitleAlign: 'center',
              headerBackTitleVisible: false,
              headerTintColor: '#FFFFFF',
            }}
          >
            <Stack.Screen 
              name="MainTabs" 
              component={TabNavigator}
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="MatrixResults" 
              component={MatrixResultsScreen}
              options={{
                title: 'Seat Matrix Results',
                headerBackTitle: 'Back',
              }}
            />
            <Stack.Screen 
              name="SeatAvailabilityResults" 
              component={SeatAvailabilityResultsScreen}
              options={{
                title: 'Seat Availability Results',
                headerBackTitle: 'Back',
              }}
            />
            <Stack.Screen 
              name="RailwayAccount" 
              component={RailwayAccountScreen}
              options={{
                title: 'Railway Credentials',
                headerBackTitle: 'Back',
                headerTitleStyle: {
                  fontFamily: 'PlusJakartaSans-SemiBold',
                  fontSize: 18,
                  color: '#FFFFFF',
                  fontWeight: '600',
                },
              }}
            />
            <Stack.Screen 
              name="About" 
              component={AboutScreen}
              options={{
                title: 'About',
                headerBackTitle: 'Back',
                headerTitleStyle: {
                  fontFamily: 'PlusJakartaSans-SemiBold',
                  fontSize: 18,
                  color: '#FFFFFF',
                  fontWeight: '600',
                },
              }}
            />
            <Stack.Screen 
              name="Terms" 
              component={TermsScreen}
              options={{
                title: 'Terms and Conditions',
                headerBackTitle: 'Back',
                headerTitleStyle: {
                  fontFamily: 'PlusJakartaSans-SemiBold',
                  fontSize: 18,
                  color: '#FFFFFF',
                  fontWeight: '600',
                },
              }}
            />
            <Stack.Screen 
              name="PrivacyPolicy" 
              component={PrivacyPolicyScreen}
              options={{
                title: 'Privacy Policy',
                headerBackTitle: 'Back',
                headerTitleStyle: {
                  fontFamily: 'PlusJakartaSans-SemiBold',
                  fontSize: 18,
                  color: '#FFFFFF',
                  fontWeight: '600',
                },
              }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </View>
    </PaperProvider>
  );
}
