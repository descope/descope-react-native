import * as React from 'react'

import { useDescope, useFlow, useSession } from 'descope-react-native'
import { useState } from 'react'
import { Button, Linking, StyleSheet, Text, View } from 'react-native'

export default function Flow() {
  const flow = useFlow()
  const descope = useDescope()
  const { session, manageSession, clearSession } = useSession()

  const [output, setOutput] = useState('')

  React.useEffect(() => {
    Linking.addEventListener('url', async (event) => {
      if (event.url.includes('my-magic-link-redirect-deep-link')) {
        await flow.resume(event.url)
      } else if (event.url.includes('my-authentication-redirect-deep-link')) {
        await flow.exchange(event.url)
      }
    })
    return () => {
      Linking.removeAllListeners('url')
    }
  }, [flow])

  const startFlow = async () => {
    try {
      const resp = await flow.start('my-flow-url', 'my-deep-link-url')
      await manageSession(resp.data)
    } catch (e: any) {
      setOutput(`${e.code}: ${e.message}`)
    }
  }

  const logOut = async () => {
    await descope.logout(session?.refreshJwt)
    await clearSession()
    setOutput('')
  }

  return session ? (
    <View style={styles.container}>
      <Text>{session.user.loginIds[0]} Logged in</Text>
      <Text>{session.sessionJwt}</Text>
      <Button title="LOG OUT" onPress={logOut} />
    </View>
  ) : (
    <View style={styles.container}>
      <Text>{output}</Text>
      <Button title="RUN FLOW" onPress={startFlow} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: 60,
    height: 60,
    marginVertical: 20,
  },
})
