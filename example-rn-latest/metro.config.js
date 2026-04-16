const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const path = require('path')

const root = path.resolve(__dirname, '..')

const config = {
  watchFolders: [root],
  resolver: {
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules'), path.resolve(root, 'node_modules')],
    disableHierarchicalLookup: true,
  },
}

module.exports = mergeConfig(getDefaultConfig(__dirname), config)
