import { createPasskey } from '../src/internal/core/passkey'
import DescopeReactNative from '../src/internal/modules/descopeModule'
import type { CoreSdk } from '../src/internal/core/sdk'

jest.mock('../src/internal/modules/descopeModule', () => ({
  __esModule: true,
  default: {
    passkeySupported: jest.fn(),
    passkeyOrigin: jest.fn(),
    passkeyCreate: jest.fn(),
    passkeyAuthenticate: jest.fn(),
  },
}))

const native = DescopeReactNative as jest.Mocked<typeof DescopeReactNative>

const startResponse = (create: boolean) => ({
  ok: true,
  data: { transactionId: 'tx1', options: '{"publicKey":{}}', create },
})

const jwtResponse = { ok: true, data: { sessionJwt: 'session', refreshJwt: 'refresh' } }

const createMockSdk = () =>
  ({
    webauthn: {
      signUp: { start: jest.fn(), finish: jest.fn().mockResolvedValue(jwtResponse) },
      signIn: { start: jest.fn(), finish: jest.fn().mockResolvedValue(jwtResponse) },
      signUpOrIn: { start: jest.fn() },
      update: { start: jest.fn(), finish: jest.fn().mockResolvedValue({ ok: true, data: {} }) },
    },
  }) as unknown as CoreSdk

describe('passkey', () => {
  let sdk: CoreSdk
  let passkey: ReturnType<typeof createPasskey>

  beforeEach(() => {
    jest.clearAllMocks()
    native.passkeyOrigin.mockResolvedValue('')
    native.passkeyCreate.mockResolvedValue('{"registration":true}')
    native.passkeyAuthenticate.mockResolvedValue('{"assertion":true}')
    sdk = createMockSdk()
    passkey = createPasskey(sdk)
  })

  it('should report platform support from the native module', async () => {
    native.passkeySupported.mockResolvedValue(false)
    expect(await passkey.isSupported()).toBe(false)
  })

  it('should run the register ceremony and finish sign up', async () => {
    sdk.webauthn.signUp.start = jest.fn().mockResolvedValue(startResponse(true))

    const resp = await passkey.signUp('andy@example.com', 'Andy')

    expect(sdk.webauthn.signUp.start).toHaveBeenCalledWith('andy@example.com', '', 'Andy')
    expect(native.passkeyCreate).toHaveBeenCalledWith('{"publicKey":{}}')
    expect(sdk.webauthn.signUp.finish).toHaveBeenCalledWith('tx1', '{"registration":true}')
    expect(resp).toBe(jwtResponse)
  })

  it('should run the assertion ceremony and finish sign in', async () => {
    sdk.webauthn.signIn.start = jest.fn().mockResolvedValue(startResponse(false))

    const resp = await passkey.signIn('andy@example.com')

    expect(native.passkeyAuthenticate).toHaveBeenCalledWith('{"publicKey":{}}')
    expect(sdk.webauthn.signIn.finish).toHaveBeenCalledWith('tx1', '{"assertion":true}')
    expect(resp).toBe(jwtResponse)
  })

  it('should register and finish sign up when signUpOrIn returns create', async () => {
    sdk.webauthn.signUpOrIn.start = jest.fn().mockResolvedValue(startResponse(true))

    await passkey.signUpOrIn('andy@example.com')

    expect(native.passkeyCreate).toHaveBeenCalledWith('{"publicKey":{}}')
    expect(native.passkeyAuthenticate).not.toHaveBeenCalled()
    expect(sdk.webauthn.signUp.finish).toHaveBeenCalledWith('tx1', '{"registration":true}')
    expect(sdk.webauthn.signIn.finish).not.toHaveBeenCalled()
  })

  it('should assert and finish sign in when signUpOrIn does not return create', async () => {
    sdk.webauthn.signUpOrIn.start = jest.fn().mockResolvedValue(startResponse(false))

    await passkey.signUpOrIn('andy@example.com')

    expect(native.passkeyAuthenticate).toHaveBeenCalledWith('{"publicKey":{}}')
    expect(native.passkeyCreate).not.toHaveBeenCalled()
    expect(sdk.webauthn.signIn.finish).toHaveBeenCalledWith('tx1', '{"assertion":true}')
    expect(sdk.webauthn.signUp.finish).not.toHaveBeenCalled()
  })

  it('should pass the refresh token when adding a passkey', async () => {
    sdk.webauthn.update.start = jest.fn().mockResolvedValue(startResponse(true))

    await passkey.add('andy@example.com', 'refresh-jwt')

    expect(sdk.webauthn.update.start).toHaveBeenCalledWith('andy@example.com', '', 'refresh-jwt')
    expect(sdk.webauthn.update.finish).toHaveBeenCalledWith('tx1', '{"registration":true}')
  })

  it('should send the origin provided by the native module', async () => {
    native.passkeyOrigin.mockResolvedValue('android:apk-key-hash:abc')
    sdk.webauthn.signUpOrIn.start = jest.fn().mockResolvedValue(startResponse(false))

    await passkey.signUpOrIn('andy@example.com')

    expect(sdk.webauthn.signUpOrIn.start).toHaveBeenCalledWith('andy@example.com', 'android:apk-key-hash:abc')
  })

  it('should not run a ceremony when start fails', async () => {
    const failure = { ok: false, error: { errorCode: 'E062108', errorDescription: 'User not found' } }
    sdk.webauthn.signIn.start = jest.fn().mockResolvedValue(failure)

    const resp = await passkey.signIn('andy@example.com')

    expect(resp.ok).toBe(false)
    expect(resp.data).toBeUndefined()
    expect(resp.error).toBe(failure.error)
    expect(native.passkeyAuthenticate).not.toHaveBeenCalled()
    expect(sdk.webauthn.signIn.finish).not.toHaveBeenCalled()
  })

  it('should propagate a cancelled ceremony', async () => {
    sdk.webauthn.signIn.start = jest.fn().mockResolvedValue(startResponse(false))
    native.passkeyAuthenticate.mockRejectedValue(new Error('Passkey authentication cancelled'))

    await expect(passkey.signIn('andy@example.com')).rejects.toThrow('Passkey authentication cancelled')
    expect(sdk.webauthn.signIn.finish).not.toHaveBeenCalled()
  })
})
