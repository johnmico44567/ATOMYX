import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AtomGhost, AtomHead, AtomPanel, AtomPrimary, AtomScreen, AtomStat, AtomState, atom } from '@/components/AtomUI';
import EntranceView from '@/components/EntranceView';
import { useAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profiles';
import { getEventsByTeacher, type CloudEvent } from '@/lib/events';
import { getTeacherProfileOverview, type TeacherProfileOverview } from '@/lib/attendance';
import { getRecoveryRequests } from '@/lib/smartFeatures';
import { COLORS } from '@/constants/colors';
import { TYPOGRAPHY } from '@/constants/typography';
import { checkAdministratorAccess, type AdminSection } from '@/lib/admin';

type HomeAccess = 'checking' | 'administrator' | 'teacher' | 'standard' | 'error';

export default function Index() {
  const { user, session, loading: authLoading } = useAuth();
  const entrance = useRef(new Animated.Value(0)).current;
  const rail = useRef(new Animated.Value(0)).current;
  const accessCheckId = useRef(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [homeAccess, setHomeAccess] = useState<HomeAccess>('checking');
  const [accessError, setAccessError] = useState<string | null>(null);

  const metadataName = user?.user_metadata?.full_name;
  const firstName = typeof metadataName === 'string' && metadataName.trim() ? metadataName.trim().split(/\s+/)[0] : null;
  const avatarInitial = firstName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'A';

  const verifyHomeAccess = useCallback(async () => {
    const checkId = ++accessCheckId.current;
    setHomeAccess('checking');
    setAccessError(null);
    if (authLoading) return;
    if (!session) { setHomeAccess('standard'); return; }
    try {
      const isAdministrator = await checkAdministratorAccess();
      if (isAdministrator) { if (accessCheckId.current === checkId) setHomeAccess('administrator'); return; }
      const profile = await getProfile(session.user.id);
      if (!profile) throw new Error('Your profile could not be found.');
      if (accessCheckId.current === checkId) setHomeAccess(profile.role === 'teacher' ? 'teacher' : 'standard');
    } catch (error) {
      if (accessCheckId.current !== checkId) return;
      setHomeAccess('error');
      setAccessError(error instanceof Error ? error.message : 'Account access could not be verified.');
    }
  }, [authLoading, session]);

  useFocusEffect(useCallback(() => {
    void verifyHomeAccess();
    return () => { accessCheckId.current += 1; };
  }, [verifyHomeAccess]));

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((r) => { if (mounted) setReduceMotion(r); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; sub.remove(); };
  }, []);

  useEffect(() => {
    if (reduceMotion) { entrance.setValue(1); rail.setValue(1); return; }
    Animated.spring(entrance, { toValue: 1, tension: 48, friction: 9, useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(rail, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(rail, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    loop.start();
    return () => { loop.stop(); entrance.stopAnimation(); };
  }, [entrance, rail, reduceMotion]);

  const railY = rail.interpolate({ inputRange: [0, 1], outputRange: [-30, 30] });

  if (homeAccess === 'checking' || homeAccess === 'error') {
    return (
      <AtomScreen>
        <AtomHead eyebrow="ATOMYX · UPLINK" title="Console" meta="Establishing your workspace…" />
        <AtomPanel icon="radio-outline" kicker="ACCESS CHECK" title={homeAccess === 'checking' ? 'Verifying identity' : 'Verification failed'}>
          {homeAccess === 'checking'
            ? <AtomState kind="loading" title="Syncing access" message="Confirming your role and workspace permissions." />
            : <AtomState kind="error" title="Could not verify" message={accessError ?? 'Account access could not be verified.'} actionTitle="Retry verification" onAction={() => { void verifyHomeAccess(); }} />}
        </AtomPanel>
      </AtomScreen>
    );
  }

  if (homeAccess === 'administrator') {
    return <AdminHomeConsole name={firstName} initial={avatarInitial} />;
  }

  if (homeAccess === 'teacher') {
    return <TeacherHomeConsole userId={session?.user.id ?? ''} name={firstName} />;
  }

  return <StudentHomeConsole name={firstName} initial={avatarInitial} railY={railY} />;
}

/* ————— STUDENT: vertical scan console ————— */
function StudentHomeConsole({ name, initial, railY }: { name: string | null; initial: string; railY: Animated.AnimatedInterpolation<number> }) {
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <AtomScreen bottomPad={150}>
      <AtomHead
        eyebrow="ATOMYX · STUDENT DECK"
        title={name ? `Ready, ${name}.` : 'Ready to check in.'}
        meta={`${today} · Your attendance uplink is live.`}
        action={
          <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => router.push('/profile')} style={home.avatar}>
            <Text style={home.avatarText}>{initial}</Text>
            <View style={home.avatarPulse} />
          </Pressable>
        }
      />

      <EntranceView delay={60}>
        <View style={home.scanDeck}>
          <View style={home.deckRail}>
            <Text style={home.deckEyebrow}>CHECK-IN TERMINAL</Text>
            <View style={home.liveChip}><View style={home.liveDot} /><Text style={home.liveText}>LIVE</Text></View>
          </View>
          <View style={home.scanWindow}>
            <Animated.View pointerEvents="none" style={[home.scanBeam, { transform: [{ translateY: railY }] }]} />
            <View style={[home.corner, home.cTL]} /><View style={[home.corner, home.cTR]} />
            <View style={[home.corner, home.cBL]} /><View style={[home.corner, home.cBR]} />
            <View style={home.coreRing}>
              <View style={home.coreInner}>
                <Ionicons name="scan" size={30} color={COLORS.cyan} />
              </View>
            </View>
            <Text style={home.scanHint}>Point at the class QR</Text>
          </View>
          <AtomPrimary title="Scan to check in" icon="scan-outline" onPress={() => router.push('/scan')} />
          <View style={home.deckRow}>
            <View style={home.deckHalf}><AtomGhost title="My ledger" icon="layers-outline" onPress={() => router.push('/history')} /></View>
            <View style={home.deckHalf}><AtomGhost title="Signals" icon="notifications-outline" onPress={() => router.push('/notifications')} /></View>
          </View>
        </View>
      </EntranceView>

      <AtomPanel icon="pulse-outline" kicker="ATTENDANCE FLOW" title="How today works" delay={120}>
        <View style={home.flowRow}>
          <FlowStep n="01" t="Scan" d="Capture the class code" />
          <View style={home.flowLink} />
          <FlowStep n="02" t="Confirm" d="Verify your check-in" />
          <View style={home.flowLink} />
          <FlowStep n="03" t="Synced" d="Saved to your ledger" />
        </View>
      </AtomPanel>

      <EntranceView delay={170}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/profile')} style={home.identStrip}>
          <View style={home.identTile}><Ionicons name="id-card-outline" size={18} color={COLORS.cyan} /></View>
          <View style={home.identCopy}>
            <Text style={home.identTitle}>Identity & campus details</Text>
            <Text style={home.identText}>Keep your profile ready for every check-in.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </Pressable>
      </EntranceView>
    </AtomScreen>
  );
}

function FlowStep({ n, t, d }: { n: string; t: string; d: string }) {
  return (
    <View style={home.flowStep}>
      <Text style={home.flowN}>{n}</Text>
      <Text style={home.flowT}>{t}</Text>
      <Text style={home.flowD}>{d}</Text>
    </View>
  );
}

/* TEACHER: operations timeline console */
function TeacherHomeConsole({ userId, name }: { userId: string; name: string | null }) {
  const stamp = useRef(0);
  const [data, setData] = useState<{ events: CloudEvent[]; overview: TeacherProfileOverview; pending: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const id = ++stamp.current;
    setLoading(true);
    setError(null);
    try {
      const [events, overview, requests] = await Promise.all([
        getEventsByTeacher(userId),
        getTeacherProfileOverview(userId),
        getRecoveryRequests('teacher', userId),
      ]);
      if (stamp.current !== id) return;
      setData({ events, overview, pending: requests.filter((r) => r.status === 'pending').length });
    } catch (e) {
      if (stamp.current === id) setError(e instanceof Error ? e.message : 'Teacher dashboard data could not be loaded.');
    } finally {
      if (stamp.current === id) setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { stamp.current += 1; };
  }, [load]));

  const now = new Date();
  const upcoming = (data?.events ?? []).filter((e) => e.event_status !== 'closed' && e.start_time && new Date(e.start_time).getTime() >= now.getTime() - 86400000)
    .sort((a, b) => new Date(a.start_time as string).getTime() - new Date(b.start_time as string).getTime()).slice(0, 4);
  const activeCount = (data?.events ?? []).filter((e) => e.event_status !== 'closed').length;

  return (
    <AtomScreen bottomPad={150} side="left">
      <AtomHead
        eyebrow="ATOMYX · STUDIO OPS"
        title={name ? `${name}'s studio` : 'Teaching studio'}
        meta="Run sessions, watch check-ins land, clear recovery flags."
        action={
          <Pressable accessibilityRole="button" accessibilityLabel="Open studio" onPress={() => router.push('/teacher')} style={home.avatar}>
            <Ionicons name="school" size={20} color={COLORS.cyan} />
          </Pressable>
        }
      />
      <AtomPanel icon="speedometer-outline" kicker="OPERATIONS" title="Session pulse" delay={60}>
        {loading ? <AtomState kind="loading" title="Loading ops" message="Pulling sessions and attendance pulse." />
          : error ? <AtomState kind="error" title="Ops unavailable" message={error} actionTitle="Retry" onAction={() => { void load(); }} />
          : (
            <View style={home.opsGrid}>
              <AtomStat icon="radio-button-on-outline" value={String(activeCount)} label="ACTIVE" />
              <AtomStat icon="people-outline" value={String(data?.overview.scanCount ?? 0)} label="CHECK-INS" />
              <AtomStat icon="document-text-outline" value={String(data?.pending ?? 0)} label="TO REVIEW" tone={COLORS.warning} />
            </View>
          )}
      </AtomPanel>
      <AtomPanel icon="calendar-outline" kicker="RUNWAY" title="Upcoming sessions" delay={110} right={
        <Pressable accessibilityRole="button" onPress={() => router.push('/teacher')}><Text style={home.seeAll}>STUDIO →</Text></Pressable>
      }>
        {loading ? <AtomState kind="loading" title="Reading schedule" message="Checking the next sessions on your runway." />
          : upcoming.length === 0 ? <AtomState kind="empty" title="Runway clear" message="No upcoming sessions. Spin up the next class when ready." actionTitle="Open studio" onAction={() => router.push('/teacher')} />
          : (
            <View style={home.runway}>
              {upcoming.map((e, i) => (
                <View key={e.id} style={home.slot}>
                  <View style={home.slotRail}>
                    <View style={[home.slotNode, i === 0 && home.slotNodeHot]} />
                    {i < upcoming.length - 1 ? <View style={home.slotLine} /> : null}
                  </View>
                  <View style={home.slotCard}>
                    <Text style={home.slotTitle}>{e.title}</Text>
                    <Text style={home.slotMeta}>{e.start_time ? new Date(e.start_time).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : 'Time TBA'} · {e.venue || 'Venue TBA'}</Text>
                    <Text style={home.slotCode}>{e.event_code}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
      </AtomPanel>
      <EntranceView delay={150}>
        <View style={home.studioActions}>
          <View style={home.deckHalf}><AtomPrimary title="New session" icon="add-circle-outline" onPress={() => router.push('/teacher')} /></View>
          <View style={home.deckHalf}><AtomGhost title="Ledger" icon="layers-outline" onPress={() => router.push('/history')} /></View>
        </View>
      </EntranceView>
    </AtomScreen>
  );
}

/* ADMIN: command grid console */
const ADMIN_LINKS: { section: AdminSection; title: string; hint: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { section: 'overview', title: 'Overview', hint: 'Campus pulse', icon: 'grid-outline' },
  { section: 'teacherRequests', title: 'Requests', hint: 'Access review', icon: 'school-outline' },
  { section: 'users', title: 'Users', hint: 'Roles & people', icon: 'people-outline' },
  { section: 'events', title: 'Events', hint: 'Sessions', icon: 'calendar-outline' },
  { section: 'attendance', title: 'Attendance', hint: 'Records', icon: 'checkmark-done-outline' },
  { section: 'audit', title: 'Audit log', hint: 'History', icon: 'time-outline' },
];

function AdminHomeConsole({ name, initial }: { name: string | null; initial: string }) {
  return (
    <AtomScreen bottomPad={150}>
      <AtomHead
        eyebrow="ATOMYX · COMMAND"
        title={name ? `Command, ${name}.` : 'Command deck.'}
        meta="Sensitive controls live here — every section is one tap away."
        action={
          <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => router.push('/profile')} style={home.avatar}>
            <Text style={home.avatarText}>{initial}</Text>
          </Pressable>
        }
      />
      <EntranceView delay={60}>
        <View style={home.cmdBanner}>
          <View style={home.cmdTile}><Ionicons name="shield-checkmark" size={22} color="#03101F" /></View>
          <View style={home.cmdCopy}>
            <Text style={home.cmdKicker}>ADMIN ACCESS VERIFIED</Text>
            <Text style={home.cmdTitle}>Campus control, centralized.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/admin')} style={home.cmdBtn}>
            <Text style={home.cmdBtnText}>OPEN</Text>
            <Ionicons name="arrow-forward" size={15} color="#03101F" />
          </Pressable>
        </View>
      </EntranceView>
      <EntranceView delay={110}>
        <View style={home.cmdGrid}>
          {ADMIN_LINKS.map((l) => (
            <Pressable
              key={l.section}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/(tabs)/admin', params: { section: l.section } })}
              style={({ pressed }) => [home.cmdCell, pressed && atom.pressed]}
            >
              <View style={home.cmdIcon}><Ionicons name={l.icon} size={19} color={COLORS.cyan} /></View>
              <Text style={home.cmdCellTitle}>{l.title}</Text>
              <Text style={home.cmdCellHint}>{l.hint}</Text>
            </Pressable>
          ))}
        </View>
      </EntranceView>
    </AtomScreen>
  );
}

const home = StyleSheet.create({
  avatar: {
    width: 52, height: 52, borderRadius: 18,
    backgroundColor: 'rgba(77,227,255,0.08)', borderWidth: 1, borderColor: 'rgba(77,227,255,0.35)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.cyan, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  avatarText: { fontFamily: TYPOGRAPHY.numberFontFamily, fontSize: 20, color: COLORS.textPrimary },
  avatarPulse: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.cyan },
  seeAll: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 11, letterSpacing: 1.2, color: COLORS.cyan },
  scanDeck: {
    backgroundColor: 'rgba(13,24,54,0.82)', borderWidth: 1, borderColor: COLORS.glassBorder,
    borderRadius: 28, padding: 16, marginBottom: 14,
    shadowColor: '#000000', shadowOpacity: 0.45, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 5,
  },
  deckRail: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  deckEyebrow: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 10, letterSpacing: 2, color: COLORS.cyan },
  liveChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: 'rgba(61,220,151,0.10)', borderWidth: 1, borderColor: 'rgba(61,220,151,0.35)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success },
  liveText: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 10, letterSpacing: 1.4, color: COLORS.success },
  scanWindow: {
    position: 'relative', height: 240, borderRadius: 22, overflow: 'hidden',
    backgroundColor: 'rgba(3,6,20,0.85)', borderWidth: 1, borderColor: 'rgba(77,227,255,0.18)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  scanBeam: { position: 'absolute', left: 24, right: 24, height: 2, backgroundColor: COLORS.cyan, shadowColor: COLORS.cyan, shadowOpacity: 0.9, shadowRadius: 12 },
  corner: { position: 'absolute', width: 26, height: 26, borderColor: COLORS.cyan },
  cTL: { top: 14, left: 14, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  cTR: { top: 14, right: 14, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  cBL: { bottom: 14, left: 14, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  cBR: { bottom: 14, right: 14, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  coreRing: { width: 118, height: 118, borderRadius: 59, borderWidth: 1, borderColor: 'rgba(77,227,255,0.4)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(77,227,255,0.05)' },
  coreInner: { width: 78, height: 78, borderRadius: 39, backgroundColor: 'rgba(3,6,20,0.9)', borderWidth: 1, borderColor: 'rgba(77,227,255,0.30)', alignItems: 'center', justifyContent: 'center' },
  scanHint: { position: 'absolute', bottom: 14, fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 10, letterSpacing: 1.6, color: COLORS.textMuted },
  deckRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  deckHalf: { flex: 1 },
  flowRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  flowStep: { flex: 1, backgroundColor: 'rgba(5,11,30,0.6)', borderWidth: 1, borderColor: COLORS.glassBorder, borderRadius: 16, padding: 11, gap: 2 },
  flowN: { fontFamily: TYPOGRAPHY.numberFontFamily, fontSize: 11, color: COLORS.cyan },
  flowT: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 13, color: COLORS.textPrimary },
  flowD: { fontFamily: TYPOGRAPHY.fontFamily, fontSize: 11, lineHeight: 15, color: COLORS.textSecondary },
  flowLink: { width: 1, backgroundColor: 'rgba(77,227,255,0.20)', marginVertical: 8 },
  identStrip: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(13,24,54,0.82)', borderWidth: 1, borderColor: COLORS.glassBorder, borderRadius: 22, padding: 14 },
  identTile: { width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(77,227,255,0.08)', borderWidth: 1, borderColor: 'rgba(77,227,255,0.26)', alignItems: 'center', justifyContent: 'center' },
  identCopy: { flex: 1 },
  identTitle: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 14, color: COLORS.textPrimary },
  identText: { fontFamily: TYPOGRAPHY.fontFamily, fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  opsGrid: { flexDirection: 'row', gap: 10 },
  runway: { gap: 0 },
  slot: { flexDirection: 'row', gap: 10 },
  slotRail: { width: 18, alignItems: 'center' },
  slotNode: { width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(77,227,255,0.25)', borderWidth: 1, borderColor: 'rgba(77,227,255,0.4)', marginTop: 14 },
  slotNodeHot: { backgroundColor: COLORS.cyan, borderColor: '#FFFFFF', shadowColor: COLORS.cyan, shadowOpacity: 0.7, shadowRadius: 8 },
  slotLine: { width: 1, flex: 1, minHeight: 18, backgroundColor: 'rgba(77,227,255,0.20)' },
  slotCard: { flex: 1, backgroundColor: 'rgba(5,11,30,0.6)', borderWidth: 1, borderColor: COLORS.glassBorder, borderRadius: 16, padding: 12, marginBottom: 10 },
  slotTitle: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 14, color: COLORS.textPrimary },
  slotMeta: { fontFamily: TYPOGRAPHY.fontFamily, fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  slotCode: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 10, letterSpacing: 1.4, color: COLORS.cyan, marginTop: 5 },
  studioActions: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  cmdBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(77,227,255,0.10)', borderWidth: 1, borderColor: 'rgba(77,227,255,0.35)',
    borderRadius: 24, padding: 16, marginBottom: 14,
  },
  cmdTile: { width: 48, height: 48, borderRadius: 16, backgroundColor: COLORS.cyan, alignItems: 'center', justifyContent: 'center' },
  cmdCopy: { flex: 1 },
  cmdKicker: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 9, letterSpacing: 1.8, color: COLORS.cyan },
  cmdTitle: { fontFamily: TYPOGRAPHY.headingFontFamily, fontSize: 17, lineHeight: 22, color: COLORS.textPrimary, marginTop: 2 },
  cmdBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.cyan, borderRadius: 14, paddingHorizontal: 13, minHeight: 42 },
  cmdBtnText: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 13, color: '#03101F' },
  cmdGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cmdCell: { width: '48%', backgroundColor: 'rgba(13,24,54,0.82)', borderWidth: 1, borderColor: COLORS.glassBorder, borderRadius: 20, padding: 14, gap: 4 },
  cmdIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: 'rgba(77,227,255,0.08)', borderWidth: 1, borderColor: 'rgba(77,227,255,0.26)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  cmdCellTitle: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 14, color: COLORS.textPrimary },
  cmdCellHint: { fontFamily: TYPOGRAPHY.fontFamily, fontSize: 11, color: COLORS.textSecondary },
});
