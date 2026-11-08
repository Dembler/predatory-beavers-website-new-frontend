import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import openapiTS, { astToString } from 'openapi-typescript'
import { format, resolveConfig } from 'prettier'

// Pass a saved OpenAPI document or a running API URL. No authentication is required.
const input = process.argv[2] || process.env.OPENAPI_URL || 'http://127.0.0.1:8000/openapi.json'
const source = /^https?:\/\//.test(input) ? new URL(input) : pathToFileURL(resolve(input))
const output = new URL('../src/shared/api/schema.d.ts', import.meta.url)
const ast = await openapiTS(source)
await writeFile(
  output,
  await format(
    '/** Generated from backend OpenAPI. Run npm run api:generate -- <document-or-url>. */\n' +
      astToString(ast),
    { ...(await resolveConfig(fileURLToPath(output))), filepath: fileURLToPath(output) },
  ),
)
console.log(`API types written to ${fileURLToPath(output)}`)
