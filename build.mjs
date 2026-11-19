import { mkdir, readFile, writeFile } from 'node:fs/promises'

const read = name => readFile(new URL(name, import.meta.url), 'utf8')
const [template, css, core, app] = await Promise.all([
  read('./index.template.html'), read('./app.css'), read('./spring.mjs'), read('./app.mjs'),
])
const script = core.replace(/^export /gm, '') + '\n' + app.replace(/^import [^\n]+\n/, '')
const document = template
  .replace('/* APP_STYLES */', () => css)
  .replace('/* APP_SCRIPT */', () => script.replace(/<\/script/gi, '<\\/script'))
await mkdir(new URL('./dist/', import.meta.url), { recursive: true })
await writeFile(new URL('./dist/index.html', import.meta.url), document)
console.log('Built dist/index.html')
