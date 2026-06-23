import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Modal,
  Animated,
  StyleSheet,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const { height: SCREEN_H } = Dimensions.get('window');

export const AnimatedBottomSheet: React.FC<Props> = ({ visible, onClose, children }) => {
  const [showModal, setShowModal] = useState(visible);
  
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(SCREEN_H)).current;

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 0.5,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: SCREEN_H,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowModal(false);
      });
    }
  }, [visible, opacityAnim, translateYAnim]);

  if (!showModal) return null;

  return (
    <Modal transparent visible={showModal} animationType="none" onRequestClose={onClose}>
      <View style={styles.overlayContainer}>
        {/* Dark Backdrop */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]} />
        </TouchableWithoutFeedback>

        {/* Bottom Sheet Content */}
        <Animated.View
          style={[
            styles.sheetContainer,
            { transform: [{ translateY: translateYAnim }] },
          ]}
        >
          <View style={styles.dragHandle} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  sheetContainer: {
    backgroundColor: '#F8FAFC', // Or #FFF depending on design
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 24, // extra padding for bottom safe area
    maxHeight: SCREEN_H * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
});
