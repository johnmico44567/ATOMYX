import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { COLORS } from '@/constants/colors';

interface AmbientBackgroundProps {
  style?: object;
  variant?: 'default' | 'compact';
  graphicSide?: 'left' | 'right';
}

export default function AmbientBackground({
  style,
  variant = 'default',
  graphicSide = 'right',
}: AmbientBackgroundProps) {
  const compact = variant === 'compact';
  const isFocused = useIsFocused();
  const drift = useSharedValue(0);
  const breathing = useSharedValue(0);

  useEffect(() => {
    let mounted = true;
    const start = (reduced: boolean) => {
      if (reduced || !isFocused) {
        drift.value = 0;
        breathing.value = 0;
        return;
      }
      drift.value = withRepeat(withTiming(1, { duration: 14000 }), -1, true);
      breathing.value = withRepeat(withTiming(1, { duration: 7200 }), -1, true);
    };
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', start);
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (mounted) start(reduced);
    });
    return () => {
      mounted = false;
      subscription.remove();
      drift.value = withTiming(0, { duration: 0 });
      breathing.value = withTiming(0, { duration: 0 });
    };
  }, [breathing, drift, isFocused]);

  const orbOne = useAnimatedStyle(() => ({
    transform: [{ translateX: -18 + drift.value * 36 }, { translateY: 12 - drift.value * 24 }, { scale: 0.94 + drift.value * 0.12 }],
    opacity: 0.15 + breathing.value * 0.08,
  }));
  const orbTwo = useAnimatedStyle(() => ({
    transform: [{ translateX: 20 - drift.value * 40 }, { translateY: -12 + drift.value * 30 }, { scale: 1.04 - drift.value * 0.10 }],
    opacity: 0.15 + breathing.value * 0.07,
  }));
  const orbThree = useAnimatedStyle(() => ({
    transform: [{ translateX: -12 + drift.value * 24 }, { translateY: 10 - drift.value * 20 }, { scale: 0.96 + drift.value * 0.08 }],
    opacity: 0.07 + breathing.value * 0.05,
  }));
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, style]}>
      <View style={styles.base} />
      <Animated.View style={[styles.orb, styles.orbOne, orbOne]} />
      <Animated.View style={[styles.orb, styles.orbTwo, graphicSide === 'left' ? styles.orbTwoRight : styles.orbTwoLeft, orbTwo]} />
      <Animated.View style={[styles.orb, styles.orbThree, orbThree]} />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
        <Defs>
          <RadialGradient id="violet" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={COLORS.violet} stopOpacity="0.24" />
            <Stop offset="60%" stopColor={COLORS.primary} stopOpacity="0.08" />
            <Stop offset="100%" stopColor={COLORS.primary} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="cyan" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={COLORS.cyan} stopOpacity="0.18" />
            <Stop offset="65%" stopColor={COLORS.cyan} stopOpacity="0.04" />
            <Stop offset="100%" stopColor={COLORS.cyan} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="magenta" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#B9C9FF" stopOpacity="0.24" />
            <Stop offset="65%" stopColor="#B9C9FF" stopOpacity="0.05" />
            <Stop offset="100%" stopColor={COLORS.champagne} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="blue" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#91ACEE" stopOpacity="0.12" />
            <Stop offset="100%" stopColor="#91ACEE" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={compact ? '94%' : '90%'} cy="5%" r={compact ? '38%' : '44%'} fill="url(#violet)" />
        <Circle cx="4%" cy={compact ? '94%' : '96%'} r={compact ? '38%' : '44%'} fill="url(#cyan)" />
        <Circle cx={compact ? '8%' : '12%'} cy={compact ? '14%' : '18%'} r={compact ? '31%' : '36%'} fill="url(#magenta)" />
        <Circle cx={compact ? '88%' : '80%'} cy={compact ? '74%' : '76%'} r={compact ? '31%' : '35%'} fill="url(#blue)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.backgroundDeep },
  orb: { position: 'absolute', borderRadius: 999 },
  orbOne: { width: 220, height: 220, top: -120, right: -100, backgroundColor: 'rgba(46,155,255,0.16)' },
  orbTwo: { width: 190, height: 190, bottom: 70, backgroundColor: 'rgba(77,227,255,0.13)' },
  orbTwoLeft: { left: -100 },
  orbTwoRight: { right: -100 },
  orbThree: { width: 130, height: 130, top: '40%', right: -80, backgroundColor: 'rgba(124,156,255,0.14)' },
});
