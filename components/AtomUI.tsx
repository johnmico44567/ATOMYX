import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native';
import type { ReactNode } from 'react';

import AmbientBackground from '@/components/AmbientBackground';
import EntranceView from '@/components/EntranceView';
import { COLORS, RADIUS } from '@/constants/colors';
import { TYPOGRAPHY } from '@/constants/typography';

/** Full-screen midnight console wrapper: safe area + ambient glow + scroll content. */
export function AtomScreen({ children, bottomPad = 132, side = 'right' }: { children: ReactNode; bottomPad?: number; side?: 'left' | 'right' }) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={atom.screen} edges={['top']}>
      <AmbientBackground graphicSide={side} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[atom.scroll, { paddingBottom: Math.max(bottomPad, Math.max(insets.bottom, 8) + 112) }]}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Command-deck page header: status rail on top, oversized title, meta row, trailing action. */
export function AtomHead({ eyebrow, title, meta, action, delay = 0 }: { eyebrow: string; title: string; meta?: string; action?: ReactNode; delay?: number }) {
  return (
    <EntranceView delay={delay}>
      <View style={atom.headRail}>
        <View style={atom.liveDot} />
        <Text style={atom.eyebrow}>{eyebrow}</Text>
        <View style={atom.headRule} />
        <Text style={atom.headTime}>{new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase()}</Text>
      </View>
      <View style={atom.headRow}>
        <View style={atom.headCopy}>
          <Text style={atom.title}>{title}</Text>
          {meta ? <Text style={atom.meta}>{meta}</Text> : null}
        </View>
        {action}
      </View>
    </EntranceView>
  );
}

/** Glass operations panel with icon-tile header. */
export function AtomPanel({ icon, kicker, title, right, children, delay = 0 }: { icon: keyof typeof Ionicons.glyphMap; kicker: string; title: string; right?: ReactNode; children: ReactNode; delay?: number }) {
  return (
    <EntranceView delay={delay}>
      <View style={atom.panel}>
        <View style={atom.panelHead}>
          <View style={atom.panelTile}>
            <Ionicons name={icon} size={18} color={COLORS.cyan} />
          </View>
          <View style={atom.panelCopy}>
            <Text style={atom.kicker}>{kicker}</Text>
            <Text style={atom.panelTitle}>{title}</Text>
          </View>
          {right}
        </View>
        {children}
      </View>
    </EntranceView>
  );
}


/** Compact neon stat tile, used inside panels and dashboards. */
export function AtomStat({ icon, value, label, tone = COLORS.cyan }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string; tone?: string }) {
  return (
    <View style={atom.stat}>
      <View style={[atom.statTile, { borderColor: `${tone}55` }]}>
        <Ionicons name={icon} size={16} color={tone} />
      </View>
      <Text style={atom.statValue}>{value}</Text>
      <Text style={atom.statLabel}>{label}</Text>
    </View>
  );
}

/** Primary neon action + ghost action row. */
export function AtomPrimary({ title, icon, onPress, disabled, busy }: { title: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [atom.primary, (disabled || busy) && atom.disabled, pressed && atom.pressed]}
    >
      <View style={atom.primaryGlow} pointerEvents="none" />
      {busy ? <ActivityIndicator size="small" color="#03101F" /> : <Ionicons name={icon} size={18} color="#03101F" />}
      <Text style={atom.primaryText}>{busy ? 'WORKING…' : title}</Text>
      <Ionicons name="arrow-forward" size={16} color="#03101F" />
    </Pressable>
  );
}

export function AtomGhost({ title, icon, onPress, danger }: { title: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [atom.ghost, danger && atom.ghostDanger, pressed && atom.pressed]}
    >
      <Ionicons name={icon} size={17} color={danger ? COLORS.danger : COLORS.cyan} />
      <Text style={[atom.ghostText, danger && atom.ghostTextDanger]}>{title}</Text>
    </Pressable>
  );
}

/** Inline loading / error / empty console states. */
export function AtomState({ kind, title, message, actionTitle, onAction }: { kind: 'loading' | 'error' | 'empty'; title: string; message: string; actionTitle?: string; onAction?: () => void }) {
  return (
    <View style={atom.state}>
      <View style={[atom.stateTile, kind === 'error' && atom.stateTileError]}>
        {kind === 'loading'
          ? <ActivityIndicator size="small" color={COLORS.cyan} />
          : <Ionicons name={kind === 'error' ? 'warning-outline' : 'planet-outline'} size={22} color={kind === 'error' ? COLORS.danger : COLORS.cyan} />}
      </View>
      <Text style={atom.stateTitle}>{title}</Text>
      <Text style={atom.stateText}>{message}</Text>
      {actionTitle && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [atom.stateBtn, pressed && atom.pressed]}>
          <Text style={atom.stateBtnText}>{actionTitle}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export const atom = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.backgroundDeep },
  scroll: { paddingHorizontal: 18, paddingTop: 14 },
  headRail: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.cyan, shadowColor: COLORS.cyan, shadowOpacity: 0.9, shadowRadius: 8 },
  eyebrow: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 10, letterSpacing: 2.2, color: COLORS.cyan },
  headRule: { flex: 1, height: 1, backgroundColor: 'rgba(77,227,255,0.16)' },
  headTime: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 10, letterSpacing: 1.4, color: COLORS.textMuted },
  headRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  headCopy: { flex: 1 },
  title: { fontFamily: TYPOGRAPHY.displayFontFamily, fontSize: 32, lineHeight: 36, letterSpacing: -0.8, color: COLORS.textPrimary },
  meta: { fontFamily: TYPOGRAPHY.fontFamily, fontSize: 13, lineHeight: 19, color: COLORS.textSecondary, marginTop: 6 },
  panel: {
    backgroundColor: 'rgba(13,24,54,0.82)',
    borderWidth: 1, borderColor: COLORS.glassBorder, borderRadius: 24,
    padding: 16, marginBottom: 14,
    shadowColor: '#000000', shadowOpacity: 0.4, shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 12 },
  panelTile: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: 'rgba(77,227,255,0.10)',
    borderWidth: 1, borderColor: 'rgba(77,227,255,0.28)',
    alignItems: 'center', justifyContent: 'center',
  },
  panelCopy: { flex: 1 },
  kicker: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 9, letterSpacing: 1.8, color: COLORS.cyan },
  panelTitle: { fontFamily: TYPOGRAPHY.headingFontFamily, fontSize: 18, lineHeight: 23, color: COLORS.textPrimary, marginTop: 1 },
  stat: { flex: 1, minWidth: 100, backgroundColor: 'rgba(5,11,30,0.6)', borderWidth: 1, borderColor: COLORS.glassBorder, borderRadius: 18, padding: 12, gap: 4 },
  statTile: { width: 32, height: 32, borderRadius: 11, backgroundColor: 'rgba(77,227,255,0.08)', borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  statValue: { fontFamily: TYPOGRAPHY.numberFontFamily, fontSize: 20, color: COLORS.textPrimary },
  statLabel: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 9, letterSpacing: 1.1, color: COLORS.textMuted },
  primary: {
    position: 'relative', overflow: 'hidden',
    minHeight: 54, borderRadius: 17, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    backgroundColor: COLORS.cyan,
    shadowColor: COLORS.cyan, shadowOpacity: 0.4, shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  primaryGlow: { position: 'absolute', top: 0, left: 14, right: 14, height: 1, backgroundColor: 'rgba(255,255,255,0.7)' },
  primaryText: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 15, color: '#03101F', letterSpacing: 0.2 },
  ghost: {
    minHeight: 50, borderRadius: 16, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(77,227,255,0.07)', borderWidth: 1, borderColor: 'rgba(77,227,255,0.22)',
  },
  ghostDanger: { backgroundColor: 'rgba(255,107,138,0.08)', borderColor: 'rgba(255,107,138,0.28)' },
  ghostText: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 14, color: COLORS.cyan },
  ghostTextDanger: { color: COLORS.danger },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  state: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 18, gap: 6 },
  stateTile: {
    width: 56, height: 56, borderRadius: 19, marginBottom: 8,
    backgroundColor: 'rgba(77,227,255,0.09)', borderWidth: 1, borderColor: 'rgba(77,227,255,0.26)',
    alignItems: 'center', justifyContent: 'center',
  },
  stateTileError: { backgroundColor: 'rgba(255,107,138,0.09)', borderColor: 'rgba(255,107,138,0.3)' },
  stateTitle: { fontFamily: TYPOGRAPHY.headingFontFamily, fontSize: 18, color: COLORS.textPrimary, textAlign: 'center' },
  stateText: { fontFamily: TYPOGRAPHY.fontFamily, fontSize: 13, lineHeight: 20, color: COLORS.textSecondary, textAlign: 'center' },
  stateBtn: { marginTop: 10, minHeight: 44, paddingHorizontal: 18, borderRadius: 14, backgroundColor: 'rgba(77,227,255,0.12)', borderWidth: 1, borderColor: 'rgba(77,227,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  stateBtnText: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 13, color: COLORS.cyan },
});

export { RADIUS };

