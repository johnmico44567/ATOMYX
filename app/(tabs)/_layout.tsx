import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { COLORS } from '@/constants/colors';
import { TYPOGRAPHY } from '@/constants/typography';
import { checkAdministratorAccess } from '@/lib/admin';
import { useAuth } from '@/lib/auth';
import { getProfile, type Role } from '@/lib/profiles';

type AtomTab = 'index' | 'teacher' | 'history' | 'scan' | 'profile' | 'notifications' | 'admin';

const TAB_META: Record<AtomTab, { label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }> = {
  index: { label: 'Console', icon: 'grid-outline', activeIcon: 'grid' },
  teacher: { label: 'Studio', icon: 'school-outline', activeIcon: 'school' },
  history: { label: 'Ledger', icon: 'layers-outline', activeIcon: 'layers' },
  scan: { label: 'Scan', icon: 'scan-outline', activeIcon: 'scan' },
  profile: { label: 'Ident', icon: 'person-outline', activeIcon: 'person' },
  notifications: { label: 'Signals', icon: 'notifications-outline', activeIcon: 'notifications' },
  admin: { label: 'Command', icon: 'shield-outline', activeIcon: 'shield-checkmark' },
};

function DockItem({ focused, tab, onPress }: { focused: boolean; tab: AtomTab; onPress?: () => void }) {
  const motion = useReducedMotion();
  const press = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const meta = TAB_META[tab];
  const isScan = tab === 'scan';
  return (
    <Animated.View style={[styles.item, pressStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={meta.label}
        accessibilityState={{ selected: focused }}
        onPress={onPress}
        onPressIn={() => { if (!motion) press.value = withSpring(0.92, { damping: 14, stiffness: 300 }); }}
        onPressOut={() => { press.value = motion ? 1 : withSpring(1, { damping: 13, stiffness: 240 }); }}
        style={styles.hit}
      >
        {focused ? <View style={styles.beam} pointerEvents="none" /> : null}
        {isScan ? (
          <View style={[styles.scanCore, focused && styles.scanCoreActive]}>
            <Ionicons name={focused ? meta.activeIcon : meta.icon} size={24} color={focused ? '#03101F' : COLORS.cyan} />
          </View>
        ) : (
          <View style={[styles.iconWell, focused && styles.iconWellActive]}>
            <Ionicons name={focused ? meta.activeIcon : meta.icon} size={20} color={focused ? '#FFFFFF' : '#7E93B8'} />
          </View>
        )}
        <Text style={[styles.itemLabel, focused && styles.itemLabelActive, isScan && styles.scanLabel]}>{meta.label.toUpperCase()}</Text>
        {focused && !isScan ? <View style={styles.tick} /> : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 28,
    backgroundColor: 'rgba(4,9,26,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(77,227,255,0.22)',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'stretch',
    shadowColor: '#000000',
    shadowOpacity: 0.55,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  dockGlow: {
    position: 'absolute',
    top: -1,
    left: 26,
    right: 26,
    height: 1,
    backgroundColor: 'rgba(77,227,255,0.55)',
    shadowColor: COLORS.cyan,
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  item: { flex: 1, minWidth: 0 },
  hit: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, gap: 4, position: 'relative' },
  beam: {
    position: 'absolute',
    top: -8,
    width: 34,
    height: 2,
    borderRadius: 2,
    backgroundColor: COLORS.cyan,
    shadowColor: COLORS.cyan,
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  iconWell: {
    width: 46, height: 34, borderRadius: 13,
    backgroundColor: 'rgba(77,227,255,0.05)',
    borderWidth: 1, borderColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  iconWellActive: {
    backgroundColor: 'rgba(46,155,255,0.22)',
    borderColor: 'rgba(77,227,255,0.45)',
    shadowColor: COLORS.cyan, shadowOpacity: 0.35, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  itemLabel: {
    fontFamily: TYPOGRAPHY.semiboldFontFamily,
    fontSize: 8, letterSpacing: 1.2, color: '#7E93B8',
  },
  itemLabelActive: { color: '#FFFFFF' },
  scanCore: {
    width: 56, height: 42, borderRadius: 16,
    backgroundColor: 'rgba(77,227,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(77,227,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  scanCoreActive: {
    backgroundColor: COLORS.cyan,
    borderColor: '#FFFFFF',
    shadowColor: COLORS.cyan, shadowOpacity: 0.6, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  scanLabel: { color: COLORS.cyan },
  tick: { width: 14, height: 3, borderRadius: 2, backgroundColor: COLORS.cyan, opacity: 0.9 },
});

export default function TabLayout() {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState<Role | null>(null);
  const [isAdministrator, setIsAdministrator] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session) return;
    let active = true;
    setRole(null);
    setIsAdministrator(null);
    const refreshAccess = () => {
      Promise.allSettled([getProfile(session.user.id), checkAdministratorAccess()]).then(([p, a]) => {
        if (!active) return;
        setRole(p.status === 'fulfilled' ? p.value?.role ?? null : null);
        setIsAdministrator(a.status === 'fulfilled' ? a.value : null);
      });
    };
    refreshAccess();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refreshAccess(); });
    return () => { active = false; sub.remove(); };
  }, [session]);

  const dockOrder: AtomTab[] = isAdministrator
    ? ['index', 'admin', 'profile']
    : role === 'teacher'
      ? ['index', 'teacher', 'history', 'notifications', 'profile']
      : ['index', 'history', 'scan', 'notifications', 'profile'];

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: COLORS.backgroundDeep } }}
      tabBar={(props) => {
        if (isAdministrator === null && role === null) return null;
        const visible = props.state.routes.filter((r) => (dockOrder as string[]).includes(r.name));
        return (
          <View style={[styles.dock, { bottom: Math.max(insets.bottom, 8) + 10 }]}>
            <View style={styles.dockGlow} pointerEvents="none" />
            {visible.map((route) => {
              const idx = props.state.routes.findIndex((r) => r.key === route.key);
              const focused = props.state.index === idx;
              return (
                <DockItem
                  key={route.key}
                  tab={route.name as AtomTab}
                  focused={focused}
                  onPress={() => {
                    const ev = props.navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                    if (!focused && !ev.defaultPrevented) props.navigation.navigate(route.name, route.params);
                  }}
                />
              );
            })}
          </View>
        );
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Console' }} />
      <Tabs.Screen name="teacher" options={{ title: 'Studio', href: role === 'teacher' ? undefined : null }} />
      <Tabs.Screen name="history" options={{ title: 'Ledger', href: isAdministrator ? null : undefined }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan', href: isAdministrator || role === 'teacher' ? null : undefined }} />
      <Tabs.Screen name="profile" options={{ title: 'Ident' }} />
      <Tabs.Screen name="notifications" options={{ title: 'Signals', href: role ? undefined : null }} />
      <Tabs.Screen name="admin" options={{ title: 'Command', href: isAdministrator ? undefined : null }} />
    </Tabs>
  );
}
