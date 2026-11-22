import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Appbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import SearchScreen from '../screens/SearchScreen';
import HistoryScreen from '../screens/HistoryScreen';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        header: ({ route: currentRoute }) => (
          <Appbar.Header elevated>
            <Appbar.Content
              title={
                currentRoute.name === 'Buscar'
                  ? 'Buscador de CEP'
                  : 'Histórico de Buscas'
              }
              subtitle="React Native + Paper + Rotas"
            />
          </Appbar.Header>
        ),
        tabBarIcon: ({ focused, color, size }) => {
          const iconName =
            route.name === 'Buscar'
              ? focused
                ? 'map-search'
                : 'map-search-outline'
              : focused
                ? 'history'
                : 'history';

          return (
            <MaterialCommunityIcons
              name={iconName}
              size={size}
              color={color}
            />
          );
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#6c757d',
      })}
    >
      <Tab.Screen name="Buscar" component={SearchScreen} />
      <Tab.Screen name="Histórico" component={HistoryScreen} />
    </Tab.Navigator>
  );
}