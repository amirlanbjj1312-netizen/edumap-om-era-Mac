import { Pressable, Text, View } from 'react-native';
import React from 'react';

const Button = ({
  onPrimaryBtnPress,
  primaryBtnText,
  showSecondaryBtn = true,
  secondaryBtnText1,
  secondaryBtnText2,
  onSecondaryBtnPress,
  showTertiaryBtn = false,
  tertiaryBtnText,
  onTertiaryBtnPress,
  secondaryTextColorClass = 'text-darkGrayText',
  secondaryHighlightColorClass = 'text-bgPurple',
  tertiaryTextColorClass = 'text-darkGrayText',
}) => {
  return (
    <View className="flex flex-col items-center gap-6">
      {/** ====================== Main Button ============================= */}
      <Pressable
        onPress={onPrimaryBtnPress}
        className="py-3 bg-bgPurple px-7 rounded-xl w-[267px] max-h-[61px] flex items-center justify-center"
      >
        <Text className="text-xl font-exoSemibold text-center text-bgWhite">
          {primaryBtnText}
        </Text>
      </Pressable>
      {/** ====================== Secondary pressable ============================= */}
      {showSecondaryBtn ? (
        <View className="flex-row justify-center">
          <Text className={`font-exo text-lg ${secondaryTextColorClass}`}>
            {secondaryBtnText1}{' '}
          </Text>
          <Pressable onPress={onSecondaryBtnPress}>
            <Text
              className={`font-exo text-lg ${secondaryHighlightColorClass}`}
            >
              {secondaryBtnText2}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {/** ====================== Tertiary pressable ============================= */}
      {showTertiaryBtn ? (
        <Pressable onPress={onTertiaryBtnPress}>
          <Text
            className={`font-exo text-lg underline ${tertiaryTextColorClass}`}
          >
            {tertiaryBtnText}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
};

export default Button;
