import * as React from 'react'

import { AuthProvider } from 'descope-react-native'
import Flow from './Flow'
import { View } from 'react-native'

const logger = {
  debug: (message?: any) => {
    console.log(`DEBUG: ${message}`)
  },
  log: (message?: any) => {
    console.log(`INFO: ${message}`)
  },
  warn: (message?: any) => {
    console.log(`WARN: ${message}`)
  },
  error: (message?: any) => {
    console.log(`ERROR: ${message}`)
  },
}

export default function App() {
  return (
    <AuthProvider config={{ projectId: '<my-project-id>', logger }}>
      <View style={{ flex: 1, backgroundColor: '#CEEEE4' }}>
        <Flow />
      </View>
    </AuthProvider>
  )
}
