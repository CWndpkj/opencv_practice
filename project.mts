import 'zx/globals'
import { throws } from 'assert'
import { PathOrFileDescriptor } from 'fs-extra'
import { MSVCInstallDir } from './scripts/constants.mjs'
import { parseJsonFile, parseConfigFromJson, saveConfig2Json } from './scripts/utils/jsonHelper.mts'
import { usePowerShell } from 'zx';
import { EnvHelper, EnvOwner } from './scripts/envHelper.mts'

const jsonNodeName = 'projectConfigs'

if (process.platform === 'win32') {
  usePowerShell()
}

// default is "set -euo pipefail;",
// `-u`: Treat unset variables as an error and exit immediately.
if (process.platform != 'win32') {
  $.prefix = "set -eo pipefail;"
}

interface SetupConfig {
  presetsFile: PathOrFileDescriptor,
  selectedPreset: string,
}

interface ChangeConfig {
  buildConfig?: {
    target: string
  }
  launchConfig?: {
    target: string
    args: string
  }
  testConfig?: {
    ctestArgs: string
  }
}

class ProjectConfigs {
  projectConfigs: {
    configureConfig: {
      preset: string,
      sourceDir: string,
      binaryDir: string,
      installDir: string,
      buildType: string,
    }
    buildConfig: {
      target: string,
    }
    launchConfig: {
      target: string,
      args: string,
    }
    testConfig: {
      ctestArgs: string,
    }
  }

  changeConfig(config: ChangeConfig) {
    if (config.buildConfig) {
      this.projectConfigs.buildConfig = {
        ...this.projectConfigs.buildConfig,
        target: config.buildConfig.target
      }
    }
    if (config.launchConfig) {
      this.projectConfigs.launchConfig = {
        ...this.projectConfigs.launchConfig,
        target: config.launchConfig.target,
        args: config.launchConfig.args,
      }
    }
    if (config.testConfig) {
      this.projectConfigs.testConfig = {
        ...this.projectConfigs.testConfig,
        ctestArgs: config.testConfig.ctestArgs,
      }
    }
    saveConfig2Json(jsonNodeName, this.projectConfigs)
  }

  constructor(setupConfig?: SetupConfig) {
    this.projectConfigs = {
      configureConfig: {
        preset: '',
        sourceDir: '',
        binaryDir: '',
        installDir: '',
        buildType: '',
      },
      buildConfig: {
        target: '',
      },
      launchConfig: {
        target: '',
        args: '',
      },
      testConfig: {
        ctestArgs: '',
      }
    }
    if (setupConfig) {
      this._setup(setupConfig)
    }
    else
      try {
        const parsedConfig = parseConfigFromJson(jsonNodeName)
        this.projectConfigs.configureConfig = parsedConfig.configureConfig
        this.projectConfigs.buildConfig = parsedConfig.buildConfig
        this.projectConfigs.launchConfig = parsedConfig.launchConfig
        this.projectConfigs.testConfig = parsedConfig.testConfig
        saveConfig2Json(jsonNodeName, this.projectConfigs)
      } catch (e) {
        console.error('Unable to parse config from json file, possibly forgot to run setup first?')
      }
  }

  // NOTE: Change follow to set a default value for each config
  _setup = function (setupConfig: SetupConfig) {
    const presets = parseJsonFile(setupConfig.presetsFile)
    // for replace
    const sourceDir = process.cwd()
    const presetName = setupConfig.selectedPreset
    this.projectConfigs.configureConfig = {
      preset: setupConfig.selectedPreset,
      sourceDir: sourceDir,
      binaryDir: presets.configurePresets[0].binaryDir.replace(/\$\{(.*?)\}/g, (_, p1) => eval(p1)),
      installDir: presets.configurePresets[0].installDir.replace(/\$\{(.*?)\}/g, (_, p1) => eval(p1)),
      buildType: presets.configurePresets.find(item => item.name == setupConfig.selectedPreset).cacheVariables.CMAKE_BUILD_TYPE,
    }
    this.projectConfigs.buildConfig = {
      target: "all"
    }
    this.projectConfigs.launchConfig = {
      target: "",
      args: "",
    }
    this.projectConfigs.testConfig = {
      ctestArgs: "",
    }
    saveConfig2Json(jsonNodeName, this.projectConfigs)
  }
}

class Excutor {
  projectConfigs: ProjectConfigs
  envHelper: EnvHelper

  constructor(config: ProjectConfigs, envHelper: EnvHelper) {
    this.projectConfigs = config
    this.envHelper = envHelper
  }

  clean = async function () {
    if (fs.existsSync(this.projectConfigs.configureConfig.binaryDir)) {
      await fs.remove(this.projectConfigs.configureConfig.binaryDir)
    }
  }

  cmakeConfigure = async function () {
    if (this.projectConfigs.configureConfig.preset.includes('msvc')) {
      const cmakeConfigreCommand = `"cmake -S . --preset=${this.projectConfigs.configureConfig.preset}"`
      await $`powershell -Command ${cmakeConfigreCommand}`.pipe(process.stderr)
    } else {
      await $`cmake -S . --preset=${this.projectConfigs.configureConfig.preset}`.pipe(process.stderr)
    }
  }

  cmakeBuild = async function () {
    if (this.projectConfigs.configureConfig.preset.includes('msvc')) {
      const cmakeBuildCommand = `"Invoke-Environment ${this.projectConfigs.configureConfig.binaryDir}\\conan\\build\\${this.projectConfigs.configureConfig.buildType}\\generators\\conanrun.bat;cmake --build ${this.projectConfigs.configureConfig.binaryDir} --target ${this.projectConfigs.buildConfig.target}"`

      await $`powershell -Command ${cmakeBuildCommand}`.pipe(process.stderr)
    } else {
      await $`cmake --build ${this.projectConfigs.configureConfig.binaryDir} --target ${this.projectConfigs.buildConfig.target} `.pipe(process.stderr)
    }
  }

  runTarget = async function () {
    if (process.platform === 'win32') {
      const runTargetCommand = `"Invoke-Environment ${this.projectConfigs.configureConfig.binaryDir}\\conan\\build\\${this.projectConfigs.configureConfig.buildType}\\generators\\conanrun.bat;${this.projectConfigs.configureConfig.binaryDir}\\bin\\${this.projectConfigs.launchConfig.target} ${this.projectConfigs.launchConfig.args}"`
      await $`powershell -Command ${runTargetCommand}`.pipe(process.stderr)
    } else {
      await $`source ${this.projectConfigs.configureConfig.binaryDir}/conan/build/${this.projectConfigs.configureConfig.buildType}/generators/conanrun.sh && ${this.projectConfigs.configureConfig.binaryDir}/bin/${this.projectConfigs.launchConfig.target} ${this.projectConfigs.launchConfig.args}`.pipe(process.stderr)
    }
  }

  runTest = async function () {
    if (process.platform === 'win32') {
      const runTestCommand = `"Invoke-Environment ${this.projectConfigs.configureConfig.binaryDir}\\conan\\build\\${this.projectConfigs.configureConfig.buildType}\\generators\\conanrun.bat;ctest --preset ${this.projectConfigs.configureConfig.preset} ${this.projectConfigs.testConfig.ctestArgs}"`
      await $`powershell -Command ${runTestCommand}`.pipe(process.stderr)
    } else {
      await $`source ${this.projectConfigs.configureConfig.binaryDir}/conan/build/${this.projectConfigs.configureConfig.buildType}/generators/conanrun.sh && ctest --preset ${this.projectConfigs.configureConfig.preset} ${this.projectConfigs.testConfig.ctestArgs}`.pipe(process.stderr)
    }
  }

  cpack = async function () {
    if (process.platform === 'win32') {
      const cpackCommand = `"Invoke-Environment ${this.projectConfigs.configureConfig.binaryDir}\\conan\\build\\${this.projectConfigs.configureConfig.buildType}\\generators\\conanrun.bat;cd ${this.projectConfigs.configureConfig.binaryDir};cpack"`
      await $`powershell -Command ${cpackCommand}`.pipe(process.stderr)
    } else {
      await $`cd ${this.projectConfigs.configureConfig.binaryDir} && cpack`.pipe(process.stderr)
    }
  }
}

// This script is used to run target flexible
// usage: project.mjs <action> [target] [-- args]
// for example: 

// Get help
// tsx project.mts                          --------show help
// tsx project.mts -h                       --------show help
// tsx project.mts --help                   --------show help

// Setup the project(select a cmake preset, parse and store it)
// tsx project.mts setup  some_preset       --------setup the project with specified preset

// Clean the project
// tsx project.mts clean                    --------clean project

// Cmake configure
// tsx project.mts config                   --------run cmake configure

// Build the project
// tsx project.mts build                    --------build all targets
// tsx project.mts build some_target        --------build the target 'some_target'

// Run the target
// tsx project.mts run some_target          --------run the target 'some_target'
// tsx project.mts run some_target -- args  --------run the target 'some_target' with args

// Test the project
// tsx project.mts test                     --------run all tests
// tsx project.mts test some_test           --------run the test 'some_test'

// Pack the project
// tsx project.mts pack                     --------pack the project


function showHelp() {
  console.log('Usage: tsx project.mts <action> [target] [args]')
  console.log('action: clean | build | run | test | reconfigure')
  console.log('target: the target to run')
  console.log('args: the arguments to pass to the target')
}


async function main() {
  const presetsFile = 'CMakePresets.json'

  console.log(argv)
  if (argv._.length == 0 || argv.h || argv.help) {
    showHelp()
  }

  const myArgv = minimist(process.argv.slice(2), {
    ['--']: true
  })

  let changeConfig = {
    buildConfig: {
      target: 'all'
    },
    launchConfig: {
      target: '',
      args: '',
    },
    testConfig: {
      ctestArgs: ''
    }
  }

  // await excutor.cmakeGenerate()
  // await excutor.cmakeBuild()

  if (myArgv._[0] == 'setup') {
    console.log('Running setup...')
    if (myArgv._.length < 2) {
      console.error('Please specify a preset to setup')
      process.exit(1)
    }
    const setup = {
      presetsFile,
      selectedPreset: myArgv._[1],
    }
    new ProjectConfigs(setup)
    new EnvHelper().updateEnv()
    return
  }

  const config = new ProjectConfigs()
  const envHelper = new EnvHelper()
  const excutor = new Excutor(config, envHelper)

  // setup env
  if (process.platform === 'win32') {
    this.envHelper.applyEnv(EnvOwner.MSVC)
  }

  switch (myArgv._[0]) {
    case 'clean':
      console.log('Cleaning project...')
      await excutor.clean()
      break
    case 'config':
      console.log('Configuring project...')
      await excutor.clean()
      await excutor.cmakeConfigure()
      break
    case 'build':
      console.log('Building project...')
      if (myArgv._.length > 1) {
        console.log('building target:', myArgv._[0])
        changeConfig.buildConfig.target = myArgv._[0]
      } else {
        console.log("Building all targets")
        changeConfig.buildConfig.target = 'all'
      }
      config.changeConfig(changeConfig)
      await excutor.cmakeBuild()
      break
    case 'run':
      console.log('Running target...')
      if (myArgv._.length > 1) {
        console.log('runing target:', myArgv._[1])
        changeConfig.launchConfig.target = myArgv._[1]
        if (myArgv['--']) {
          console.log('args:', myArgv['--'].join(' '))
          changeConfig.launchConfig.args = myArgv['--'].join(' ')
        }
      } else {
        console.error("Please specify a target to run")
        return
      }
      config.changeConfig(changeConfig)
      await excutor.runTarget()
      break
    case 'test':
      console.log('Testing project...')
      if (myArgv['--']) {
        console.log('args:', myArgv['--'].join(' '))
        changeConfig.testConfig.ctestArgs = myArgv['--'].join(' ')
        config.changeConfig(changeConfig)
        await excutor.runTest()
      }
      break
    case 'pack':
      console.log('Packing project...')
      await excutor.cpack()
      break
    default:
      showHelp()
      break
  }
}
main()
