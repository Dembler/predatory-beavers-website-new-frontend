import { resolve } from 'node:path'
import { build, resolveConfig } from 'vite'
import { preparePages } from './github-pages.mjs'

const config = await resolveConfig({ mode: 'github-pages' }, 'build')
await build({ mode: 'github-pages' })
await preparePages(resolve(config.root, config.build.outDir), config.base)
