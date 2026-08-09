export async function downloadFileFromPrivateUrl(url, filename) {
  globalThis.__virtualStagingMocks.downloads.push({ url, filename })
}

export function getDownloadErrorMessage(error) {
  return error?.message || 'Falha no download.'
}
