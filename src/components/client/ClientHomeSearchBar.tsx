import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@store/authStore';
import { trackEvent } from '@services/analytics';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Animated,
  StyleSheet,
  Easing,
  Platform,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CHAMBA } from '@constants/chambaUI';
import { HOME_PALETTE, HOME_SEARCH_SHADOW } from '@constants/clientHomeTheme';
import { searchServices } from '@utils/searchSynonyms';
import type { ServiceType } from '@features/catalog/types';

interface Props {
  serviceTypes: ServiceType[];
  onSelectService: (slug: string, label: string) => void;
  onSupportPress?: () => void;
}

const PLACEHOLDERS = [
  '¿Qué necesitas hoy?',
  'Limpieza de muebles...',
  'Plomero express...',
  'Electricista urgente...',
];

const { height } = Dimensions.get('window');

export const ClientHomeSearchBar: React.FC<Props> = ({
  serviceTypes,
  onSelectService,
  onSupportPress,
}) => {
  const userId = useAuthStore((s) => s.profile?.id ?? null);
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<ServiceType[]>([]);
  
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const focusAnim = useRef(new Animated.Value(0)).current;
  const xButtonScale = useRef(new Animated.Value(0)).current;
  const dropdownAnim = useRef(new Animated.Value(0)).current;
  
  const inputRef = useRef<TextInput>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Placeholder Carousel
  useEffect(() => {
    if (query.length > 0 || isFocused) return; // Pausar rotación si está en uso

    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
      }, 300);
    }, 3500);

    return () => clearInterval(interval);
  }, [query.length, isFocused, fadeAnim]);

  // Focus Animation
  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false, // Border color cannot use native driver
    }).start();
    
    // Animate dropdown entrance
    Animated.timing(dropdownAnim, {
      toValue: isFocused && query.length > 0 ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [isFocused, query.length, focusAnim, dropdownAnim]);

  // X Button Animation
  useEffect(() => {
    Animated.timing(xButtonScale, {
      toValue: query.length > 0 ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [query.length, xButtonScale]);

  // Handle Input with Debounce
  const handleTextChange = (text: string) => {
    setQuery(text);
    
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    debounceTimer.current = setTimeout(() => {
      if (text.trim().length > 0) {
        const results = searchServices(text, serviceTypes);
        setSearchResults(results);
        trackEvent('search', userId, {
          query: text.trim(),
          category: results.length > 0 ? results[0].slug : null,
          results_count: results.length,
        });
      } else {
        setSearchResults([]);
      }
    }, 300);
  };

  const handleClear = () => {
    setQuery('');
    setSearchResults([]);
    inputRef.current?.blur();
  };

  const handleSelect = (service: ServiceType) => {
    handleClear();
    onSelectService(service.slug, service.name);
  };

  const containerBorderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', HOME_PALETTE.blueLight],
  });

  const showDropdown = isFocused && query.length > 0;

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.searchContainer, { borderColor: containerBorderColor }]}>
        <Ionicons name="search" size={24} color={isFocused ? HOME_PALETTE.blue : HOME_PALETTE.placeholderGray} style={styles.searchIcon} />
        
        {query.length === 0 && !isFocused && (
          <Animated.View style={[styles.placeholderContainer, { opacity: fadeAnim }]} pointerEvents="none">
            <Text style={styles.placeholderText}>{PLACEHOLDERS[placeholderIndex]}</Text>
          </Animated.View>
        )}
        
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          value={query}
          onChangeText={handleTextChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={isFocused ? 'Escribe aquí...' : ''}
          placeholderTextColor={CHAMBA.muted}
          returnKeyType="search"
        />

        <Animated.View style={{ transform: [{ scale: xButtonScale }], opacity: xButtonScale }}>
          <TouchableOpacity onPress={handleClear} style={styles.clearButton} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={18} color={CHAMBA.muted} />
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity style={styles.filterButton} activeOpacity={0.7} accessibilityLabel="Filtros">
          <Ionicons name="options-outline" size={20} color={HOME_PALETTE.darkGray} />
        </TouchableOpacity>
      </Animated.View>

      {/* Floating Overlay & Dropdown */}
      {showDropdown && (
        <View style={styles.dropdownWrapper}>
          <TouchableWithoutFeedback onPress={handleClear}>
            <View style={styles.backdrop} />
          </TouchableWithoutFeedback>
          
          <Animated.View
            style={[
              styles.dropdown,
              {
                opacity: dropdownAnim,
                transform: [
                  {
                    scale: dropdownAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.97, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {searchResults.length > 0 ? (
              searchResults.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.resultItem,
                    index === searchResults.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="search-outline" size={16} color={CHAMBA.muted} style={styles.resultIcon} />
                  <View style={styles.resultTextContainer}>
                    <Text style={styles.resultTitle}>{item.name}</Text>
                    {item.description && (
                      <Text style={styles.resultDesc} numberOfLines={1}>
                        {item.description}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={CHAMBA.border} />
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="search-outline" size={24} color={CHAMBA.muted} />
                </View>
                <Text style={styles.emptyTitle}>No encontramos ese servicio exacto</Text>
                <Text style={styles.emptyDesc}>
                  Pero podemos ayudarte a buscar un técnico personalizado.
                </Text>
                <TouchableOpacity 
                  style={styles.supportButton} 
                  activeOpacity={0.8}
                  onPress={() => {
                    handleClear();
                    onSupportPress?.();
                  }}
                >
                  <Ionicons name="logo-whatsapp" size={16} color="#FFF" />
                  <Text style={styles.supportButtonText}>Solicitar Soporte</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    zIndex: 999, // Para que el dropdown flote por encima del contenido
  },
  searchContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    alignItems: 'center',
    paddingHorizontal: 20,
    borderWidth: 0,
    height: 64,
    position: 'relative',
    zIndex: 2,
    ...HOME_SEARCH_SHADOW,
  },
  searchIcon: {
    marginRight: 10,
  },
  placeholderContainer: {
    position: 'absolute',
    left: 54,
    right: 40,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: HOME_PALETTE.placeholderGray,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: HOME_PALETTE.darkGray,
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
  },
  clearButton: {
    padding: 6,
    marginLeft: 4,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: HOME_PALETTE.filterBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  // Dropdown overlay
  dropdownWrapper: {
    position: 'absolute',
    top: 72, // justo debajo de la barra (64px + margen)
    left: -16, // asumiendo que el headerStack tiene paddingHorizontal 16
    right: -16,
    height: height, // cubrir toda la pantalla hacia abajo
    zIndex: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
    // Nota: backdrop-filter requiere un polyfill o estilo de view especial en web
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(4px)' } as any : {}),
  },
  dropdown: {
    backgroundColor: CHAMBA.white,
    marginHorizontal: 16,
    borderRadius: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    maxHeight: height * 0.5,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9', // slate-100
  },
  resultIcon: {
    marginRight: 12,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: CHAMBA.navy,
  },
  resultDesc: {
    fontSize: 12,
    color: CHAMBA.muted,
    marginTop: 2,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: CHAMBA.navy,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 13,
    color: CHAMBA.muted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CHAMBA.cyan,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 16,
    gap: 8,
  },
  supportButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
