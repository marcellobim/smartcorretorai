const supabase = require('../services/supabase')

const BUCKET = process.env.STORAGE_BUCKET || 'smartcorretor-assets'

async function uploadFotos(fotosBase64, folderId) {
  if (!fotosBase64?.length) return []
  const results = await Promise.all(
    fotosBase64.slice(0, 5).map(async (foto, i) => {
      try {
        const buffer = Buffer.from(foto.dados, 'base64')
        const path = `campanhas/${folderId}/foto-${i + 1}.jpg`
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, buffer, { contentType: foto.tipo || 'image/jpeg', upsert: true })
        if (error) { console.error(`Upload foto ${i + 1}:`, error.message); return null }
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
        return data.publicUrl
      } catch (err) {
        console.error(`Upload foto ${i + 1} exception:`, err.message)
        return null
      }
    })
  )
  return results.filter(Boolean)
}

module.exports = { uploadFotos }
