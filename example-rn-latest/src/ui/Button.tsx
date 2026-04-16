import React from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native'
import { theme } from './theme'

type Props = {
  title: string
  onPress: () => void
  variant?: 'primary' | 'secondary'
  disabled?: boolean
  loading?: boolean
}

export default function Button({ title, onPress, variant = 'primary', disabled, loading }: Props) {
  const isSecondary = variant === 'secondary'
  const isInactive = disabled || loading
  return (
    <TouchableOpacity onPress={onPress} disabled={isInactive} activeOpacity={0.7} style={[styles.base, isSecondary ? styles.secondary : styles.primary, isInactive && styles.disabled]}>
      {loading ? <ActivityIndicator color={isSecondary ? theme.colors.primary : '#fff'} /> : <Text style={[styles.label, isSecondary ? styles.secondaryLabel : styles.primaryLabel]}>{title}</Text>}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: theme.radius,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  primary: {
    backgroundColor: theme.colors.primary,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: theme.fontSize.button,
    fontWeight: '600',
  },
  primaryLabel: {
    color: '#fff',
  },
  secondaryLabel: {
    color: theme.colors.primary,
  },
})
