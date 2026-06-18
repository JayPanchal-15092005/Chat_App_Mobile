import { useTheme } from "@/hooks/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/hooks/useAuthStore";
import { Redirect, Tabs } from "expo-router";

const TabsLayout = () => {
  const { colors, isDark } = useTheme();
  const { token } = useAuthStore();

  if (!token) {
    return <Redirect href="/(auth)" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface.dark,
          borderTopColor: colors.surface.default,
          borderTopWidth: 1,
          height: 88,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary.default,
        tabBarInactiveTintColor: colors.subtleForeground,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Chats",
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? "chatbubbles" : "chatbubbles-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="calls"
        options={{
          title: "Calls",
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? "call" : "call-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
};

export default TabsLayout;
