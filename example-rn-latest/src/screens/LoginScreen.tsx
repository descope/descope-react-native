import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Button from '../ui/Button'
import { theme } from '../ui/theme'

type Props = {
  onFlow: () => void
  onOtp: () => void
}

export default function LoginScreen({ onFlow, onOtp }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>
      <View style={styles.buttons}>
        <Button title="Sign in with Flow" onPress={onFlow} />
        <Button title="Sign in with OTP" onPress={onOtp} variant="secondary" />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: theme.fontSize.title,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.fontSize.subtitle,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  buttons: {
    gap: theme.spacing.md,
  },
})
