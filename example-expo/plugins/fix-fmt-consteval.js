const { withDangerousMod } = require('expo/config-plugins')
const fs = require('fs')
const path = require('path')

module.exports = function withFixFmtConsteval(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile')
      let podfile = fs.readFileSync(podfilePath, 'utf8')

      const marker = '# Workaround for fmt consteval errors with Xcode 26+'
      if (podfile.includes(marker)) return config

      const patch = `
    ${marker}
    fmt_base = File.join(installer.sandbox.pod_dir('fmt'), 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      content = File.read(fmt_base)
      patched = content.gsub(/#  define FMT_USE_CONSTEVAL 1/, '#  define FMT_USE_CONSTEVAL 0')
      File.write(fmt_base, patched)
    end
`

      podfile = podfile.replace(/(post_install do \|installer\|)/, `$1\n${patch}`)
      fs.writeFileSync(podfilePath, podfile)
      return config
    },
  ])
}
