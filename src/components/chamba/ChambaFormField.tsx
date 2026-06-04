import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CHAMBA, chambaStyles } from '@constants/chambaUI';
import { textInputWebFocusStyle } from '@constants/textInputFocus';

interface ChambaFormFieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  icon?: keyof typeof Ionicons.glyphMap;
}

export const ChambaFormField: React.FC<ChambaFormFieldProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType = 'default',
  icon,
}) => (
  <View style={styles.wrap}>
    <Text style={chambaStyles.formLabel}>{label}</Text>
    <View style={[chambaStyles.formInputRow, multiline && styles.inputRowTall]}>
      {icon ? <Ionicons name={icon} size={18} color={CHAMBA.muted} style={styles.icon} /> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={CHAMBA.muted}
        multiline={multiline}
        keyboardType={keyboardType}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          textInputWebFocusStyle,
        ]}
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  icon: { marginRight: 8 },
  inputRowTall: { alignItems: 'flex-start', minHeight: 96 },
  input: {
    flex: 1,
    color: CHAMBA.navy,
    fontSize: 15,
    fontWeight: '400',
    paddingVertical: 12,
  },
  inputMultiline: {
    minHeight: 72,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
});
