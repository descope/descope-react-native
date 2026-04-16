import React, { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { FlowView, useHostedFlowUrl, useSession } from '@descope/react-native-sdk'
import type { DescopeError } from '@descope/react-native-sdk'
import { DESCOPE_FLOW_ID } from '@env'
import Button from '../ui/Button'
import { theme } from '../ui/theme'

type Props = {
  onBack: () => void
}

export default function FlowScreen({ onBack }: Props) {
  const { manageSession } = useSession()
  const flowUrl = useHostedFlowUrl(DESCOPE_FLOW_ID)
  const [ready, setReady] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string>()

  const handleSuccess = async (jwtResponse: Parameters<typeof manageSession>[0]) => {
    setDone(true)
    await manageSession(jwtResponse)
  }

  const handleError = (err: DescopeError) => {
    setError(`${err.errorCode}: ${err.errorDescription}`)
  }

  return (
    <View style={styles.container}>
      <View style={styles.flowContainer}>
        {!done && <FlowView style={styles.flow} flowOptions={{ url: flowUrl }} onReady={() => setReady(true)} onSuccess={handleSuccess} onError={handleError} />}
        {!ready && !done && <ActivityIndicator style={styles.loading} size="large" color={theme.colors.primary} />}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.footer}>
        <Button title="Back" onPress={onBack} variant="secondary" />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  flowContainer: {
    flex: 1,
  },
  flow: {
    flex: 1,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  error: {
    color: theme.colors.error,
    textAlign: 'center',
    padding: theme.spacing.md,
    fontSize: theme.fontSize.subtitle,
  },
  footer: {
    padding: theme.spacing.lg,
  },
})
