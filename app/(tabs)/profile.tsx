import AmbientBackground from '@/components/AmbientBackground';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import AppButton from '@/components/AppButton';
import EntranceView from '@/components/EntranceView';
import { COLORS, RADIUS, SPACE } from '@/constants/colors';
import { TYPOGRAPHY } from '@/constants/typography';
import { useAuth, signOut } from '@/lib/auth';
import { getProfile, updateProfile, type Profile, type Role } from '@/lib/profiles';
import { getStudentAttendanceInsights, getTeacherProfileOverview, type StudentAttendanceInsights, type TeacherProfileOverview } from '@/lib/attendance';
import { checkAdministratorAccess } from '@/lib/admin';
import {
  getMyNotifications,
  getMyTeacherAccessRequests,
  markMyNotificationRead,
  submitTeacherAccessRequest,
  withdrawTeacherAccessRequest,
  type InAppNotification,
  type TeacherAccessRequest,
} from '@/lib/accessWorkflow';

function formatWorkflowError(error: unknown, section: string): string {
  const detail = error instanceof Error ? error.message : 'The request failed.';
  if (/could not find the function .* in the schema cache/i.test(detail)) {
    return `${section} is unavailable because its server function is missing from the schema cache. Ask the project owner to deploy the reviewed migration and refresh the schema cache.`;
  }
  return `${section}: ${detail}`;
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdministrator, setIsAdministrator] = useState<boolean | null>(null);
  const [draftName, setDraftName] = useState('');
  const [studentInsights, setStudentInsights] = useState<StudentAttendanceInsights | null>(null);
  const [teacherOverview, setTeacherOverview] = useState<TeacherProfileOverview | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [teacherRequests, setTeacherRequests] = useState<TeacherAccessRequest[]>([]);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [teacherRequestReason, setTeacherRequestReason] = useState('');
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [requestWorkflowError, setRequestWorkflowError] = useState<string | null>(null);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const router = useRouter();
  const profileLoadGeneration = useRef(0);
  const avatarGlow = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const avatarGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.24 + avatarGlow.value * 0.34,
    transform: [{ scale: 0.96 + avatarGlow.value * 0.08 }],
  }));

  const refreshWorkflow = useCallback(async (
    isCurrent: () => boolean = () => true
  ): Promise<boolean | null> => {
    setWorkflowLoading(true);
    setTeacherRequests([]);
    setNotifications([]);
    setMembershipError(null);
    setRequestWorkflowError(null);
    setNotificationsError(null);
    let verifiedAdministrator: boolean | null = null;
    try {
      const [accessResult, notificationsResult] = await Promise.allSettled([
        checkAdministratorAccess(),
        getMyNotifications(),
      ]);
      if (!isCurrent()) return null;
      if (accessResult.status === 'fulfilled') {
        setIsAdministrator(accessResult.value);
        verifiedAdministrator = accessResult.value;
        if (!accessResult.value) {
          try {
            const requests = await getMyTeacherAccessRequests();
            if (!isCurrent()) return null;
            setTeacherRequests(requests);
          } catch (requestError) {
            if (!isCurrent()) return null;
            setTeacherRequests([]);
            setRequestWorkflowError(formatWorkflowError(requestError, 'Teacher request history'));
          }
        } else {
          setTeacherRequests([]);
        }
      } else {
        setIsAdministrator(null);
        setTeacherRequests([]);
        const error = formatWorkflowError(accessResult.reason, 'Administrator membership verification');
        setMembershipError(error);
        setRequestWorkflowError(error);
      }
      if (notificationsResult.status === 'fulfilled') {
        setNotifications(notificationsResult.value);
      } else {
        setNotificationsError(formatWorkflowError(notificationsResult.reason, 'Notifications'));
      }
    } finally {
      if (isCurrent()) setWorkflowLoading(false);
    }
    return verifiedAdministrator;
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      avatarGlow.value = 0;
      return;
    }
    avatarGlow.value = withRepeat(withTiming(1, { duration: 2400 }), -1, true);
    return () => { avatarGlow.value = withTiming(0, { duration: 0 }); };
  }, [avatarGlow, reduceMotion]);

  const loadProfile = useCallback(async () => {
    const generation = ++profileLoadGeneration.current;
    const isCurrent = () => profileLoadGeneration.current === generation;
    if (!user) {
      setProfile(null);
      setIsAdministrator(null);
      setStudentInsights(null);
      setTeacherOverview(null);
      setTeacherRequests([]);
      setNotifications([]);
      setLoadError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setProfile(null);
    setIsAdministrator(null);
    setMembershipError(null);
    setStudentInsights(null);
    setTeacherOverview(null);
    setLoadError(null);
    try {
      const currentProfile = await getProfile(user.id);
      if (!isCurrent()) return;
      if (!currentProfile) throw new Error('Your profile could not be loaded. Please try again.');
      setProfile(currentProfile);
      setDraftName(currentProfile.full_name ?? '');
      const isAdmin = await refreshWorkflow(isCurrent);
      if (!isCurrent()) return;
      if (isAdmin === null) {
        setStudentInsights(null);
        setTeacherOverview(null);
        return;
      }
      if (currentProfile.role === 'student') {
        if (isAdmin) {
          setStudentInsights(null);
          setTeacherOverview(null);
          return;
        }
        const insights = await getStudentAttendanceInsights(user.id);
        if (!isCurrent()) return;
        setStudentInsights(insights);
        setTeacherOverview(null);
      } else {
        const overview = await getTeacherProfileOverview(user.id);
        if (!isCurrent()) return;
        setTeacherOverview(overview);
        setStudentInsights(null);
      }
    } catch (error) {
      if (isCurrent()) {
        setLoadError(error instanceof Error ? error.message : 'Your profile could not be loaded.');
      }
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [refreshWorkflow, user]);

  useFocusEffect(useCallback(() => {
    void loadProfile();
    return () => { profileLoadGeneration.current += 1; };
  }, [loadProfile]));

  const handleSaveName = async () => {
    if (!user) return;
    const name = draftName.trim();
    if (!name) {
      setActionMessage({ text: 'Your name cannot be empty.', isError: true });
      return;
    }
    if (name.length > 80) {
      setActionMessage({ text: 'Your name must be 80 characters or fewer.', isError: true });
      return;
    }
    setSaving(true);
    setActionMessage(null);
    try {
      const { error } = await updateProfile(user.id, { full_name: name });
      if (error) throw new Error(error);
      setProfile((prev) => prev ? { ...prev, full_name: name } : prev);
      setDraftName(name);
      setEditing(false);
      setActionMessage({ text: 'Your profile name has been updated.', isError: false });
    } catch (error) {
      setActionMessage({ text: error instanceof Error ? error.message : 'Your profile could not be saved.', isError: true });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      setActionMessage({ text: error instanceof Error ? error.message : 'Failed to sign out.', isError: true });
      setSigningOut(false);
    }
  };

  const handleCopyId = async () => {
    if (!profile?.id) return;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(profile.id);
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 1800);
      } else {
        await Share.share({ message: profile.id, title: 'ATOMYX account ID' });
      }
    } catch (error) {
      setActionMessage({ text: error instanceof Error ? error.message : 'The account ID could not be copied.', isError: true });
    }
  };

  const handleTeacherRequest = async () => {
    setWorkflowBusy(true);
    setRequestWorkflowError(null);
    setWorkflowMessage(null);
    try {
      await submitTeacherAccessRequest(teacherRequestReason);
      setTeacherRequestReason('');
      setWorkflowMessage('Your teacher access request was submitted.');
      await refreshWorkflow();
    } catch (error) {
      setRequestWorkflowError(formatWorkflowError(error, 'Teacher access request'));
    } finally {
      setWorkflowBusy(false);
    }
  };

  const handleWithdrawTeacherRequest = async (requestId: string) => {
    setWorkflowBusy(true);
    setRequestWorkflowError(null);
    setWorkflowMessage(null);
    try {
      await withdrawTeacherAccessRequest(requestId);
      setWorkflowMessage('Your pending teacher request was withdrawn.');
      await refreshWorkflow();
    } catch (error) {
      setRequestWorkflowError(formatWorkflowError(error, 'Teacher access request'));
    } finally {
      setWorkflowBusy(false);
    }
  };

  const handleReadNotification = async (notificationId: string) => {
    setNotificationsError(null);
    try {
      await markMyNotificationRead(notificationId);
      setNotifications((current) => current.map((notification) => (
        notification.id === notificationId
          ? { ...notification, read_at: new Date().toISOString() }
          : notification
      )));
    } catch (error) {
      setNotificationsError(formatWorkflowError(error, 'Notification'));
    }
  };

  return (
    <View style={styles.container}>
      <AmbientBackground graphicSide="right" />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, SPACE.lg), paddingBottom: Math.max(insets.bottom, 16) + 112 }]} showsVerticalScrollIndicator={false}>
        <EntranceView>
        <View style={styles.pageHeader}>
          <View><Text style={styles.eyebrow}>{isAdministrator === null ? 'ACCOUNT ACCESS' : isAdministrator ? 'ATOMYX ADMINISTRATOR' : profile?.role === 'teacher' ? 'TEACHER ACCOUNT' : 'STUDENT ACCOUNT'}</Text><Text style={styles.title}>My profile</Text></View>
          <View style={styles.headerIcon}><Ionicons name={isAdministrator ? 'shield-checkmark-outline' : profile?.role === 'teacher' ? 'school-outline' : 'person-outline'} size={21} color={COLORS.primary} /></View>
        </View>
        </EntranceView>

        {loading && (!profile || isAdministrator === null) ? (
          <View style={styles.loadingState}><ActivityIndicator size="small" color={COLORS.primary} /><Text style={styles.subtitle}>Verifying account access...</Text></View>
        ) : (loadError && (!profile || isAdministrator === null)) || (profile && isAdministrator === null && membershipError) ? (
          <View style={styles.messageCard}>
            <Ionicons name="alert-circle-outline" size={22} color={COLORS.danger} />
            <Text style={styles.messageText}>{membershipError ?? loadError}</Text>
            <Pressable accessibilityRole="button" onPress={loadProfile} style={styles.retryButton}><Text style={styles.retryText}>Retry verification</Text></Pressable>
          </View>
        ) : profile && isAdministrator === null ? (
          <View style={styles.loadingState}><ActivityIndicator size="small" color={COLORS.primary} /><Text style={styles.subtitle}>Verifying account access...</Text></View>
        ) : !profile ? (
          <View style={styles.messageCard}>
            <Ionicons name="alert-circle-outline" size={22} color={COLORS.danger} />
            <Text style={styles.messageText}>{loadError ?? 'Your account could not be loaded.'}</Text>
            <Pressable accessibilityRole="button" onPress={loadProfile} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable>
          </View>
        ) : (
          <EntranceView delay={100}>
          <View style={styles.identityCard}>
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
              <Defs><LinearGradient id="profileCover" x1="0" y1="0" x2="1" y2="1"><Stop offset="0%" stopColor="#0A1430" /><Stop offset="50%" stopColor="#123B8F" /><Stop offset="100%" stopColor="#4138B4" /></LinearGradient></Defs>
              <Rect width="100%" height="100%" rx="28" fill="url(#profileCover)" />
              <Circle cx="100%" cy="0%" r="112" fill="#4DE3FF" fillOpacity="0.13" />
              <Circle cx="4%" cy="122%" r="94" fill="#7C9CFF" fillOpacity="0.15" />
            </Svg>
            <View style={styles.identityTop}>
              <Text style={styles.identityEyebrow}>{!isAdministrator && profile?.role === 'teacher' ? 'TEACHER PROFILE' : 'ATOMYX IDENTITY'}</Text>
              <View style={styles.identityMark}><Ionicons name="scan-outline" size={16} color={COLORS.champagne} /></View>
            </View>
            <View style={styles.profileHero}>
              <View style={styles.avatar}>
                <Animated.View pointerEvents="none" style={[styles.avatarGlow, avatarGlowStyle]} />
                <Text style={styles.avatarText}>{initials(profile?.full_name, profile?.email)}</Text>
              </View>
              <View style={styles.profileCopy}><Text style={styles.name}>{profile?.full_name || 'Your profile'}</Text><Text style={styles.email}>{profile?.email || user?.email || 'Email unavailable'}</Text></View>
            </View>
            <View style={styles.identityBottom}>
              <View style={styles.rolePill}><View style={styles.roleDot} /><Text style={styles.roleText}>{isAdministrator ? 'ADMIN' : profile?.role === 'teacher' ? 'TEACHER' : 'STUDENT'}</Text></View>
              <Text style={styles.identityFooter}>{isAdministrator ? 'ATOMYX ADMINISTRATOR' : profile?.role === 'teacher' ? 'TEACHER ACCOUNT' : 'STUDENT ACCESS PASS'}</Text>
            </View>
            {isAdministrator ? (
              <View style={styles.adminIdentityBadge}>
                <Ionicons name="shield-checkmark" size={14} color="#FFFFFF" />
                <Text style={styles.adminIdentityBadgeText}>ADMIN ACCESS</Text>
              </View>
            ) : profile?.role === 'teacher' ? (
              <View style={styles.teacherIdentityBadge}>
                <Ionicons name="school-outline" size={14} color="#FFFFFF" />
                <Text style={styles.adminIdentityBadgeText}>TEACHER ACCESS</Text>
              </View>
            ) : profile?.role === 'student' && (
              <View style={styles.studentIdRow}>
                <View><Text style={styles.identityFooter}>STUDENT ID</Text><Text selectable style={styles.studentId}>{profile.id}</Text></View>
                <Pressable accessibilityRole="button" accessibilityLabel={copiedId ? 'ID copied' : Platform.OS === 'web' ? 'Copy student ID' : 'Share student ID'} onPress={handleCopyId} style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}>
                  <Ionicons name={copiedId ? 'checkmark' : Platform.OS === 'web' ? 'copy-outline' : 'share-outline'} size={15} color="#FFFFFF" />
                  <Text style={styles.copyButtonText}>{copiedId ? 'Copied' : Platform.OS === 'web' ? 'Copy ID' : 'Share ID'}</Text>
                </Pressable>
              </View>
            )}
          </View>

          {loadError && <View style={styles.messageCard}><Ionicons name="alert-circle-outline" size={18} color={COLORS.danger} /><Text style={styles.messageText}>{loadError}</Text><Pressable accessibilityRole="button" onPress={loadProfile} style={styles.retryButton}><Text style={styles.retryText}>Retry</Text></Pressable></View>}
          {!isAdministrator && profile?.role === 'student' && studentInsights && <StudentInsightsCard insights={studentInsights} />}
          {profile?.role === 'teacher' && teacherOverview && <TeacherOverviewCard overview={teacherOverview} />}

          <View style={styles.accountCard}>
            <View style={styles.accountHeading}><View><Text style={styles.accountEyebrow}>ACCOUNT CENTER</Text><Text style={styles.accountTitle}>Your information</Text></View><Ionicons name="options-outline" size={18} color={COLORS.primary} /></View>
            <View style={styles.divider} />

            <Text style={styles.label}>DISPLAY NAME</Text>
            {editing ? (
              <View style={styles.editRow}>
                <TextInput style={styles.input} value={draftName} onChangeText={setDraftName} placeholder="Your name" placeholderTextColor={COLORS.textSecondary} maxLength={80} editable={!saving} autoFocus />
                <Pressable accessibilityRole="button" style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]} onPress={handleSaveName} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="checkmark" size={20} color="#FFFFFF" />}
                </Pressable>
              </View>
            ) : (
              <Pressable accessibilityRole="button" onPress={() => { setActionMessage(null); setEditing(true); }} style={({ pressed }) => [styles.nameRow, pressed && styles.pressed]}>
                <Text style={styles.value}>{profile?.full_name || 'Tap to add your name'}</Text>
                <View style={styles.editIcon}><Ionicons name="create-outline" size={17} color={COLORS.champagne} /></View>
              </Pressable>
            )}

            <Text style={styles.label}>EMAIL</Text>
            <View style={styles.readonlyRow}><Ionicons name="mail-outline" size={17} color={COLORS.textMuted} /><Text style={styles.value}>{profile?.email || user?.email || 'Email unavailable'}</Text></View>

            <Text style={styles.label}>PROFILE ROLE</Text>
            <View style={styles.readonlyRow}><Ionicons name={profile?.role === 'teacher' ? 'school-outline' : 'person-outline'} size={17} color={COLORS.textMuted} /><Text style={styles.value}>{isAdministrator ? 'Admin' : profile?.role === 'teacher' ? 'Teacher' : 'Student'}</Text></View>
            {profile?.role === 'teacher' && <><Text style={styles.label}>ACCOUNT ID</Text><View style={styles.readonlyRow}><Ionicons name="finger-print-outline" size={17} color={COLORS.textMuted} /><Text selectable style={styles.valueSmall}>{profile.id}</Text></View></>}
            {actionMessage && <View style={[styles.actionMessage, actionMessage.isError && styles.actionMessageError]}><Ionicons name={actionMessage.isError ? 'alert-circle-outline' : 'checkmark-circle-outline'} size={17} color={actionMessage.isError ? COLORS.danger : COLORS.success} /><Text style={[styles.actionMessageText, actionMessage.isError && styles.actionMessageErrorText]}>{actionMessage.text}</Text></View>}
          </View>
          {isAdministrator && (
            <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/admin')} style={({ pressed }) => [styles.adminConsoleLink, pressed && styles.pressed]}>
              <View style={styles.adminConsoleLinkIcon}><Ionicons name="shield-checkmark-outline" size={19} color={COLORS.primary} /></View>
              <View style={styles.adminConsoleLinkCopy}><Text style={styles.adminConsoleLinkTitle}>Open Admin Console</Text><Text style={styles.adminConsoleLinkSubtitle}>Manage users, events, and campus activity</Text></View>
              <Ionicons name="arrow-forward" size={17} color={COLORS.primary} />
            </Pressable>
          )}
          {isAdministrator === false && profile?.role === 'teacher' && (
            <Pressable accessibilityRole="button" onPress={() => router.push('/teacher')} style={({ pressed }) => [styles.adminConsoleLink, pressed && styles.pressed]}>
              <View style={styles.adminConsoleLinkIcon}><Ionicons name="school-outline" size={19} color={COLORS.primary} /></View>
              <View style={styles.adminConsoleLinkCopy}><Text style={styles.adminConsoleLinkTitle}>Open Teacher Workspace</Text><Text style={styles.adminConsoleLinkSubtitle}>Manage your events, attendance, and requests</Text></View>
              <Ionicons name="arrow-forward" size={17} color={COLORS.primary} />
            </Pressable>
          )}
          {profile && (
            <>
            {isAdministrator === false && (
              <TeacherAccessCard
                showForm={profile.role === 'student'}
                profileRole={profile.role}
                requests={teacherRequests}
                reason={teacherRequestReason}
                onReasonChange={setTeacherRequestReason}
                loading={workflowLoading}
                busy={workflowBusy}
                error={requestWorkflowError}
                message={workflowMessage}
                onSubmit={handleTeacherRequest}
                onWithdraw={handleWithdrawTeacherRequest}
                onRetry={() => void refreshWorkflow()}
              />
            )}
            {isAdministrator === null && membershipError && (
              <View style={styles.messageCard}>
                <Ionicons name="alert-circle-outline" size={18} color={COLORS.danger} />
                <Text style={styles.messageText}>{membershipError}</Text>
                <Pressable accessibilityRole="button" onPress={loadProfile} style={styles.retryButton}><Text style={styles.retryText}>Retry</Text></Pressable>
              </View>
            )}
            </>
          )}
          {(isAdministrator || profile.role === 'teacher') && (
            <NotificationsCard
              notifications={notifications}
              loading={workflowLoading}
              error={notificationsError}
              onMarkRead={handleReadNotification}
              onRetry={() => { void loadProfile(); }}
            />
          )}
          </EntranceView>
        )}

        {profile && <EntranceView delay={180}>
        <View style={styles.signOutSection}>
          <View style={styles.securityNote}><Ionicons name="shield-checkmark-outline" size={17} color={COLORS.primary} /><Text style={styles.securityText}>Your account is protected by your ATOMYX sign-in.</Text></View>
          <AppButton title={signingOut ? 'Signing Out...' : 'Sign Out'} icon="log-out-outline" onPress={handleSignOut} disabled={signingOut} />
        </View>
        </EntranceView>}
      </ScrollView>
    </View>
  );
}

function initials(name: string | null | undefined, email: string | null | undefined) {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (words.length > 1) return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  return (words[0]?.[0] ?? email?.[0] ?? '?').toUpperCase();
}

function TeacherAccessCard({
  showForm,
  profileRole,
  requests,
  reason,
  onReasonChange,
  loading,
  busy,
  error,
  message,
  onSubmit,
  onWithdraw,
  onRetry,
}: {
  showForm: boolean;
  profileRole: Role;
  requests: TeacherAccessRequest[];
  reason: string;
  onReasonChange: (value: string) => void;
  loading: boolean;
  busy: boolean;
  error: string | null;
  message: string | null;
  onSubmit: () => void;
  onWithdraw: (requestId: string) => void;
  onRetry: () => void;
}) {
  const sortedRequests = [...requests].sort((first, second) => (
    parseRequestDate(second.requested_at) - parseRequestDate(first.requested_at)
  ));
  const latestRequest = sortedRequests[0] ?? null;
  const hasPending = sortedRequests.some((request) => request.status === 'pending');
  return (
    <View style={styles.workflowCard}>
      <View style={styles.sectionHeading}>
        <View><Text style={styles.sectionEyebrow}>ROLE ACCESS</Text><Text style={styles.sectionTitle}>{showForm ? 'Teacher access request' : 'Teacher request history'}</Text></View>
        <Ionicons name="school-outline" size={19} color={COLORS.primary} />
      </View>
      {loading ? <ActivityIndicator color={COLORS.primary} /> : latestRequest && (
        <TeacherRequestStatusPanel request={latestRequest} profileRole={profileRole} />
      )}
      {showForm && !loading && (hasPending ? (
        <View style={styles.workflowNotice}>
          <Text style={styles.workflowStatus}>A request is pending review.</Text>
          <Text style={styles.workflowDescription}>A second pending request cannot be submitted.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.workflowDescription}>Submit a reason for administrator review. Your account remains a student until an authorized decision is recorded.</Text>
          <TextInput
            style={[styles.input, styles.workflowReason]}
            value={reason}
            onChangeText={onReasonChange}
            placeholder="Why do you need teacher access?"
            placeholderTextColor={COLORS.textSecondary}
            multiline
            maxLength={1000}
            editable={!busy}
          />
          <Pressable accessibilityRole="button" disabled={busy || reason.trim().length < 3} onPress={onSubmit} style={[styles.workflowButton, (busy || reason.trim().length < 3) && styles.workflowButtonDisabled]}>
            {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.workflowButtonText}>Submit request</Text>}
          </Pressable>
        </>
      ))}
      {error && <><Text accessibilityRole="alert" style={styles.workflowError}>{error}</Text><Pressable accessibilityRole="button" onPress={onRetry} style={styles.workflowSecondaryButton}><Text style={styles.workflowSecondaryText}>Retry</Text></Pressable></>}
      {message && <Text style={styles.workflowSuccess}>{message}</Text>}
      <View style={styles.requestHistoryHeading}><Text style={styles.sectionEyebrow}>REQUEST HISTORY</Text>{sortedRequests.length > 0 && <Text style={styles.requestCount}>{sortedRequests.length}</Text>}</View>
      {!loading && !error && sortedRequests.length === 0 ? <Text style={styles.workflowDescription}>No teacher access requests yet.</Text> : !error && sortedRequests.map((request) => (
        <View key={request.id} style={styles.workflowRow}>
          <View style={styles.requestHistoryTopline}>
            <Text style={styles.requestHistoryTitle}>Teacher access request</Text>
            <TeacherRequestStatusBadge status={request.status} />
          </View>
          <Text style={styles.workflowDescription}>{request.reason}</Text>
          <Text style={styles.workflowMeta}>Submitted {formatRequestDate(request.requested_at)}</Text>
          {request.reviewed_at && <Text style={styles.workflowMeta}>Reviewed {formatRequestDate(request.reviewed_at)}{request.reviewer_id ? ` · Reviewer ${shortenRequestId(request.reviewer_id)}` : ''}</Text>}
          {request.decision_reason && <Text style={styles.requestDecision}><Text style={styles.requestDecisionLabel}>Administrator decision: </Text>{request.decision_reason}</Text>}
          {request.status === 'pending' && <Pressable accessibilityRole="button" disabled={busy} style={styles.workflowSecondaryButton} onPress={() => onWithdraw(request.id)}><Text style={styles.workflowSecondaryText}>Withdraw request</Text></Pressable>}
        </View>
      ))}
    </View>
  );
}

function TeacherRequestStatusPanel({ request, profileRole }: { request: TeacherAccessRequest; profileRole: Role }) {
  const statusDisplay = teacherRequestStatusDisplay(request.status);
  return (
    <View style={[styles.requestStatusPanel, statusDisplay.panelStyle]}>
      <View style={styles.requestStatusHeader}>
        <View style={[styles.requestStatusIcon, statusDisplay.iconStyle]}>
          <Ionicons name={statusDisplay.icon} size={22} color={statusDisplay.color} />
        </View>
        <View style={styles.requestStatusCopy}>
          <TeacherRequestStatusBadge status={request.status} />
          <Text style={[styles.requestStatusMessage, statusDisplay.messageStyle]}>{statusDisplay.message}</Text>
        </View>
      </View>
      <Text style={styles.requestStatusMeta}>Submitted {formatRequestDate(request.requested_at)}</Text>
      {request.status === 'pending' && (
        <Text style={styles.requestStatusDescription}>Your account remains a student while the request awaits an authorized decision.</Text>
      )}
      {request.status === 'approved' && (
        <>
          <Text style={styles.requestStatusMeta}>Approved {request.reviewed_at ? formatRequestDate(request.reviewed_at) : 'Date unavailable'}</Text>
          <Text style={styles.requestStatusDescription}>
            {profileRole === 'teacher'
              ? 'Teacher access is active for this account.'
              : 'Approval is recorded. Your current profile role remains Student.'}
          </Text>
        </>
      )}
      {request.status === 'declined' && (
        <>
          {request.decision_reason ? (
            <View style={styles.requestDecisionPanel}>
              <Text style={styles.requestDecisionPanelLabel}>Administrator’s decision</Text>
              <Text style={styles.requestDecisionPanelText}>{request.decision_reason}</Text>
            </View>
          ) : <Text style={styles.requestStatusDescription}>No decision reason was provided.</Text>}
          <Text style={styles.requestStatusMeta}>Reviewed {request.reviewed_at ? formatRequestDate(request.reviewed_at) : 'Date unavailable'}</Text>
          {request.reviewer_id && <Text style={styles.requestStatusMeta}>Reviewer ID {shortenRequestId(request.reviewer_id)}</Text>}
          <Text style={styles.requestStatusNextStep}>Review the decision reason. You can submit a new request when ready.</Text>
        </>
      )}
    </View>
  );
}

function TeacherRequestStatusBadge({ status }: { status: TeacherAccessRequest['status'] }) {
  const display = teacherRequestStatusDisplay(status);
  return (
    <View style={[styles.requestStatusBadge, display.badgeStyle]}>
      <Text style={[styles.requestStatusBadgeText, display.badgeTextStyle]}>{display.label}</Text>
    </View>
  );
}

function teacherRequestStatusDisplay(status: TeacherAccessRequest['status']) {
  switch (status) {
    case 'pending':
      return {
        label: 'PENDING',
        message: 'Waiting for administrator review.',
        icon: 'time-outline' as const,
        color: COLORS.warning,
        panelStyle: styles.requestPendingPanel,
        iconStyle: styles.requestPendingIcon,
        badgeStyle: styles.requestPendingBadge,
        badgeTextStyle: styles.requestPendingText,
        messageStyle: styles.requestPendingText,
      };
    case 'approved':
      return {
        label: 'APPROVED',
        message: 'Your teacher access request has been approved.',
        icon: 'checkmark-circle-outline' as const,
        color: COLORS.success,
        panelStyle: styles.requestApprovedPanel,
        iconStyle: styles.requestApprovedIcon,
        badgeStyle: styles.requestApprovedBadge,
        badgeTextStyle: styles.requestApprovedText,
        messageStyle: styles.requestApprovedText,
      };
    case 'declined':
      return {
        label: 'DECLINED',
        message: 'Your teacher access request was declined.',
        icon: 'alert-circle-outline' as const,
        color: COLORS.danger,
        panelStyle: styles.requestDeclinedPanel,
        iconStyle: styles.requestDeclinedIcon,
        badgeStyle: styles.requestDeclinedBadge,
        badgeTextStyle: styles.requestDeclinedText,
        messageStyle: styles.requestDeclinedText,
      };
    case 'withdrawn':
      return {
        label: 'WITHDRAWN',
        message: 'This teacher access request was withdrawn.',
        icon: 'close-circle-outline' as const,
        color: COLORS.textSecondary,
        panelStyle: styles.requestNeutralPanel,
        iconStyle: styles.requestNeutralIcon,
        badgeStyle: styles.requestNeutralBadge,
        badgeTextStyle: styles.requestNeutralText,
        messageStyle: styles.requestNeutralText,
      };
    case 'cancelled':
      return {
        label: 'CANCELLED',
        message: 'This teacher access request was cancelled.',
        icon: 'close-circle-outline' as const,
        color: COLORS.textSecondary,
        panelStyle: styles.requestNeutralPanel,
        iconStyle: styles.requestNeutralIcon,
        badgeStyle: styles.requestNeutralBadge,
        badgeTextStyle: styles.requestNeutralText,
        messageStyle: styles.requestNeutralText,
      };
  }
}

function parseRequestDate(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function formatRequestDate(value: string): string {
  const timestamp = parseRequestDate(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : 'Date unavailable';
}

function shortenRequestId(value: string): string {
  if (value.length <= 20) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function NotificationsCard({
  notifications,
  loading,
  error,
  onMarkRead,
  onRetry,
}: {
  notifications: InAppNotification[];
  loading: boolean;
  error: string | null;
  onMarkRead: (notificationId: string) => void;
  onRetry: () => void;
}) {
  return (
    <View style={styles.workflowCard}>
      <View style={styles.sectionHeading}>
        <View><Text style={styles.sectionEyebrow}>ACCOUNT UPDATES</Text><Text style={styles.sectionTitle}>Notifications</Text></View>
        <Ionicons name="notifications-outline" size={19} color={COLORS.primary} />
      </View>
      {loading ? <ActivityIndicator color={COLORS.primary} /> : error ? (
        <><Text accessibilityRole="alert" style={styles.workflowError}>{error}</Text><Pressable accessibilityRole="button" onPress={onRetry} style={styles.workflowSecondaryButton}><Text style={styles.workflowSecondaryText}>Retry</Text></Pressable></>
      ) : notifications.length === 0 ? (
        <Text style={styles.workflowDescription}>No notifications.</Text>
      ) : notifications.map((notification) => (
        <View key={notification.id} style={styles.workflowRow}>
          <View style={styles.notificationHeading}>
            <Text style={styles.workflowStatus}>{notification.title}</Text>
            {!notification.read_at && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.workflowDescription}>{notification.body}</Text>
          <Text style={styles.workflowMeta}>{new Date(notification.created_at).toLocaleString()}</Text>
          {!notification.read_at && <Pressable accessibilityRole="button" style={styles.workflowSecondaryButton} onPress={() => onMarkRead(notification.id)}><Text style={styles.workflowSecondaryText}>Mark as read</Text></Pressable>}
        </View>
      ))}
    </View>
  );
}

function StudentInsightsCard({ insights }: { insights: StudentAttendanceInsights }) {
  const maxMonthly = Math.max(...insights.monthlyActivity.map((month) => month.count), 1);
  const hasMonthlyActivity = insights.monthlyActivity.some((month) => month.count > 0);
  const milestones = [
    { count: 1, title: 'First check-in', icon: 'sparkles-outline' as const },
    { count: 5, title: 'Five check-ins', icon: 'ribbon-outline' as const },
    { count: 10, title: 'Ten check-ins', icon: 'trophy-outline' as const },
  ];

  return (
    <>
      <View style={styles.insightCard}>
        <View style={styles.sectionHeading}>
          <View><Text style={[styles.sectionEyebrow, styles.panelEyebrow]}>ATTENDANCE INSIGHTS</Text><Text style={styles.sectionTitle}>Your activity</Text></View>
          <Ionicons name="analytics-outline" size={20} color={COLORS.champagne} />
        </View>
        <View style={styles.panelDivider} />
        <View style={styles.statsRow}>
          <StatTile label="Total" count={insights.total} icon="scan-outline" />
          <StatTile label="Present" count={insights.present} icon="checkmark-circle-outline" />
          <StatTile label="Late" count={insights.late} icon="time-outline" />
        </View>
        {insights.recovered > 0 && <View style={styles.recoveredSummary}><Ionicons name="refresh-outline" size={15} color={COLORS.champagne} /><Text style={styles.recoveredSummaryText}>{insights.recovered} recovered check-in{insights.recovered === 1 ? '' : 's'}</Text></View>}
        <View style={styles.chartHeading}><Text style={styles.chartTitle}>Monthly activity</Text><Text style={styles.chartRange}>LAST 6 MONTHS</Text></View>
        {hasMonthlyActivity ? (
          <View style={styles.chart}>
            {insights.monthlyActivity.map((month) => (
              <View key={month.key} style={styles.chartColumn}>
                <Text style={styles.chartCount}>{month.count || ''}</Text>
                <View style={styles.chartTrack}><View style={[styles.chartBar, { height: month.count === 0 ? 4 : Math.max(9, (month.count / maxMonthly) * 57) }]} /></View>
                <Text style={styles.chartLabel}>{month.label}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.chartEmpty}>No check-ins in the last six months.</Text>
        )}
      </View>
      <View style={styles.milestoneCard}>
        <View style={styles.sectionHeading}>
          <View><Text style={[styles.sectionEyebrow, styles.panelEyebrow]}>MILESTONES</Text><Text style={styles.sectionTitle}>Showing up adds up</Text></View>
          <Ionicons name="ribbon-outline" size={20} color={COLORS.champagne} />
        </View>
        <View style={styles.panelDivider} />
        {milestones.map((milestone, index) => {
          const unlocked = insights.total >= milestone.count;
          return (
            <View key={milestone.count} style={[styles.milestoneRow, index === 0 && styles.milestoneRowFirst]}>
              <View style={[styles.milestoneIcon, unlocked && styles.milestoneIconActive]}><Ionicons name={milestone.icon} size={17} color={unlocked ? COLORS.champagne : COLORS.textMuted} /></View>
              <Text style={[styles.milestoneTitle, !unlocked && styles.milestoneTitleLocked]}>{milestone.title}</Text>
              <Ionicons name={unlocked ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={unlocked ? COLORS.success : COLORS.textMuted} />
            </View>
          );
        })}
      </View>
    </>
  );
}

function StatTile({ label, count, icon }: { label: string; count: number; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statIcon}><Ionicons name={icon} size={15} color={COLORS.champagne} /></View>
      <Text style={styles.statCount}>{count}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TeacherOverviewCard({ overview }: { overview: TeacherProfileOverview }) {
  return (
    <View style={styles.insightCard}>
      <View style={styles.sectionHeading}>
        <View><Text style={styles.sectionEyebrow}>TEACHING OVERVIEW</Text><Text style={styles.sectionTitle}>Your active events</Text></View>
        <Ionicons name="school-outline" size={20} color={COLORS.primary} />
      </View>
      <View style={styles.teacherStats}>
        <View style={styles.teacherStat}><Text style={styles.teacherStatCount}>{overview.eventCount}</Text><Text style={styles.teacherStatLabel}>active events</Text></View>
        <View style={styles.teacherStatDivider} />
        <View style={styles.teacherStat}><Text style={styles.teacherStatCount}>{overview.scanCount}</Text><Text style={styles.teacherStatLabel}>total check-ins</Text></View>
      </View>
      {overview.events.length === 0 ? (
        <View style={styles.teacherEmpty}><Ionicons name="calendar-outline" size={18} color={COLORS.textMuted} /><Text style={styles.teacherEmptyText}>No active events yet. Events you create will appear here.</Text></View>
      ) : (
        <View style={styles.teacherEventList}>
          {overview.events.slice(0, 3).map((event) => (
            <View key={event.eventId} style={styles.teacherEventRow}>
              <View style={styles.teacherEventIcon}><Ionicons name="calendar-outline" size={15} color={COLORS.primary} /></View>
              <View style={styles.teacherEventCopy}><Text style={styles.teacherEventTitle}>{event.title}</Text><Text style={styles.teacherEventCode}>{event.eventCode}</Text></View>
              <View style={styles.teacherEventCount}><Text style={styles.teacherEventCountText}>{event.attendeeCount}</Text><Text style={styles.teacherEventCountLabel}>scans</Text></View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flexGrow: 1, paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg, paddingBottom: 136, width: '100%', maxWidth: 580, alignSelf: 'center' },
  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.lg },
  eyebrow: { ...TYPOGRAPHY.label, fontSize: 14, lineHeight: 20, fontFamily: TYPOGRAPHY.semiboldFontFamily, color: COLORS.champagne },
  title: { ...TYPOGRAPHY.screenTitle, fontFamily: TYPOGRAPHY.displayFontFamily, color: COLORS.textPrimary, marginTop: 3 },
  headerIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.glassStrong, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.champagneBorder },
  loadingState: { alignItems: 'center', paddingVertical: SPACE.section },
  subtitle: { fontFamily: TYPOGRAPHY.fontFamily, fontSize: 16, lineHeight: 24, color: COLORS.textSecondary, marginTop: SPACE.sm },
  identityCard: { backgroundColor: '#0A1430', borderRadius: 28, padding: 20, borderWidth: 1, borderColor: 'rgba(124,221,255,0.40)', overflow: 'hidden', shadowColor: COLORS.champagne, shadowOpacity: 0.20, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 4 },
  identityTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 17 },
  identityEyebrow: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 12, letterSpacing: 1.4, color: '#BFF0FF' },
  identityMark: { width: 32, height: 32, borderRadius: 11, backgroundColor: 'rgba(77,227,255,0.16)', borderWidth: 1, borderColor: 'rgba(124,221,255,0.45)', alignItems: 'center', justifyContent: 'center' },
  identityBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(124,221,255,0.24)' },
  identityFooter: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 11, color: 'rgba(214,240,255,0.82)', letterSpacing: 1.1 },
  adminIdentityBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingHorizontal: 12, minHeight: 30, borderRadius: RADIUS.pill, backgroundColor: 'rgba(6,14,38,0.45)', borderWidth: 1, borderColor: 'rgba(124,221,255,0.38)' },
  teacherIdentityBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingHorizontal: 12, minHeight: 30, borderRadius: RADIUS.pill, backgroundColor: 'rgba(77,227,255,0.16)', borderWidth: 1, borderColor: 'rgba(124,221,255,0.38)' },
  adminIdentityBadgeText: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 10, letterSpacing: 1, color: '#EAFBFF' },
  accountCard: { marginTop: 13, backgroundColor: COLORS.glassStrong, borderRadius: 26, padding: SPACE.lg, borderWidth: 1, borderColor: COLORS.glassBorder, shadowColor: COLORS.shadow, shadowOpacity: 0.10, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  adminConsoleLink: { marginTop: 13, minHeight: 76, padding: 14, borderRadius: 21, backgroundColor: COLORS.glassStrong, borderWidth: 1, borderColor: COLORS.glassBorder, flexDirection: 'row', alignItems: 'center', gap: 12 },
  adminConsoleLinkIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: COLORS.primaryTint, alignItems: 'center', justifyContent: 'center' },
  adminConsoleLinkCopy: { flex: 1 },
  adminConsoleLinkTitle: { fontFamily: TYPOGRAPHY.semiboldFontFamily, color: COLORS.textPrimary, fontSize: 14 },
  adminConsoleLinkSubtitle: { fontFamily: TYPOGRAPHY.fontFamily, color: COLORS.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
  accountHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accountEyebrow: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 14, letterSpacing: 0.2, color: COLORS.primary },
  accountTitle: { fontFamily: TYPOGRAPHY.headingFontFamily, fontSize: 20, color: COLORS.textPrimary, marginTop: 2 },
  profileHero: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 22, backgroundColor: 'rgba(77,227,255,0.15)', borderWidth: 1, borderColor: 'rgba(191,240,255,0.75)', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  avatarGlow: { ...StyleSheet.absoluteFillObject, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(191,240,255,0.55)', backgroundColor: 'transparent' },
  avatarText: { fontFamily: TYPOGRAPHY.numberFontFamily, fontSize: 25, color: '#FFFFFF' },
  profileCopy: { flex: 1 },
  name: { fontFamily: TYPOGRAPHY.headingFontFamily, fontSize: 19, letterSpacing: -0.2, color: '#FFFFFF' },
  email: { fontFamily: TYPOGRAPHY.fontFamily, fontSize: 14, lineHeight: 21, color: 'rgba(226,240,255,0.78)', marginTop: 4 },
  rolePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, minHeight: 30, borderRadius: RADIUS.pill, backgroundColor: 'rgba(77,227,255,0.15)', borderWidth: 1, borderColor: 'rgba(124,221,255,0.45)' },
  roleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4DE3FF', marginRight: 6 },
  roleText: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 11, letterSpacing: 0.9, color: '#EAFBFF' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACE.lg },
  label: { ...TYPOGRAPHY.label, fontSize: 14, lineHeight: 20, fontFamily: TYPOGRAPHY.semiboldFontFamily, color: COLORS.textSecondary, marginBottom: 7, marginTop: SPACE.md },
  nameRow: { minHeight: 58, borderRadius: 24, backgroundColor: COLORS.pearl, borderWidth: 1, borderColor: COLORS.pearlBorder, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  value: { flex: 1, fontFamily: TYPOGRAPHY.mediumFontFamily, fontSize: 16, lineHeight: 24, color: COLORS.textPrimary },
  editIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.champagneSoft, borderWidth: 1, borderColor: COLORS.champagneBorder, alignItems: 'center', justifyContent: 'center' },
  editRow: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, minHeight: 58, borderRadius: 19, backgroundColor: COLORS.pearlPanel, borderWidth: 1, borderColor: COLORS.pearlBorder, paddingHorizontal: 13, fontFamily: TYPOGRAPHY.fontFamily, fontSize: 16, color: COLORS.pearlText },
  saveButton: { marginLeft: 8, width: 54, height: 54, borderRadius: 19, backgroundColor: COLORS.primary, borderWidth: 1, borderColor: COLORS.champagneBorder, alignItems: 'center', justifyContent: 'center' },
  readonlyRow: { minHeight: 58, borderRadius: 24, backgroundColor: COLORS.pearl, borderWidth: 1, borderColor: COLORS.pearlBorder, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  valueSmall: { flex: 1, fontFamily: TYPOGRAPHY.fontFamily, fontSize: 14, lineHeight: 21, color: COLORS.textSecondary },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  studentIdRow: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(124,221,255,0.24)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  studentId: { fontFamily: TYPOGRAPHY.mediumFontFamily, fontSize: 13, color: '#FFFFFF', marginTop: 5, letterSpacing: 0.2 },
  copyButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 14, backgroundColor: 'rgba(77,227,255,0.16)', borderWidth: 1, borderColor: 'rgba(124,221,255,0.45)' },
  copyButtonText: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 13, color: '#FFFFFF' },
  insightCard: { marginTop: 15, padding: SPACE.lg, borderRadius: 26, backgroundColor: COLORS.card, borderWidth: 1, borderColor: 'rgba(77,227,255,0.18)', borderTopColor: 'rgba(77,227,255,0.34)', shadowColor: COLORS.champagne, shadowOpacity: 0.10, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 3 },
  milestoneCard: { marginTop: 13, padding: SPACE.lg, borderRadius: 26, backgroundColor: COLORS.card, borderWidth: 1, borderColor: 'rgba(77,227,255,0.18)', borderTopColor: 'rgba(77,227,255,0.34)', shadowColor: COLORS.violet, shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  panelEyebrow: { color: COLORS.champagne },
  panelDivider: { height: 1, backgroundColor: 'rgba(77,227,255,0.16)', marginTop: 16 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionEyebrow: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 14, letterSpacing: 0.2, color: COLORS.primary },
  sectionTitle: { fontFamily: TYPOGRAPHY.headingFontFamily, fontSize: 20, color: COLORS.textPrimary, marginTop: 3 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  statTile: { flex: 1, minHeight: 108, paddingVertical: 14, borderRadius: 20, backgroundColor: COLORS.cardRaised, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(77,227,255,0.18)', shadowColor: COLORS.champagne, shadowOpacity: 0.10, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  statIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: COLORS.champagneSoft, borderWidth: 1, borderColor: 'rgba(77,227,255,0.32)', alignItems: 'center', justifyContent: 'center' },
  statCount: { fontFamily: TYPOGRAPHY.numberFontFamily, fontSize: 23, letterSpacing: -0.4, color: COLORS.textPrimary, marginTop: 7 },
  statLabel: { fontFamily: TYPOGRAPHY.mediumFontFamily, fontSize: 12, letterSpacing: 0.3, color: COLORS.textSecondary, marginTop: 2 },
  recoveredSummary: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, backgroundColor: 'rgba(77,227,255,0.10)', borderWidth: 1, borderColor: 'rgba(77,227,255,0.24)' },
  recoveredSummaryText: { fontFamily: TYPOGRAPHY.mediumFontFamily, fontSize: 13, lineHeight: 19, color: COLORS.champagne },
  chartHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 },
  chartTitle: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 16, color: COLORS.textPrimary },
  chartRange: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 11, letterSpacing: 1, color: COLORS.champagne },
  chart: { height: 124, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', backgroundColor: 'rgba(6,13,36,0.85)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(77,227,255,0.14)', paddingHorizontal: 6, paddingVertical: 8 },
  chartColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  chartCount: { minHeight: 18, fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 13, color: COLORS.primarySoft },
  chartTrack: { height: 59, width: 22, borderRadius: 11, backgroundColor: 'rgba(46,155,255,0.13)', justifyContent: 'flex-end', overflow: 'hidden' },
  chartBar: { width: '100%', borderRadius: 11, backgroundColor: COLORS.champagne },
  chartLabel: { fontFamily: TYPOGRAPHY.mediumFontFamily, fontSize: 12, letterSpacing: 0.2, color: COLORS.textSecondary, marginTop: 6 },
  chartEmpty: { marginTop: 4, paddingVertical: 8, fontFamily: TYPOGRAPHY.fontFamily, fontSize: 14, lineHeight: 20, color: COLORS.textSecondary },
  milestoneRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(77,227,255,0.14)', marginTop: 4, paddingTop: 8, paddingBottom: 4 },
  milestoneRowFirst: { marginTop: 12, paddingTop: 0, borderTopWidth: 0 },
  milestoneIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(110,134,172,0.14)', borderWidth: 1, borderColor: 'rgba(77,227,255,0.14)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  milestoneIconActive: { backgroundColor: COLORS.champagneSoft, borderColor: 'rgba(77,227,255,0.45)' },
  milestoneTitle: { flex: 1, fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 15, lineHeight: 21, color: COLORS.textPrimary },
  milestoneTitleLocked: { color: COLORS.textSecondary },
  teacherStats: { flexDirection: 'row', alignItems: 'center', marginTop: 15, minHeight: 72, borderRadius: 19, backgroundColor: COLORS.primaryTint, borderWidth: 1, borderColor: COLORS.glassBorder },
  teacherStat: { flex: 1, alignItems: 'center' },
  teacherStatCount: { fontFamily: TYPOGRAPHY.numberFontFamily, fontSize: 22, color: COLORS.textPrimary },
  teacherStatLabel: { fontFamily: TYPOGRAPHY.mediumFontFamily, fontSize: 14, color: COLORS.textPrimary, marginTop: 2 },
  teacherStatDivider: { height: 38, width: 1, backgroundColor: COLORS.glassBorder },
  teacherEventList: { marginTop: 12 },
  teacherEventRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.border },
  teacherEventIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: COLORS.primaryTint, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  teacherEventCopy: { flex: 1, paddingRight: 8 },
  teacherEventTitle: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 15, lineHeight: 21, color: COLORS.textPrimary },
  teacherEventCode: { fontFamily: TYPOGRAPHY.fontFamily, fontSize: 14, color: COLORS.textSecondary, marginTop: 3 },
  teacherEventCount: { minWidth: 47, alignItems: 'center' },
  teacherEventCountText: { fontFamily: TYPOGRAPHY.numberFontFamily, fontSize: 14, color: COLORS.primary },
  teacherEventCountLabel: { fontFamily: TYPOGRAPHY.mediumFontFamily, fontSize: 14, color: COLORS.textSecondary },
  teacherEmpty: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 12, padding: 12, borderRadius: 15, backgroundColor: COLORS.pearlDeep },
  teacherEmptyText: { flex: 1, fontFamily: TYPOGRAPHY.fontFamily, fontSize: 15, lineHeight: 22, color: COLORS.textSecondary },
  messageCard: { marginTop: 12, padding: 15, borderRadius: 18, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.glassBorder, alignItems: 'center', gap: 8 },
  messageText: { fontFamily: TYPOGRAPHY.fontFamily, fontSize: 15, lineHeight: 23, textAlign: 'center', color: COLORS.textPrimary },
  retryButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: COLORS.primaryTint },
  retryText: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 15, color: COLORS.primary },
  actionMessage: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 13, padding: 11, borderRadius: 14, backgroundColor: 'rgba(61,180,138,0.10)' },
  actionMessageError: { backgroundColor: 'rgba(201,79,101,0.10)' },
  actionMessageText: { flex: 1, fontFamily: TYPOGRAPHY.fontFamily, fontSize: 14, lineHeight: 21, color: COLORS.success },
  actionMessageErrorText: { color: COLORS.danger },
  workflowCard: { marginTop: 15, padding: SPACE.lg, borderRadius: 26, backgroundColor: COLORS.glassStrong, borderWidth: 1, borderColor: COLORS.glassBorder, gap: 9 },
  workflowDescription: { fontFamily: TYPOGRAPHY.fontFamily, fontSize: 15, lineHeight: 23, color: COLORS.textSecondary },
  workflowReason: { minHeight: 88, textAlignVertical: 'top', paddingTop: 12 },
  workflowButton: { minHeight: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 14 },
  workflowButtonDisabled: { opacity: 0.55 },
  workflowButtonText: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 15, color: '#FFFFFF' },
  workflowSecondaryButton: { minHeight: 46, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: COLORS.primaryTint },
  workflowSecondaryText: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 14, color: COLORS.primary },
  workflowNotice: { padding: 11, borderRadius: 14, backgroundColor: COLORS.primaryTint },
  workflowStatus: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 15, color: COLORS.textPrimary },
  workflowMeta: { fontFamily: TYPOGRAPHY.fontFamily, fontSize: 14, lineHeight: 21, color: COLORS.textSecondary },
  workflowRow: { borderTopWidth: 1, borderTopColor: COLORS.glassBorder, paddingTop: 10, gap: 5 },
  requestStatusPanel: { borderWidth: 1, borderRadius: 18, padding: 13, gap: 8 },
  requestPendingPanel: { backgroundColor: 'rgba(183,123,50,0.08)', borderColor: 'rgba(183,123,50,0.25)' },
  requestApprovedPanel: { backgroundColor: 'rgba(37,136,117,0.08)', borderColor: 'rgba(37,136,117,0.24)' },
  requestDeclinedPanel: { backgroundColor: 'rgba(201,79,101,0.08)', borderColor: 'rgba(201,79,101,0.25)' },
  requestNeutralPanel: { backgroundColor: COLORS.backgroundDeep, borderColor: COLORS.glassBorder },
  requestStatusHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  requestStatusIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  requestPendingIcon: { backgroundColor: 'rgba(183,123,50,0.12)' },
  requestApprovedIcon: { backgroundColor: 'rgba(37,136,117,0.12)' },
  requestDeclinedIcon: { backgroundColor: 'rgba(201,79,101,0.12)' },
  requestNeutralIcon: { backgroundColor: COLORS.glassStrong },
  requestStatusCopy: { flex: 1, minWidth: 0, gap: 5 },
  requestStatusBadge: { alignSelf: 'flex-start', borderRadius: RADIUS.pill, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 },
  requestStatusBadgeText: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 11, letterSpacing: 0.35 },
  requestPendingBadge: { backgroundColor: 'rgba(183,123,50,0.10)', borderColor: 'rgba(183,123,50,0.27)' },
  requestPendingText: { color: COLORS.warning },
  requestApprovedBadge: { backgroundColor: 'rgba(37,136,117,0.10)', borderColor: 'rgba(37,136,117,0.25)' },
  requestApprovedText: { color: COLORS.success },
  requestDeclinedBadge: { backgroundColor: 'rgba(201,79,101,0.10)', borderColor: 'rgba(201,79,101,0.25)' },
  requestDeclinedText: { color: COLORS.danger },
  requestNeutralBadge: { backgroundColor: COLORS.glassStrong, borderColor: COLORS.glassBorder },
  requestNeutralText: { color: COLORS.textSecondary },
  requestStatusMessage: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 15, lineHeight: 21 },
  requestStatusDescription: { fontFamily: TYPOGRAPHY.fontFamily, fontSize: 14, lineHeight: 20, color: COLORS.textSecondary },
  requestStatusMeta: { fontFamily: TYPOGRAPHY.mediumFontFamily, fontSize: 13, lineHeight: 19, color: COLORS.textSecondary },
  requestDecisionPanel: { padding: 10, borderRadius: 13, backgroundColor: 'rgba(201,79,101,0.08)', borderWidth: 1, borderColor: 'rgba(201,79,101,0.17)' },
  requestDecisionPanelLabel: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 12, color: COLORS.danger, marginBottom: 3 },
  requestDecisionPanelText: { fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 15, lineHeight: 21, color: COLORS.textPrimary },
  requestStatusNextStep: { fontFamily: TYPOGRAPHY.mediumFontFamily, fontSize: 14, lineHeight: 20, color: COLORS.textPrimary },
  requestHistoryHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  requestCount: { minWidth: 22, textAlign: 'center', overflow: 'hidden', borderRadius: RADIUS.pill, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: COLORS.primaryTint, color: COLORS.primary, fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 11 },
  requestHistoryTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 7 },
  requestHistoryTitle: { flex: 1, minWidth: 120, fontFamily: TYPOGRAPHY.semiboldFontFamily, fontSize: 14, color: COLORS.textPrimary },
  requestDecision: { fontFamily: TYPOGRAPHY.fontFamily, fontSize: 14, lineHeight: 20, color: COLORS.textPrimary },
  requestDecisionLabel: { fontFamily: TYPOGRAPHY.semiboldFontFamily, color: COLORS.textSecondary },
  notificationHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  workflowError: { fontFamily: TYPOGRAPHY.mediumFontFamily, fontSize: 14, lineHeight: 21, color: COLORS.danger },
  workflowSuccess: { fontFamily: TYPOGRAPHY.mediumFontFamily, fontSize: 14, lineHeight: 21, color: COLORS.success },
  securityNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 13, paddingHorizontal: 10 },
  securityText: { fontFamily: TYPOGRAPHY.fontFamily, fontSize: 14, lineHeight: 21, color: COLORS.textSecondary },
  signOutSection: { marginTop: SPACE.lg },
});
