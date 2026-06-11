import { Platform, TextInput, type TextInputProps } from 'react-native';

/**
 * Ajustes globales de TextInput (web: sin spellcheck agresivo, mejor UX en formularios).
 */
if (Platform.OS === 'web') {
  type TextInputWithDefaults = typeof TextInput & {
    defaultProps?: Partial<TextInputProps>;
  };
  const TextInputComponent = TextInput as TextInputWithDefaults;
  const prev = TextInputComponent.defaultProps ?? {};
  TextInputComponent.defaultProps = {
    ...prev,
    autoCorrect: false,
    spellCheck: false,
  };
}
