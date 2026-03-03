import { NativeEventEmitter, NativeModules } from 'react-native'
import type { SdkLogger } from '../core/sdk'
import DescopeReactNative from './descopeModule'

const LOG_EVENT_NAME = 'descopeLog'

type NativeLogEvent = {
  level: 'error' | 'info' | 'debug'
  message: string
  values: string[]
}

/**
 * Sets up the native log bridge to forward native SDK log messages to the JS logger.
 * Returns a cleanup function that removes the event listener.
 */
export function setupNativeLogBridge(logger: NonNullable<SdkLogger>): () => void {
  DescopeReactNative.configureLogging('debug', false).catch((err: unknown) => {
    logger.warn('Failed to configure native logging:', err)
  })

  const eventEmitter = new NativeEventEmitter(NativeModules.DescopeReactNative)
  const subscription = eventEmitter.addListener(LOG_EVENT_NAME, (event: NativeLogEvent) => {
    const { level, message, values } = event
    const formattedMessage = values.length > 0 ? `${message} (${values.join(', ')})` : message

    switch (level) {
      case 'error':
        logger.error(formattedMessage)
        break
      case 'info':
        logger.log(formattedMessage)
        break
      case 'debug':
        logger.debug(formattedMessage)
        break
      default:
        logger.log(formattedMessage)
    }
  })

  return () => {
    subscription.remove()
  }
}
