import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/SignInScreen';
import SignUpScreen from '../screens/SignUpScreen';
import SelectGradeScreen from '../screens/SelectGradeScreen';
import SelectProvinceScreen from '../screens/SelectProvinceScreen';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  AcademicCapIcon,
  BuildingLibraryIcon,
  NewspaperIcon,
  UserCircleIcon,
  ChartBarIcon,
} from 'react-native-heroicons/solid';
import NewsScreen from '../screens/NewsScreen';
import SchoolsScreen from '../screens/SchoolsScreen';
import StudyingScreen from '../screens/StudyingScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { themeColors } from '../theme';
import RoleSelectScreen from '../screens/RoleSelectScreen';
import AdminVerificationScreen from '../screens/AdminVerificationScreen';
import AdminProfileScreen from '../screens/AdminProfileScreen';
import AdminStatisticsScreen from '../screens/AdminStatisticsScreen';
import AdminSchoolInfoScreen from '../screens/AdminSchoolInfoScreen';
import SchoolMapScreen from '../screens/SchoolMapScreen';
import SchoolFilterScreen from '../screens/SchoolFilterScreen';
import ModeratorPinScreen from '../screens/ModeratorPinScreen';
import ModeratorNewsScreen from '../screens/ModeratorNewsScreen';
import ModeratorCoursesScreen from '../screens/ModeratorCoursesScreen';
import { useRole, ROLES } from '../context/RoleContext';
import { useLocale } from '../context/LocaleContext';
import SchoolDetailScreen from '../screens/SchoolDetailScreen';
import VerifyCodeScreen from '../screens/VerifyCodeScreen';
import AboutAppScreen from '../screens/AboutAppScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import NewsDetailScreen from '../screens/NewsDetailScreen';
import ModeratorCourseDetailScreen from '../screens/ModeratorCourseDetailScreen';
import StudentTestsScreen from '../screens/StudentTestsScreen';
import StudentTestDetailScreen from '../screens/StudentTestDetailScreen';
import SchoolChatScreen from '../screens/SchoolChatScreen';
import WelcomeNewUserScreen from '../screens/WelcomeNewUserScreen';
import { navigationRef } from './navigationRef';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

{
  /** ============== App Navigator =================== */
}
export default function AppNavigation() {
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator initialRouteName="RoleSelect">
        <Stack.Screen
          name="RoleSelect"
          options={{ headerShown: false }}
          component={RoleSelectScreen}
        />
        <Stack.Screen
          name="Home"
          options={{ headerShown: false }}
          component={BottomTabNavigator}
        />
        <Stack.Screen
          name="SignIn"
          options={{ headerShown: false }}
          component={LoginScreen}
        />
        <Stack.Screen
          name="SignUp"
          options={{ headerShown: false }}
          component={SignUpScreen}
        />
        <Stack.Screen
          name="SelectGrade"
          options={{ headerShown: false }}
          component={SelectGradeScreen}
        />
        <Stack.Screen
          name="SelectProvince"
          options={{ headerShown: false }}
          component={SelectProvinceScreen}
        />
        <Stack.Screen
          name="AdminVerification"
          options={{ headerShown: false }}
          component={AdminVerificationScreen}
        />
        <Stack.Screen
          name="VerifyCode"
          options={{ headerShown: false }}
          component={VerifyCodeScreen}
        />
        <Stack.Screen
          name="SchoolMap"
          options={{ headerShown: false }}
          component={SchoolMapScreen}
        />
        <Stack.Screen
          name="SchoolFilter"
          options={{ headerShown: false }}
          component={SchoolFilterScreen}
        />
        <Stack.Screen
          name="ModeratorPin"
          options={{ headerShown: false }}
          component={ModeratorPinScreen}
        />
        <Stack.Screen
          name="SchoolDetail"
          options={{ headerShown: false }}
          component={SchoolDetailScreen}
        />
        <Stack.Screen
          name="AboutApp"
          options={{ headerShown: false }}
          component={AboutAppScreen}
        />
        <Stack.Screen
          name="EditProfile"
          options={{ headerShown: false }}
          component={EditProfileScreen}
        />
        <Stack.Screen
          name="ChangePassword"
          options={{ headerShown: false }}
          component={ChangePasswordScreen}
        />
        <Stack.Screen
          name="Notifications"
          options={{ headerShown: false }}
          component={NotificationsScreen}
        />
        <Stack.Screen
          name="NewsDetail"
          options={{ headerShown: false }}
          component={NewsDetailScreen}
        />
        <Stack.Screen
          name="ModeratorCourseDetail"
          options={{ headerShown: false }}
          component={ModeratorCourseDetailScreen}
        />
        <Stack.Screen
          name="StudentTests"
          options={{ headerShown: false }}
          component={StudentTestsScreen}
        />
        <Stack.Screen
          name="StudentTestDetail"
          options={{ headerShown: false }}
          component={StudentTestDetailScreen}
        />
        <Stack.Screen
          name="SchoolChat"
          options={{ headerShown: false }}
          component={SchoolChatScreen}
        />
        <Stack.Screen
          name="WelcomeNewUser"
          options={{ headerShown: false }}
          component={WelcomeNewUserScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

{
  /** ============== Bottom Tab Navigator =================== */
}
const extraTabOptions = {
  tabBarLabelStyle: { fontFamily: 'exo' },
  tabBarStyle: { borderTopRightRadius: 12, borderTopLeftRadius: 12 },
  tabBarActiveTintColor: themeColors.bgPurple,
  tabBarInactiveTintColor: themeColors.darkGrayText,
};
function BottomTabNavigator() {
  const { role, isGuest } = useRole();
  const { t } = useLocale();

  if (role === ROLES.ADMIN) {
    return (
      <Tab.Navigator initialRouteName="Profile">
        <Tab.Screen
          name="Profile"
          component={AdminProfileScreen}
          options={{
            headerShown: false,
            title: t('tabs.profile'),
            tabBarLabel: t('tabs.profile'),
            tabBarIcon: ({ color, size }) => (
              <UserCircleIcon color={color} size={size - 2} />
            ),
            ...extraTabOptions,
          }}
        />
        <Tab.Screen
          name="Statistics"
          component={AdminStatisticsScreen}
          options={{
            headerShown: false,
            title: t('tabs.statistics'),
            tabBarLabel: t('tabs.statistics'),
            tabBarIcon: ({ color, size }) => (
              <ChartBarIcon color={color} size={size - 2} />
            ),
            ...extraTabOptions,
          }}
        />
        <Tab.Screen
          name="SchoolInfo"
          component={AdminSchoolInfoScreen}
          options={{
            headerShown: false,
            title: t('tabs.schoolInfo'),
            tabBarLabel: t('tabs.schoolInfo'),
            tabBarIcon: ({ color, size }) => (
              <BuildingLibraryIcon color={color} size={size - 2} />
            ),
            ...extraTabOptions,
          }}
        />
      </Tab.Navigator>
    );
  }

  if (role === ROLES.MODERATOR) {
    return (
      <Tab.Navigator initialRouteName="NewsModerator">
        <Tab.Screen
          name="NewsModerator"
          component={ModeratorNewsScreen}
          options={{
            headerShown: false,
            title: t('tabs.news'),
            tabBarLabel: t('tabs.news'),
            tabBarIcon: ({ color, size }) => (
              <NewspaperIcon color={color} size={size - 2} />
            ),
            ...extraTabOptions,
          }}
        />
        <Tab.Screen
          name="CoursesModerator"
          component={ModeratorCoursesScreen}
          options={{
            headerShown: false,
            title: t('tabs.courses'),
            tabBarLabel: t('tabs.courses'),
            tabBarIcon: ({ color, size }) => (
              <AcademicCapIcon color={color} size={size - 2} />
            ),
            ...extraTabOptions,
          }}
        />
        <Tab.Screen
          name="ProfileModerator"
          component={ProfileScreen}
          options={{
            headerShown: false,
            title: t('tabs.profile'),
            tabBarLabel: t('tabs.profile'),
            tabBarIcon: ({ color, size }) => (
              <UserCircleIcon color={color} size={size - 2} />
            ),
            ...extraTabOptions,
          }}
        />
      </Tab.Navigator>
    );
  }

  return (
    <Tab.Navigator initialRouteName="News">
      <Tab.Screen
        name="News"
        component={NewsScreen}
        options={{
          headerShown: false,
          title: t('tabs.news'),
          tabBarLabel: t('tabs.news'),
          tabBarIcon: ({ color, size }) => (
            <NewspaperIcon color={color} size={size - 2} />
          ),
          ...extraTabOptions,
        }}
      />
      <Tab.Screen
        name="Schools"
        component={SchoolsScreen}
        options={{
          headerShown: false,
          title: t('tabs.schools'),
          tabBarLabel: t('tabs.schools'),
          tabBarIcon: ({ color, size }) => (
            <BuildingLibraryIcon color={color} size={size - 2} />
          ),
          ...extraTabOptions,
        }}
      />
      {!isGuest ? (
        <Tab.Screen
          name="Studying"
          component={StudyingScreen}
          options={{
            headerShown: false,
            title: t('tabs.studying'),
            tabBarLabel: t('tabs.studying'),
            tabBarIcon: ({ color, size }) => (
              <AcademicCapIcon color={color} size={size - 2} />
            ),
            ...extraTabOptions,
          }}
        />
      ) : null}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerShown: false,
          title: t('tabs.profile'),
          tabBarLabel: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => (
            <UserCircleIcon color={color} size={size - 2} />
          ),
          ...extraTabOptions,
        }}
      />
    </Tab.Navigator>
  );
}
