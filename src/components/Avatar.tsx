import React, { useEffect, useState } from 'react';
import { View, Image, Text, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import { COLORS } from '@constants/theme';
import { isPilotDocumentBypass } from '@constants/pilot';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

const isDisplayableUri = (uri?: string | null): uri is string =>
  !!uri && !isPilotDocumentBypass(uri) && uri.trim().length > 0;

export const Avatar: React.FC<AvatarProps> = ({ uri, name = '?', size = 40, style }) => {
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
  }, [uri]);

  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');

  const imageUri = isDisplayableUri(uri) && !loadFailed ? uri : null;

  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        onError={() => setLoadFailed(true)}
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: COLORS.bg.elevated,
          },
          style as StyleProp<ImageStyle>,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: COLORS.brand[700],
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: COLORS.brand[200],
          fontSize: size * 0.38,
          fontWeight: '700',
        }}
      >
        {initials}
      </Text>
    </View>
  );
};
