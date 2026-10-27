import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import EntranceView from '@/components/EntranceView';
import { COLORS } from '@/constants/colors';
import { signIn } from '@/lib/auth';
import { AuthError, AuthField, AuthMasthead, AuthShell, auth } from '@/components/AuthUI';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);

  const handleLogin = async () => {
    setError(null); setLoading(true);
    try {
      const { error: authError } = await signIn(email.trim(), password);
      if (authError) setError(authError.message);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Unexpected error'); }
    finally { setLoading(false); }
  };

  return (
    <AuthShell topInset={insets.top} bottomInset={insets.bottom}>
      <AuthMasthead pill="ONLINE" />
      <EntranceView delay={70}>
        <Text style={auth.display}>Check in{'\n'}at light speed.</Text>
        <Text style={auth.lede}>One identity for every class, session, and campus event. Sign in to open your console.</Text>
      </EntranceView>
      <EntranceView delay={130}>
        <View style={auth.console}>
          <View style={auth.consoleBar}>
            <View style={auth.lights}><View style={[auth.light, { backgroundColor: '#FF6B8A' }]} /><View style={[auth.light, { backgroundColor: '#FFB84D' }]} /><View style={[auth.light, { backgroundColor: '#3DDC97' }]} /></View>
            <Text style={auth.consoleTitle}>SIGN-IN TERMINAL</Text>
            <Ionicons name="terminal-outline" size={15} color={COLORS.textMuted} />
          </View>
          <AuthField label="CAMPUS EMAIL" icon="mail-outline" focused={focused === 'email'}>
            <TextInput
              style={auth.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@campus.edu"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              
              autoComplete="off"
              importantForAutofill="no"
              editable={!loading}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
            />
          </AuthField>
          <AuthField label="PASSPHRASE" icon="key-outline" focused={focused === 'password'}>
            <TextInput
              style={auth.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your passphrase"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry
              
              autoComplete="off"
              importantForAutofill="no"
              editable={!loading}
              onSubmitEditing={() => { void handleLogin(); }}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
            />
          </AuthField>
          {error ? <AuthError message={error} /> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            disabled={loading}
            onPress={() => { void handleLogin(); }}
            style={({ pressed }) => [auth.go, loading && auth.goBusy, pressed && auth.pressed]}
          >
            {loading
              ? <ActivityIndicator size="small" color="#03101F" />
              : <><Text style={auth.goText}>Enter console</Text><Ionicons name="arrow-forward" size={17} color="#03101F" /></>}
          </Pressable>
          <View style={auth.switchRow}>
            <Text style={auth.switchText}>New to ATOMYX?</Text>
            <Link href="/register" style={auth.switchLink}><Text style={auth.switchLinkText}>Create account →</Text></Link>
          </View>
        </View>
      </EntranceView>
      <EntranceView delay={180}>
        <View style={auth.steps}>
          <View style={auth.step}><Text style={auth.stepN}>01</Text><Text style={auth.stepT}>Scan the class QR</Text></View>
          <View style={auth.step}><Text style={auth.stepN}>02</Text><Text style={auth.stepT}>Confirm check-in</Text></View>
          <View style={auth.step}><Text style={auth.stepN}>03</Text><Text style={auth.stepT}>Synced to ledger</Text></View>
        </View>
      </EntranceView>
    </AuthShell>
  );
}


