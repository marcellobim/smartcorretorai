import fs from 'node:fs'
import path from 'node:path'

const TEMPLATE_IDS = [
  {
    label: 'Com Informacoes',
    id: '356174ea-7990-4e72-9d4d-3a641ff593fe',
  },
  {
    label: 'Clean / Sem Textos',
    id: '7a0d03f5-6394-4e91-8afa-95b7165b16f2',
  },
]

const envFiles = [
  '.env',
  '.env.local',
  'supabase/.env',
  'supabase/.env.local',
  'frontend/.env',
  'frontend/.env.local',
]

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const index = trimmed.indexOf('=')
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if (!key || process.env[key]) continue
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

for (const file of envFiles) {
  loadEnvFile(path.resolve(process.cwd(), file))
}

const apiKey = process.env.CREATOMATE_API_KEY

if (!apiKey) {
  console.error('CREATOMATE_API_KEY nao encontrada no ambiente local.')
  console.error('Defina a variavel e rode novamente. O script nao imprime a chave.')
  process.exit(1)
}

function extractElements(node, out = [], pathParts = []) {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    node.forEach((item, index) => extractElements(item, out, [...pathParts, `[${index}]`]))
    return out
  }

  const element = node
  const name = typeof element.name === 'string' ? element.name : ''
  const type = typeof element.type === 'string' ? element.type : ''
  const id = typeof element.id === 'string' ? element.id : ''

  if (name && type) {
    const modificationProperty = type === 'text' ? 'text' : ['image', 'video', 'audio'].includes(type) ? 'source' : ''
    out.push({
      name,
      type,
      id,
      path: pathParts.join('.'),
      modification_key: modificationProperty ? `${name}.${modificationProperty}` : null,
      can_modify: Boolean(modificationProperty),
      has_default_text: typeof element.text === 'string' && element.text.length > 0,
      has_default_source: typeof element.source === 'string' && element.source.length > 0,
    })
  }

  if (Array.isArray(element.elements)) {
    extractElements(element.elements, out, [...pathParts, name || type || 'element', 'elements'])
  }

  return out
}

function addVirtualLabels(elements) {
  const counts = new Map()
  return elements.map((element) => {
    const key = `${element.name}|${element.type}`
    const count = (counts.get(key) || 0) + 1
    counts.set(key, count)
    return {
      ...element,
      virtual_label: count === 1 ? element.name : `${element.name}-${count}`,
      modification_key_by_id: element.id && element.modification_key
        ? `${element.id}.${element.modification_key.split('.').pop()}`
        : null,
    }
  })
}

async function fetchTemplate(template) {
  const response = await fetch(`https://api.creatomate.com/v1/templates/${template.id}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`GET template ${template.id} falhou com ${response.status}: ${body.slice(0, 300)}`)
  }

  const body = await response.json()
  const elements = addVirtualLabels(extractElements(body?.source))
  const mediaElements = elements.filter((item) => ['image', 'video', 'audio'].includes(item.type))
  const textElements = elements.filter((item) => item.type === 'text')

  return {
    label: template.label,
    template_id: template.id,
    template_name: String(body?.name || ''),
    counts: {
      total_elements_with_name_and_type: elements.length,
      media: mediaElements.length,
      text: textElements.length,
    },
    media_elements: mediaElements,
    text_elements: textElements,
    all_modifiable_elements: elements.filter((item) => item.can_modify),
  }
}

const results = []
for (const template of TEMPLATE_IDS) {
  results.push(await fetchTemplate(template))
}

console.log(JSON.stringify({
  inspected_at: new Date().toISOString(),
  secret_loaded: true,
  templates: results,
}, null, 2))
