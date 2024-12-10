import 'zx/globals'
import { projectConfigPath } from "../constants.mjs"
import { PathOrFileDescriptor } from 'fs-extra'
export function parseJsonFile(path: PathOrFileDescriptor) {
  const content = fs.readFileSync(path, 'utf8')
  return JSON.parse(content)
}

export function parseConfigFromJson(nodeName?: string) {
  if (nodeName) {
    return parseJsonFile(projectConfigPath).nodeName
  } else {
    return parseJsonFile(projectConfigPath)
  }
}

export function saveConfig2Json(nodeName: string, data: Object) {
  let parsedData = parseConfigFromJson()
  parsedData.nodeName = data
  fs.writeFileSync(projectConfigPath, JSON.stringify(parsedData, null, 2))
}
