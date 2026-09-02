const fs = require('fs')
const path = require('path')

const replacements = {
  'text-white': 'text-slate-900',
  'text-slate-400': 'text-slate-500',
  'text-slate-300': 'text-slate-600',
  'bg-slate-900/50': 'bg-slate-50',
  'bg-slate-900': 'bg-slate-50',
  'border-slate-800': 'border-slate-200',
  'input-dark': 'input-standard',
  'table-dark': 'table-standard',
  'bg-indigo-500/10': 'bg-indigo-50',
  'border-indigo-500/10': 'border-indigo-100',
  'border-indigo-500/20': 'border-indigo-200',
  'border-indigo-500/30': 'border-indigo-200',
  'text-indigo-400': 'text-indigo-600',
  'text-green-400': 'text-green-600',
  'text-yellow-400': 'text-yellow-600',
  'text-red-400': 'text-red-600',
  'bg-slate-800': 'bg-slate-100',
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const fullPath = path.join(dir, file)
    const stat = fs.statSync(fullPath)
    
    if (stat.isDirectory()) {
      processDirectory(fullPath)
    } else if (fullPath.endsWith('.tsx')) {
      // Exclude Sidebar since it stays dark
      if (fullPath.includes('Sidebar.tsx')) continue
      
      let content = fs.readFileSync(fullPath, 'utf8')
      let originalContent = content
      
      for (const [oldClass, newClass] of Object.entries(replacements)) {
        // Simple string replace for classes (using regex with word boundaries where appropriate, 
        // but for exact strings like bg-slate-900/50 global replace is fine)
        const regex = new RegExp(oldClass.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '(?![a-zA-Z0-9_-])', 'g')
        content = content.replace(regex, newClass)
      }
      
      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf8')
        console.log(`Updated: ${fullPath}`)
      }
    }
  }
}

processDirectory(path.join(__dirname, 'src', 'app'))
processDirectory(path.join(__dirname, 'src', 'components'))

console.log('Finished updating classes.')
