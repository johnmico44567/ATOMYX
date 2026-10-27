import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import EntranceView from '@/components/EntranceView';
import { COLORS } from '@/constants/colors';
import { signUp } from '@/lib/auth';
import { AuthError, AuthField, AuthMasthead, AuthShell, auth } from '@/components/AuthUI';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const handleRegister = async () => {
    setError(null);
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) { setError('All fields are required.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      const { data, error: authError } = await signUp(email.trim(), password, { full_name: fullName.trim() });
      if (authError) setError(authError.message);
      else if (!data.session) setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.');
    } finally { setLoading(false); }
  };

  const field = (key: string, icon: keyof typeof Ionicons.glyphMap, label: string, node: React.ReactNode) => (
    <AuthField label={label} icon={icon} focused={focused === key}>{node}</AuthField>
  );

  return (
    <AuthShell topInset={insets.top} bottomInset={insets.bottom}>
      <AuthMasthead pill="SECURE" />
      <EntranceView delay={70}>
        <Text style={auth.display}>Join the{'\n'}uplink.</Text>
        <Text style={auth.lede}>Create your ATOMYX identity once — then check in everywhere on campus.</Text>
      </EntranceView>
      <EntranceView delay={130}>
        <View style={auth.console}>
          <View style={auth.consoleBar}>
            <View style={auth.lights}><View style={[auth.light, { backgroundColor: '#FF6B8A' }]} /><View style={[auth.light, { backgroundColor: '#FFB84D' }]} /><View style={[auth.light, { backgroundColor: '#3DDC97' }]} /></View>
            <Text style={auth.consoleTitle}>IDENTITY FORGE</Text>
            <Ionicons name="finger-print-outline" size={15} color={COLORS.textMuted} />
          </View>
          {success ? (
            <View style={auth.success}>
              <View style={auth.successTile}><Ionicons name="mail-open-outline" size={26} color={COLORS.success} /></View>
              <Text style={auth.successTitle}>Check your email!</Text>
              <Text style={auth.successText}>We sent a confirmation link to {email}. Click the link to verify, then come back and sign in.</Text>
              <Link href="/login" style={auth.switchLink}><Text style={auth.switchLinkText}>Back to Sign In →</Text></Link>
            </View>
          ) : (
            <>
              {field('name', 'person-outline', 'FULL NAME',
                <TextInput style={auth.input} value={fullName} onChangeText={setFullName} placeholder="Ada Lovelace" placeholderTextColor={COLORS.textMuted} editable={!loading} onFocus={() => setFocused('name')} onBlur={() => setFocused(null)} />)}
              {field('email', 'mail-outline', 'CAMPUS EMAIL',
                <TextInput style={auth.input} value={email} onChangeText={setEmail} placeholder="you@campus.edu" placeholderTextColor={COLORS.textMuted} autoCapitalize="none" keyboardType="email-address" editable={!loading} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} />)}
              {field('pw', 'key-outline', 'PASSPHRASE',
                <TextInput style={auth.input} value={password} onChangeText={setPassword} placeholder="At least 6 characters" placeholderTextColor={COLORS.textMuted} secureTextEntry editable={!loading} onFocus={() => setFocused('pw')} onBlur={() => setFocused(null)} />)}
              {field('pw2', 'shield-checkmark-outline', 'CONFIRM PASSPHRASE',
                <TextInput style={auth.input} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter your passphrase" placeholderTextColor={COLORS.textMuted} secureTextEntry editable={!loading} onSubmitEditing={() => { void handleRegister(); }} onFocus={() => setFocused('pw2')} onBlur={() => setFocused(null)} />)}
              {error ? <AuthError message={error} /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign up"
                disabled={loading}
                onPress={() => { void handleRegister(); }}
                style={({ pressed }) => [auth.go, loading && auth.goBusy, pressed && auth.pressed]}
              >
                {loading
                  ? <ActivityIndicator size="small" color="#03101F" />
                  : <><Text style={auth.goText}>Forge identity</Text><Ionicons name="arrow-forward" size={17} color="#03101F" /></>}
              </Pressable>
              <View style={auth.switchRow}>
                <Text style={auth.switchText}>Already have an account?</Text>
                <Link href="/login" style={auth.switchLink}><Text style={auth.switchLinkText}>Sign In →</Text></Link>
              </View>
            </>
          )}
        </View>
      </EntranceView>
    </AuthShell>
  );
}
