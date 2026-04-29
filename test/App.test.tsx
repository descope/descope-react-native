import { render, renderHook } from '@testing-library/react-native'
import React from 'react'
import { AuthProvider, FlowView, useFlow, useDescope, useSession, useHostedFlowUrl } from '../src'
import Context from '../src/internal/hooks/Context'
import type { DescopeContext } from '../src/internal/types'
import createCoreSdk from '@descope/core-js-sdk'

jest.mock('@descope/core-js-sdk', () => jest.fn())

jest.mock('../src/internal/modules/descopeModule', () => ({
  __esModule: true,
  default: {
    loadItem: jest.fn().mockResolvedValue(null),
    configureLogging: jest.fn().mockResolvedValue(null),
  },
}))

const projectId = 'Ptest12aAc4T2V93bddihGEx2Ryhc8e5Z'

const wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(AuthProvider, { projectId }, children)

describe('hooks', () => {
  it('should not allow hooks to run outside AuthProvider', () => {
    expect(() => renderHook(useFlow)).toThrowError('You can only use this hook in the context of <AuthProvider />')
    expect(() => renderHook(useSession)).toThrowError('You can only use this hook in the context of <AuthProvider />')
    expect(() => renderHook(useDescope)).toThrowError('You can only use this hook in the context of <AuthProvider />')
  })

  it('should not allow FlowView to render outside AuthProvider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => render(React.createElement(FlowView, { flowOptions: { url: 'https://example.com/flow' } }))).toThrowError('You can only use this hook in the context of <AuthProvider />')
    } finally {
      consoleError.mockRestore()
    }
  })

  describe('FlowView', () => {
    const renderWithContext = (overrides: Partial<DescopeContext>) => {
      const value: DescopeContext = { projectId, setSession: () => {}, isSessionLoading: false, inFlightRefresh: { current: false }, ...overrides }
      const ctxWrapper = ({ children }: { children: React.ReactNode }) => React.createElement(Context.Provider, { value }, children)
      return render(React.createElement(FlowView, { flowOptions: { url: 'https://example.com/flow' } }), { wrapper: ctxWrapper })
    }

    it('defers rendering the native view while the persisted session is loading', () => {
      expect(renderWithContext({ isSessionLoading: true }).toJSON()).toBeNull()
    })

    it('passes session tokens to the native view when a session exists', () => {
      const session = { sessionJwt: 'abc', refreshJwt: 'def', user: { userId: 'u1', loginIds: [] } as any }
      const tree = renderWithContext({ session }).toJSON() as { props: { session?: { sessionJwt: string; refreshJwt: string } } } | null
      expect(tree?.props.session).toEqual({ sessionJwt: 'abc', refreshJwt: 'def' })
    })

    it('does not pass session to the native view when no session exists', () => {
      const tree = renderWithContext({ session: undefined }).toJSON() as { props: { session?: unknown } } | null
      expect(tree?.props.session).toBeUndefined()
    })
  })

  describe('useHostedFlowUrl', () => {
    const mockBuildUrl = jest.fn()

    beforeEach(() => {
      ;(createCoreSdk as unknown as jest.Mock).mockReturnValue({ httpClient: { buildUrl: mockBuildUrl } })
    })

    it('should throw when used outside AuthProvider', () => {
      expect(() => renderHook(() => useHostedFlowUrl('sign-in'))).toThrowError('You can only use this hook in the context of <AuthProvider />')
    })

    it('should delegate URL building to the SDK httpClient', () => {
      const expected = `https://api.test.descope.com/login/${projectId}?platform=mobile&wide=true&flow=sign-in`
      mockBuildUrl.mockReturnValue(expected)

      const { result } = renderHook(() => useHostedFlowUrl('sign-in'), { wrapper })

      expect(mockBuildUrl).toHaveBeenCalledWith(`login/${projectId}`, {
        platform: 'mobile',
        wide: 'true',
        flow: 'sign-in',
      })
      expect(result.current).toBe(expected)
    })
  })
})
