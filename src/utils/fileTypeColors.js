// File type to color mapping
export const FILE_TYPE_COLORS = {
  'JavaScript/TypeScript': { ext: ['.js', '.jsx', '.ts', '.tsx', '.mjs'], hex: 0xf1e05a },
  'Python': { ext: ['.py', '.pyw', '.pyx'], hex: 0x3572a5 },
  'HTML/XML': { ext: ['.html', '.htm', '.xml', '.svg'], hex: 0xe34c26 },
  'CSS/SCSS': { ext: ['.css', '.scss', '.sass', '.less'], hex: 0x563d7c },
  'JSON/YAML': { ext: ['.json', '.yaml', '.yml', '.toml', '.ini', '.conf'], hex: 0xf7931e },
  'Markdown': { ext: ['.md', '.markdown', '.rst', '.txt'], hex: 0x083fa1 },
  'Java/C++': { ext: ['.java', '.cpp', '.cc', '.c', '.h', '.hpp'], hex: 0xf34b7d },
  'Rust': { ext: ['.rs'], hex: 0xce422b },
  'Go': { ext: ['.go'], hex: 0x00add8 },
  'Ruby': { ext: ['.rb', '.erb'], hex: 0xcc342d },
  'PHP': { ext: ['.php'], hex: 0x777bb4 },
  'Shell': { ext: ['.sh', '.bash', '.zsh'], hex: 0x89e051 },
}

export function getFileExtension(filePath) {
  const match = filePath.match(/\.[^.]+$/)
  return match ? match[0].toLowerCase() : ''
}

export function getColorForFileType(filePath) {
  const ext = getFileExtension(filePath)
  
  for (const [category, { ext: exts, hex }] of Object.entries(FILE_TYPE_COLORS)) {
    if (exts.includes(ext)) {
      return { hex, category }
    }
  }
  
  // Default color for unknown types
  return { hex: 0x999999, category: 'Other' }
}

export function getLegendItems() {
  return Object.entries(FILE_TYPE_COLORS).map(([category, { ext, hex }]) => ({
    category,
    extensions: ext.join(', '),
    hex,
    color: `#${hex.toString(16).padStart(6, '0')}`
  }))
}

export function getLegendItemsForFiles(files = []) {
  const seenCategories = new Set()
  const items = []

  files.forEach((file) => {
    const { category, hex } = getColorForFileType(file.path || '')
    if (category === 'Other' || seenCategories.has(category)) {
      return
    }

    const config = FILE_TYPE_COLORS[category]
    if (!config) {
      return
    }

    seenCategories.add(category)
    items.push({
      category,
      extensions: config.ext.join(', '),
      hex,
      color: `#${hex.toString(16).padStart(6, '0')}`
    })
  })

  return items
}
