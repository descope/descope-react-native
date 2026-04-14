import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useDescope, useSession } from '@descope/react-native-sdk'
import Button from '../ui/Button'
import { theme } from '../ui/theme'

export default function HomeScreen() {
  const sdk = useDescope()
  const { session, clearSession } = useSession()

  const logout = async () => {
    await sdk.logout(session?.refreshJwt)
    await clearSession()
  }

  const user = session?.user

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.email}>{user?.loginIds?.[0]}</Text>
        {user?.name ? <Text style={styles.name}>{user.name}</Text> : null}
      </View>
      <Button title="Log Out" onPress={logout} variant="secondary" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: theme.fontSize.title,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  email: {
    fontSize: theme.fontSize.body,
    color: theme.colors.text,
  },
  name: {
    fontSize: theme.fontSize.subtitle,
    color: theme.colors.muted,
    marginTop: theme.spacing.sm,
  },
})
