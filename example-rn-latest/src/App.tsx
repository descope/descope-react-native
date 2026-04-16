import React, { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { AuthProvider, useSession } from '@descope/react-native-sdk'
import { DESCOPE_PROJECT_ID, DESCOPE_BASE_URL } from '@env'
import LoginScreen from './screens/LoginScreen'
import FlowScreen from './screens/FlowScreen'
import OtpScreen from './screens/OtpScreen'
import HomeScreen from './screens/HomeScreen'

const logger = {
  debug: (...args: any[]) => console.log('[Descope DEBUG]', ...args),
  log: (...args: any[]) => console.log('[Descope]', ...args),
  warn: (...args: any[]) => console.warn('[Descope]', ...args),
  error: (...args: any[]) => console.error('[Descope]', ...args),
}

type Screen = 'login' | 'flow' | 'otp'

function Main() {
  const { session, isSessionLoading } = useSession()
  const [screen, setScreen] = useState<Screen>('login')

  useEffect(() => {
    if (!session) setScreen('login')
  }, [session])

  if (isSessionLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (session) {
    return <HomeScreen />
  }

  switch (screen) {
    case 'flow':
      return <FlowScreen onBack={() => setScreen('login')} />
    case 'otp':
      return <OtpScreen onBack={() => setScreen('login')} />
    default:
      return <LoginScreen onFlow={() => setScreen('flow')} onOtp={() => setScreen('otp')} />
  }
}

export default function App() {
  return (
    <AuthProvider projectId={DESCOPE_PROJECT_ID} baseUrl={DESCOPE_BASE_URL || undefined} logger={logger}>
      <Main />
    </AuthProvider>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
