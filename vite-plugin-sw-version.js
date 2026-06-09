export default function swVersion() {
  return {
    name: 'sw-version',
    generateBundle() {
      // Injecter la date de build dans le SW
      const timestamp = Date.now()
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: require('fs').readFileSync('public/sw.js', 'utf8')
          .replace('__BUILD__', timestamp)
      })
    }
  }
}
