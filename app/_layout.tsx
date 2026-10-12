import { Stack } from "expo-router";
import {CalendarProvider} from "../contexts/CalendarContext";

export default function RootLayout() {
  return <CalendarProvider><Stack screenOptions={{headerShown: false}} /></CalendarProvider>;
}
