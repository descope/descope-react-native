import React, { useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { useDescope, useSession } from '@descope/react-native-sdk'
import Button from '../ui/Button'
import { theme } from '../ui/theme'

type Props = {
  onBack: () => void
}

export default function OtpScreen({ onBack }: Props) {
  const sdk = useDescope()
  const { manageSession } = useSession()

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)

  const sendCode = async () => {
    setError(undefined)
    setLoading(true)
    try {
      await sdk.otp.signUpOrIn.email(email)
      setCodeSent(true)
    } catch (e: any) {
      setError(e.message ?? 'Failed to send code')
    } finally {
      setLoading(false)
    }
  }

  const verifyCode = async () => {
    setError(undefined)
    setLoading(true)
    try {
      const response = await sdk.otp.verify.email(email, code)
      await manageSession(response.data)
    } catch (e: any) {
      setError(e.message ?? 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Email OTP</Text>
      <TextInput style={styles.input} placeholder="Email" placeholderTextColor={theme.colors.muted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!codeSent} />
      {codeSent && <TextInput style={styles.input} placeholder="Verification code" placeholderTextColor={theme.colors.muted} value={code} onChangeText={setCode} keyboardType="number-pad" autoFocus />}
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.buttons}>
        <Button title={codeSent ? 'Verify' : 'Send Code'} onPress={codeSent ? verifyCode : sendCode} disabled={(!codeSent && !email) || (codeSent && !code)} loading={loading} />
        <Button title="Back" onPress={onBack} variant="secondary" />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: theme.fontSize.title,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.body,
    color: theme.colors.text,
  },
  error: {
    color: theme.colors.error,
    textAlign: 'center',
    fontSize: theme.fontSize.subtitle,
  },
  buttons: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
})
