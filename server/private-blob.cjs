const privateRead = { access: 'private', useCache: false }
const normalizeEtag = value => value?.replace(/^W\//, '').replace(/^"|"$/g, '')

async function readVersionedBlob(blob, path) {
  let content = await blob.get(path, privateRead)
  if (!content) return null
  let revision = (await blob.head(content.blob.url)).etag
  if (revision && normalizeEtag(content.blob.etag) === normalizeEtag(revision)) return { content, revision }

  // The private download ETag can differ from the write token returned by the Blob API.
  for (let attempt = 0; attempt < 3; attempt++) {
    content = await blob.get(path, privateRead)
    if (!content) return null
    const next = (await blob.head(content.blob.url)).etag
    if (next && next === revision) return { content, revision }
    revision = next
  }
  throw new Error('Private blob changed while reading')
}

module.exports = { readVersionedBlob }
