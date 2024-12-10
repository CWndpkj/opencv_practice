// This file is used to manage the environment variables for the current shell.
// Normally, we don't need to use this to manage the environment variables, 
// because the environment variables are loaded by .bashrc or .zshrc when the shell is started. 
// However, in some cases, we need to set some environment variables for the current shell, 
// such as activating MSVC environment variables or installing tools without the ability to restart the shell.

import child_process from "child_process"
import { findVcvarsall } from "./findMSVC.mts"
import { parseConfigFromJson, saveConfig2Json } from "./utils/jsonHelper.mjs"
import { MSVCInstallDir } from "./constants.mts"

const jsonNodeName = 'projectConfigs'

interface Env {
  [key: string]: string
}
interface EnvList {
  [key: string]: Env
}

export enum EnvOwner {
  ALL = "all",
  MSVC = "msvc",
  NODE = "node",
  PYTHON = "python"
}
type outputChecker = (output: string) => boolean

export class EnvHelper {
  env: EnvList
  constructor() {
    this.env = {}
  }
  exportVariable(owner: EnvOwner, name: string, value: string) {
    this.env[owner][name] = value
  }
  exportVariableList(owner: EnvOwner, env: Env) {
    this.env[owner] = { ...this.env[owner], ...env }
  }
  save2Json() {
    saveConfig2Json(jsonNodeName, this.env)
  }
  loadFromJson() {
    this.env = parseConfigFromJson("env")
  }
  updateEnv() {
    if (process.platform == "win32") {
      this.setupMSVCEnv('x64', MSVCInstallDir, undefined, undefined, undefined, undefined, '2022')
    } else if (process.platform == "linux") {
      // Only in github action ,variable CI set to true
      if (process.env.CI) {
        this.setupNodeEnv()
        this.setupPythonEnv()
      }
    } else {
      console.error("Unsupported platform")
      process.exit()
    }
    this.save2Json()
  }
  applyEnv(owner: EnvOwner | EnvOwner[]) {
    if (typeof owner === "string") {
      // Single EnvType
      for (let key in this.env[owner]) {
        process.env[key] = this.env[owner][key]
      }
    } else {
      // Multiple EnvType
      for (let ow of owner) {
        this.applyEnv(ow)
      }
    }
  }

  // INFO: already loaded in .bashrc or .zshrc nomally,but needed by github action and tools instalation
  setupNodeEnv() {
    this.exportVariable(EnvOwner.NODE, "VOLTA_HOME", "$HOME/.volta")
    this.exportVariable(EnvOwner.NODE, "PATH", "$PATH:$VOLTA_HOME/bin")
  }

  // INFO: already loaded in .bashrc or .zshrc nomally,but needed by github action
  setupPythonEnv() {
    this.exportVariable(EnvOwner.PYTHON, "PYENV_ROOT", "$HOME/.pyenv")
    this.exportVariable(EnvOwner.PYTHON, "PATH", "$PATH:$PYENV_ROOT/bin")
    this.exportVariable(EnvOwner.PYTHON, "PATH", "$PATH:$PYENV_ROOT/shims")
  }

  private windowsParseEnv(owner: EnvOwner, command: string, checker?: outputChecker) {
    const cmd_output_string = child_process
      .execSync(`set && cls && ${command} && cls && set`, { shell: "cmd" })
      .toString()
    const cmd_output_parts = cmd_output_string.split("\f")

    const old_environment = cmd_output_parts[0].split("\r\n")
    const vcvars_output = cmd_output_parts[1]
    const new_environment = cmd_output_parts[2].split("\r\n")

    // check command output to decide the validity of the env
    if (checker && !checker(vcvars_output)) {
      console.log("!!!envHelper!!!:Invalid command output")
      process.exit()
    }
    // Convert old environment lines into a dictionary for easier lookup.
    let old_env_vars = {};
    for (let string of old_environment) {
      const [name, value] = string.split("=");
      old_env_vars[name] = value;
    }

    // TODO: Verify wether this function is needed
    function isPathVariable(name) {
      const pathLikeVariables = ["PATH", "INCLUDE", "LIB", "LIBPATH"];
      return pathLikeVariables.indexOf(name.toUpperCase()) != -1;
    }

    function filterPathValue(path) {
      let paths = path.split(";");
      // Remove duplicates by keeping the first occurance and preserving order.
      // This keeps path shadowing working as intended.
      function unique(value, index, self) {
        return self.indexOf(value) === index;
      }
      return paths.filter(unique).join(";");
    }

    // Now look at the new environment and export everything that changed.
    // These are the variables set by vsvars.bat. Also export everything
    // that was not there during the first sweep: those are new variables.
    for (let string of new_environment) {
      // vsvars.bat likes to print some fluff at the beginning.
      // Skip lines that don't look like environment variables.
      if (!string.includes("=")) {
        continue;
      }
      let [name, new_value] = string.split("=");
      let old_value = old_env_vars[name];
      // For new variables "old_value === undefined".
      if (new_value !== old_value) {
        // Special case for a bunch of PATH-like variables: vcvarsall.bat
        // just prepends its stuff without checking if its already there.
        // This makes repeated invocations of this action fail after some
        // point, when the environment variable overflows. Avoid that.
        if (isPathVariable(name)) {
          new_value = filterPathValue(new_value);
        }
        this.env[owner][name] = new_value;
      }
    }
  }

  private linuxParseEnv(command: string, checker?: outputChecker) {
    // Not implemented yet , for extent
  }

  /** See https://github.com/ilammy/msvc-dev-cmd#inputs */
  setupMSVCEnv(
    arch,
    vspath,
    sdk,
    toolset,
    uwp,
    spectre,
    vsversion
  ) {

    if (process.platform != "win32") {
      console.info("This is not a Windows virtual environment, bye!");
      return;
    }

    // There are all sorts of way the architectures are called. In addition to
    // values supported by Microsoft Visual C++, recognize some common aliases.
    let arch_aliases = {
      win32: "x86",
      win64: "x64",
      x86_64: "x64",
      "x86-64": "x64",
    };
    // Ignore case when matching as that's what humans expect.
    if (arch.toLowerCase() in arch_aliases) {
      arch = arch_aliases[arch.toLowerCase()];
    }

    // Due to the way Microsoft Visual C++ is configured, we have to resort to the following hack:
    // Call the configuration batch file and then output *all* the environment variables.

    var args = [arch];
    if (uwp == "true") {
      args.push("uwp");
    }
    if (sdk) {
      args.push(sdk);
    }
    if (toolset) {
      args.push(`-vcvars_ver=${toolset}`);
    }
    if (spectre == "true") {
      args.push("-vcvars_spectre_libs=spectre");
    }

    const vcvars = `"${findVcvarsall(vsversion, vspath)}" ${args.join(" ")}`;
    console.debug(`vcvars command-line: ${vcvars}`);

    // If vsvars.bat is given an incorrect command line, it will print out
    // an error and *still* exit successfully. Parse out errors from output
    // which don't look like environment variables, and fail if appropriate.
    const errorChecker = (output: string): boolean => {
      const error_messages = output.split("\r\n").filter((line) => {
        if (line.match(/^\[ERROR.*\]/)) {
          // Don't print this particular line which will be confusing in output.
          if (!line.match(/Error in script usage. The correct usage is:$/)) {
            return true
          }
        }
        return false
      })
      if (error_messages.length > 0) {
        console.error(
          "invalid parameters" + "\r\n" + error_messages.join("\r\n")
        )
        return false
      } else {
        return true
      }
    }
    this.windowsParseEnv(EnvOwner.MSVC, vcvars, errorChecker)
    console.info(`Configured Developer Command Prompt`)
  }
}


