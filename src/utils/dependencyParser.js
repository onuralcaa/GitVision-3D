/**
 * Client-side dependency parser.
 *
 * Extracts import/require/from statements from source files and resolves
 * relative paths to absolute repo paths so they can be matched against
 * the known file list.
 *
 * Supported patterns:
 *   import ... from './foo'
 *   import './foo'
 *   export ... from './foo'
 *   const x = require('./foo')
 *   from foo import bar          (Python)
 *   import foo                   (Python)
 *   require_relative 'foo'       (Ruby)
 *   use foo::bar                 (Rust)
 *   #include "foo.h"             (C/C++)
 */

// Extensions we can meaningfully parse
export const PARSEABLE_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.rb', '.rs', '.go', '.php',
  '.c', '.cpp', '.cc', '.h', '.hpp',
])

// Extensions to try when resolving bare imports (no extension in source)
const RESOLVE_EXTENSIONS = [
  '', '.js', '.jsx', '.ts', '.tsx', '.mjs',
  '/index.js', '/index.jsx', '/index.ts', '/index.tsx',
]

/**
 * Parse raw source text and return an array of raw import specifiers.
 */
function extractRawImports(content, filePath) {
  const ext = filePath.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? ''
  const specifiers = []

  if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext)) {
    // ES modules: import ... from 'x'  |  export ... from 'x'  |  import 'x'
    const esRe = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g
    let m
    while ((m = esRe.exec(content)) !== null) specifiers.push(m[1])

    // CommonJS: require('x')
    const cjsRe = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
    while ((m = cjsRe.exec(content)) !== null) specifiers.push(m[1])
  }

  if (['.py', '.pyw'].includes(ext)) {
    // from x import y  |  import x
    const pyFrom = /^from\s+([\w./]+)\s+import/gm
    const pyImp  = /^import\s+([\w./]+)/gm
    let m
    while ((m = pyFrom.exec(content)) !== null) specifiers.push(m[1].replace(/\./g, '/'))
    while ((m = pyImp.exec(content))  !== null) specifiers.push(m[1].replace(/\./g, '/'))
  }

  if (ext === '.rb') {
    const rbRe = /require_relative\s+['"]([^'"]+)['"]/g
    let m
    while ((m = rbRe.exec(content)) !== null) specifiers.push(m[1])
  }

  if (['.c', '.cpp', '.cc', '.h', '.hpp'].includes(ext)) {
    // #include "local.h"  (skip <system> headers)
    const cRe = /#include\s+"([^"]+)"/g
    let m
    while ((m = cRe.exec(content)) !== null) specifiers.push(m[1])
  }

  if (ext === '.go') {
    const goRe = /import\s+(?:\w+\s+)?["']([^"']+)["']/g
    let m
    while ((m = goRe.exec(content)) !== null) specifiers.push(m[1])
  }

  return specifiers
}

/**
 * Resolve a raw import specifier relative to the importing file's directory,
 * then try to match it against the known set of repo paths.
 *
 * Returns the matched repo path string, or null if unresolvable.
 */
function resolveSpecifier(specifier, importerPath, knownPaths) {
  // Skip node_modules / absolute / scoped packages
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) return null

  const importerDir = importerPath.includes('/')
    ? importerPath.slice(0, importerPath.lastIndexOf('/'))
    : ''

  // Normalise: join dir + specifier, collapse ../ and ./
  const joined = importerDir ? `${importerDir}/${specifier}` : specifier
  const parts  = joined.split('/')
  const resolved = []
  for (const p of parts) {
    if (p === '..') resolved.pop()
    else if (p !== '.') resolved.push(p)
  }
  const base = resolved.join('/')

  // Try with and without common extensions
  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = base + ext
    if (knownPaths.has(candidate)) return candidate
  }

  return null
}

/**
 * Build a full dependency map for all parseable files.
 *
 * @param {Array<{path: string}>} files        - all repo files
 * @param {Map<string, string>}   contentMap   - path → raw file content
 * @returns {Map<string, Set<string>>}          - path → Set of dependency paths
 */
export function buildDependencyMap(files, contentMap) {
  const knownPaths = new Set(files.map(f => f.path))
  const depMap     = new Map()  // path → Set<path>

  for (const file of files) {
    const ext = file.path.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? ''
    if (!PARSEABLE_EXTENSIONS.has(ext)) continue

    const content = contentMap.get(file.path)
    if (!content) continue

    const raw  = extractRawImports(content, file.path)
    const deps = new Set()

    for (const spec of raw) {
      const resolved = resolveSpecifier(spec, file.path, knownPaths)
      if (resolved && resolved !== file.path) deps.add(resolved)
    }

    if (deps.size > 0) depMap.set(file.path, deps)
  }

  return depMap  // Map<importerPath, Set<importedPath>>
}

/**
 * Given a selected file path and the full dep map, return:
 *   outgoing: files this file imports
 *   incoming: files that import this file
 */
export function getDepsForFile(filePath, depMap) {
  const outgoing = depMap.get(filePath) ?? new Set()
  const incoming = new Set()
  for (const [importer, deps] of depMap) {
    if (deps.has(filePath)) incoming.add(importer)
  }
  return { outgoing, incoming }
}
