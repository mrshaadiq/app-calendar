import Ionicons from "@expo/vector-icons/Ionicons";
import {Tabs} from "expo-router";

export default function TabLayout() {
  return <Tabs screenOptions={{
    headerShown: false, tabBarActiveTintColor: "#2358bd",
    tabBarInactiveTintColor: "#64748b",
    tabBarStyle: {height: 64, paddingTop: 5},
  }}>
    <Tabs.Screen name="today" options={{title: "Today",
      tabBarIcon: ({color, size}) => <Ionicons name="today-outline" color={color} size={size} />}} />
    <Tabs.Screen name="week" options={{title: "Week",
      tabBarIcon: ({color, size}) => <Ionicons name="calendar-outline" color={color} size={size} />}} />
    <Tabs.Screen name="tasks" options={{title: "Tasks",
      tabBarIcon: ({color, size}) => <Ionicons name="checkbox-outline" color={color} size={size} />}} />
    <Tabs.Screen name="settings" options={{title: "Settings",
      tabBarIcon: ({color, size}) => <Ionicons name="settings-outline" color={color} size={size} />}} />
  </Tabs>;
}
