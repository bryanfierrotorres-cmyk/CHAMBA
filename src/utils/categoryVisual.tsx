import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { CHAMBA, chambaStyles } from '@constants/chambaUI';

export interface CategoryVisual {
  color: string;
  icon: React.ReactNode;
}

/** Icono + color de categoría alineados con el panel cliente (Mis Solicitudes). */
export function getCategoryVisual(category?: string | null): CategoryVisual {
  const slug = (category ?? '').toLowerCase();

  if (slug.includes('sofa') || slug.includes('limpieza')) {
    return {
      color: '#5856D6',
      icon: <MaterialCommunityIcons name="sofa" size={22} color="#FFF" />,
    };
  }
  if (slug.includes('electric') || slug.includes('electricista')) {
    return {
      color: '#FFCC00',
      icon: <Ionicons name="flash" size={20} color="#FFF" />,
    };
  }
  if (slug.includes('vehiculo') || slug.includes('car') || slug.includes('auto')) {
    return {
      color: '#007AFF',
      icon: <Ionicons name="car-sport" size={22} color="#FFF" />,
    };
  }
  if (slug.includes('jardiner') || slug.includes('grama')) {
    return {
      color: '#34C759',
      icon: <Ionicons name="leaf" size={22} color="#FFF" />,
    };
  }
  if (slug.includes('ac') || slug.includes('aire')) {
    return {
      color: '#30B0C7',
      icon: <MaterialCommunityIcons name="air-conditioner" size={22} color="#FFF" />,
    };
  }
  if (slug.includes('plomer')) {
    return {
      color: '#007AFF',
      icon: <Ionicons name="water" size={20} color="#FFF" />,
    };
  }
  if (slug.includes('fumig') || slug.includes('pest')) {
    return {
      color: '#34C759',
      icon: <MaterialCommunityIcons name="spray" size={22} color="#FFF" />,
    };
  }
  if (slug.includes('conserj') || slug.includes('b2b_conserje')) {
    return {
      color: '#0EA5E9',
      icon: <MaterialCommunityIcons name="broom" size={22} color="#FFF" />,
    };
  }
  if (slug.includes('b2b_personal_operativo') || slug.includes('carga')) {
    return {
      color: '#007AFF',
      icon: <MaterialCommunityIcons name="dolly" size={22} color="#FFF" />,
    };
  }
  if (slug.includes('b2b_mesero') || slug.includes('barman')) {
    return {
      color: '#FF9500',
      icon: <MaterialCommunityIcons name="glass-cocktail" size={22} color="#FFF" />,
    };
  }
  if (slug.includes('b2b_ayudante') || slug.includes('cocin')) {
    return {
      color: '#5856D6',
      icon: <MaterialCommunityIcons name="chef-hat" size={22} color="#FFF" />,
    };
  }
  if (slug.includes('b2b_apoyo_hogar')) {
    return {
      color: '#34C759',
      icon: <Ionicons name="home" size={22} color="#FFF" />,
    };
  }
  if (slug.includes('b2b_otro')) {
    return {
      color: '#64748B',
      icon: <MaterialCommunityIcons name="clipboard-text-outline" size={22} color="#FFF" />,
    };
  }
  if (slug.includes('alfombra')) {
    return {
      color: '#5856D6',
      icon: <MaterialCommunityIcons name="rug" size={22} color="#FFF" />,
    };
  }

  return {
    color: '#FF9500',
    icon: <MaterialCommunityIcons name="briefcase-outline" size={22} color="#FFF" />,
  };
}

interface CategoryIconCircleProps {
  category: string;
  size?: number;
}

export const CategoryIconCircle: React.FC<CategoryIconCircleProps> = ({
  category,
  size = 44,
}) => {
  const visual = getCategoryVisual(category);
  return (
    <View
      style={[
        chambaStyles.iconCircleRight,
        styles.circle,
        { backgroundColor: visual.color, width: size, height: size, borderRadius: size * 0.32 },
      ]}
    >
      {visual.icon}
    </View>
  );
};

const styles = StyleSheet.create({
  circle: {
    flexShrink: 0,
  },
});

export const CHAMBA_SLATE_MUTED = CHAMBA.muted;
