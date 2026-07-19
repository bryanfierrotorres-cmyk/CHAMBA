import React, { useCallback, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

/**
 * HOC que hace aparecer el contenido de una pantalla con un fade suave cada vez
 * que gana foco (cambio entre tabs). bottom-tabs v6 no anima el cambio de tab,
 * así que este wrapper evita el corte "de golpe". Aplicar a nivel de módulo.
 */
export function withScreenFade<P extends object>(
  Component: React.ComponentType<P>,
): React.FC<P> {
  const Faded: React.FC<P> = (props) => {
    const opacity = useRef(new Animated.Value(0)).current;

    useFocusEffect(
      useCallback(() => {
        opacity.stopAnimation();
        opacity.setValue(0);
        const anim = Animated.timing(opacity, {
          toValue: 1,
          duration: 240,
          useNativeDriver: true,
        });
        anim.start();
        return () => anim.stop();
      }, [opacity]),
    );

    return (
      <Animated.View style={[styles.fill, { opacity }]}>
        <Component {...props} />
      </Animated.View>
    );
  };

  Faded.displayName = `withScreenFade(${Component.displayName ?? Component.name ?? 'Screen'})`;
  return Faded;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
