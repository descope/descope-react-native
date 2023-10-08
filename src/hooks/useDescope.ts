import { useMemo } from 'react'
import { createSdk, type Sdk } from '../internal/core/sdk'
import useContext from '../internal/hooks/useContext'
import { proxyThrowHandler } from '../internal/hooks/utils'

const useDescope = (): Sdk => {
  const { sdk } = useContext()
  return useMemo(() => {
    if (!sdk) {
      // In case the SDK is not initialized, we want to throw an error when the SDK functions are actually called
      return new Proxy(createSdk('dummy-project-id'), proxyThrowHandler) as Sdk
    }
    return sdk
  }, [sdk])
}

export default useDescope
