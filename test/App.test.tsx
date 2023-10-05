import { renderHook } from '@testing-library/react-native'
import { useFlow, useDescope, useSession } from '../src'

it('should increment count', () => {
  expect(() => renderHook(useFlow)).toThrowError('You can only use this hook in the context of <AuthProvider />')
  expect(() => renderHook(useSession)).toThrowError('You can only use this hook in the context of <AuthProvider />')
  expect(() => renderHook(useDescope)).toThrowError('You can only use this hook in the context of <AuthProvider />')
})
