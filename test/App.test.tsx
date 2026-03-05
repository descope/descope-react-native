import { renderHook } from '@testing-library/react-native'
import React from 'react'
import { AuthProvider, useFlow, useDescope, useSession, useHostedFlowUrl } from '../src'
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
