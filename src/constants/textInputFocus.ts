import { Platform, type TextStyle } from 'react-native';

/** Estilo web para inputs sin outline azul del navegador (alineado con Stitch). */
export const textInputWebFocusStyle: TextStyle =
  Platform.OS === 'web'
    ? ({ outlineStyle: 'none' } as TextStyle)
    : {};
