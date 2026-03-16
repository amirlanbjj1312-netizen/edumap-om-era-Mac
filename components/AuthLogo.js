import React from 'react';
import { Image } from 'react-native';

const authLogo = require('../assets/branding/auth-logo.png');

export default function AuthLogo({ size = 220, style, offsetY = 0 }) {
  return (
    <Image
      source={authLogo}
      style={[
        {
          width: size,
          height: size,
          alignSelf: 'center',
          transform: [{ translateY: offsetY }],
        },
        style,
      ]}
      resizeMode="contain"
    />
  );
}
