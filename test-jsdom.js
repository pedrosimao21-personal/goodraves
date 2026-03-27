import fs from 'fs'
import { JSDOM } from 'jsdom'

// Because we cannot trivially load Vite JSX inside Node without transpilation,
// and we saw an SSR module load error, I will use esbuild to bundle App.jsx
// and run it in jsdom.

async function run() {
  const esbuild = require('esbuild')

  await esbuild.build({
    entryPoints: ['src/App.jsx'],
    bundle: true,
    outfile: 'dist/test.js',
    format: 'iife',
    globalName: 'AppWrapper',
    loader: { '.jsx': 'jsx', '.js': 'jsx' },
    external: ['react', 'react-dom', 'react-router-dom'],
  })
}

run()
