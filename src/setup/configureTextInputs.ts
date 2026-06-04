import { Platform, TextInput } from 'react-native';

/**
 * Ajustes globales de TextInput (web: sin spellcheck agresivo, mejor UX en formularios).
 */
if (Platform.OS === 'web') {
  const prev = TextInput.defaultProps ?? {};
  TextInput.defaultProps = {
    ...prev,
    autoCorrect: false,
    spellCheck: false,
  };
}
