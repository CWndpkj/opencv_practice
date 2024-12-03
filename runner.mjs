import { profileEnd } from 'console'
import 'zx/globals'


// This script is used to run target flexible
// usage: runner.mjs target [args]
// for example: 

// runner.mjs                          --------show help
// runner.mjs -h                       --------show help
// runner.mjs --help                   --------show help

// runner.mjs json_parser              --------run the target json_parser without args
// runner.mjs json_parser -- args         --------run the target json_parser with args


// TODO: user specific configuration
const buildType = "Debug"

const pwd = await $`pwd`

// Only support gcc,not support MSVC and clang
const binDir = "out/build/unixlike-gcc-" + buildType.toLowerCase()
const conanRunFile = path.join("conan/build", buildType, "generators", "conanrun.sh")

console.log("binDir: ", binDir)
function showHelp() {
  console.log('Usage: tasks.mjs <action> [target] [args]')
  console.log('action: clean | build | run | test | reconfigure')
  console.log('target: the target to run')
  console.log('args: the arguments to pass to the target')
}

console.log(argv)

if (argv._.length == 1 || argv.h || argv.help) {
  showHelp()
}

// default is "set -euo pipefail;",
// `-u`: Treat unset variables as an error and exit immediately.

const customArgv = minimist(process.argv.slice(2), {
  ['--']: true
})

$.prefix = "set -eo pipefail;"
const conanRunEnv = path.join(binDir, conanRunFile)
// without args
if (customArgv._.length == 2) {
  await $`source ${conanRunEnv} && ${binDir}/src/${argv._[1]}/${argv._[1]} 1>&2`
}

// with args
if (customArgv._.length == 3) {
  await $`source ${conanRunEnv} && ${binDir}/src/${argv._[1]}/${argv._[1]} ${argv._[2]} 1>&2`
}
