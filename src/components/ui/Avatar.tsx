import { Image } from 'expo-image';
import React from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from './Text';

interface AvatarProps {
  name: string;
  uri?: string | null;
  size?: number;
  simulated?: boolean;
  ring?: boolean;
}

export function Avatar({ name, uri, size = 48, simulated, ring }: AvatarProps) {
  const { colors } = useTheme();
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <View
      accessibilityLabel={`${name}${simulated ? ' (simulated partner)' : ''}`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: ring ? 3 : 0,
        borderColor: colors.surface,
      }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" accessibilityIgnoresInvertColors />
      ) : (
        <Txt style={{ color: colors.primaryStrong, fontSize: size * 0.42, fontWeight: '800', lineHeight: size * 0.5 }}>{initial}</Txt>
      )}
    </View>
  );
}
