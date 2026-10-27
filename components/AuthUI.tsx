import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';

import AmbientBackground from '@/components/AmbientBackground';
import EntranceView from '@/components/EntranceView';
import { COLORS } from '@/constants/colors';
import { TYPOGRAPHY } from '@/constants/typography';

export function AuthShell({ topInset, bottomInset, children }: { topInset: number; bottomInset: number; children: ReactNode }) {
  return (
    <View style={[auth.shell, { paddingTop: topInset }]}>
      <AmbientBackground variant="compact" graphicSide="right" />
      <KeyboardAvoidingView style={auth.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[auth.scroll, { paddingBottom: Math.max(bottomInset, 16) + 28 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export function AuthMasthead({ pill }: { pill: string }) {
  return (
    <EntranceView>
      <View style={auth.topRow}>
        <View style={auth.mark}>
          <Ionicons name="scan" size={22} color={COLORS.cyan} />
        </View>
        <View style={auth.markCopy}>
          <Text style={auth.wordmark}>ATOMYX</Text>
          <Text style={auth.sub}>ATTENDANCE UPLINK · V1</Text>
        </View>
        <View style={auth.livePill}><View style={auth.liveDot} /><Text style={auth.liveText}>{pill}</Text></View>
      </View>
    </EntranceView>
  );
}

export function AuthField({ label, icon, focused, children }: { label: string; icon: keyof typeof Ionicons.glyphMap; focused: boolean; children: ReactNode }) {
  return (
    <>
      <Text style={auth.label}>{label}</Text>
      <View collapsable={false} style={[auth.field, focused && auth.fieldHot]}>
        <Ionicons name={icon} size={17} color={focused ? COLORS.cyan : COLORS.textMuted} />
        {children}
      </View>
    </>
  );
}

export const auth = StyleSheet.create({
  flex: { flex: 1 },
  shell: { flex: 1, backgroundColor: COLORS.backgroundDeep },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 22 },
  mark: {
    width: 46, height: 46, borderRadius: 16,
    backgroundColor: 'rgba(77,227,255,0.08)', borderWidth: 1, borderColor: 'rgba(77,227,255,0.38)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.cyan, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 4,
  },
  markCopy: { flex: 1 },
  wordmark: { fontFamily: TYPOGRAPHY.displayFontFamily, fontSize: 19, letterSpacing: 2.6, color: COLORS.textPrimary },
  sub: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 8, letterSpacing: 1.6, color: COLORS.textMuted, marginTop: 2 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 30, borderRadius: 15, backgroundColor: 'rgba(61,220,151,0.10)', borderWidth: 1, borderColor: 'rgba(61,220,151,0.35)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success },
  liveText: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 9, letterSpacing: 1.3, color: COLORS.success },
  display: { fontFamily: TYPOGRAPHY.displayFontFamily, fontSize: 44, lineHeight: 48, letterSpacing: -1.2, color: COLORS.textPrimary, marginBottom: 10 },
  lede: { fontFamily: TYPOGRAPHY.fontFamily, fontSize: 14, lineHeight: 21, color: COLORS.textSecondary, marginBottom: 20, maxWidth: 330 },
  console: {
    backgroundColor: 'rgba(10,20,46,0.92)', borderWidth: 1, borderColor: COLORS.glassBorder,
    borderRadius: 26, padding: 18,
    shadowColor: '#000000', shadowOpacity: 0.5, shadowRadius: 26, shadowOffset: { width: 0, height: 12 }, elevation: 6,
  },
  consoleBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 14, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(77,227,255,0.12)' },
  lights: { flexDirection: 'row', gap: 6 },
  light: { width: 9, height: 9, borderRadius: 5 },
  consoleTitle: { flex: 1, fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 10, letterSpacing: 2, color: COLORS.textSecondary },
  label: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 9, letterSpacing: 1.7, color: COLORS.cyan, marginBottom: 8, marginTop: 14 },
  field: {
    minHeight: 56, borderRadius: 16, paddingHorizontal: 13,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(3,7,22,0.8)', borderWidth: 1, borderColor: 'rgba(94,180,255,0.16)',
  },
  fieldHot: { borderColor: 'rgba(77,227,255,0.55)', shadowColor: COLORS.cyan, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  input: { flex: 1, fontFamily: TYPOGRAPHY.fontFamily, fontSize: 15, color: COLORS.textPrimary, paddingVertical: 8 },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 14, padding: 13, borderRadius: 16, backgroundColor: 'rgba(255,107,138,0.08)', borderWidth: 1, borderColor: 'rgba(255,107,138,0.3)' },
  error: { flex: 1, fontFamily: TYPOGRAPHY.fontFamily, fontSize: 13, lineHeight: 19, color: COLORS.danger },
  go: {
    marginTop: 18, minHeight: 58, borderRadius: 18, paddingHorizontal: 16,
    backgroundColor: COLORS.cyan, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    shadowColor: COLORS.cyan, shadowOpacity: 0.45, shadowRadius: 20, shadowOffset: { width: 0, height: 7 }, elevation: 6,
  },
  goBusy: { opacity: 0.7 },
  goText: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 16, color: '#03101F' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 16 },
  switchText: { fontFamily: TYPOGRAPHY.fontFamily, fontSize: 13, color: COLORS.textSecondary },
  switchLink: { paddingVertical: 6 },
  switchLinkText: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 13, color: COLORS.cyan },
  steps: { flexDirection: 'row', gap: 8, marginTop: 16 },
  step: { flex: 1, borderRadius: 16, padding: 11, backgroundColor: 'rgba(5,11,30,0.6)', borderWidth: 1, borderColor: COLORS.glassBorder },
  stepN: { fontFamily: TYPOGRAPHY.numberFontFamily, fontSize: 11, color: COLORS.cyan },
  stepT: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 12, color: COLORS.textPrimary, marginTop: 2 },
  success: { alignItems: 'center', paddingVertical: 18, gap: 6 },
  successTile: { width: 60, height: 60, borderRadius: 21, backgroundColor: 'rgba(61,220,151,0.12)', borderWidth: 1, borderColor: 'rgba(61,220,151,0.4)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  successTitle: { fontFamily: TYPOGRAPHY.headingFontFamily, fontSize: 20, color: COLORS.textPrimary },
  successText: { fontFamily: TYPOGRAPHY.fontFamily, fontSize: 13, lineHeight: 20, color: COLORS.textSecondary, textAlign: 'center' },
});

export function AuthError({ message }: { message: string }) {
  return (
    <View style={auth.errorBox}>
      <Ionicons name="warning-outline" size={16} color={COLORS.danger} />
      <Text style={auth.error}>{message}</Text>
    </View>
  );
}
