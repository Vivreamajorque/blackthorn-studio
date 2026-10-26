import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import Module from 'node:module'
import path from 'node:path'
const require = createRequire(import.meta.url)
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
for (const page of ['Dashboard','TonyDashboard','Comptabilite','Metriques']) {
  test(`${page} renders without missing variables or invalid JSX`,async()=>{
    const output=await build({entryPoints:[`src/pages/${page}.jsx`],bundle:true,write:false,platform:'node',format:'cjs',external:['react','react-dom','react-router-dom']})
    const compiled=new Module(path.resolve(`src/pages/${page}.test.cjs`))
    compiled.paths=Module._nodeModulePaths(process.cwd())
    compiled.filename=path.resolve(`src/pages/${page}.test.cjs`)
    compiled._compile(output.outputFiles[0].text,compiled.filename)
    const html=renderToStaticMarkup(React.createElement(compiled.exports.default,{onLogout:()=>{}}))
    assert.match(html,/Encaissements enregistrés TTC/)
    assert.doesNotMatch(html,/NaN|undefined/)
  })
}
