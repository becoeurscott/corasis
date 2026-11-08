import { useReducedMotion } from '@/lib/motion';
import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  const reduced = useReducedMotion();
  return <Stack screenOptions={{ headerShown: false, animation: reduced ? 'none' : 'slide_from_right' }} />;
}
