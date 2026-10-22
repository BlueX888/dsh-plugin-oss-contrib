import { spawn } from 'child_process'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export interface PythonCallOptions {
  cwd?: string
  env?: Record<string, string>
  timeout?: number
}

export interface PythonResponse {
  status: 'ok' | 'error'
  result?: any
  error?: string
  type?: string
}

/**
 * Python Bridge Service
 * Provides JSON-based IPC to Python modules via bridge.py
 */
export class PythonBridge {
  private bridgePath: string
  private pythonBin: string
  private defaultEnv: Record<string, string>

  constructor(config: { ossBin?: string; pythonBin?: string }) {
    // Resolve bridge.py path (relative to this file)
    this.bridgePath = join(__dirname, '../../python/bridge.py')

    // Python interpreter (default to 'python' on Windows)
    this.pythonBin = config.pythonBin || 'python'

    // Default environment
    this.defaultEnv = {
      OSS_BIN: config.ossBin || 'F:/PR/bin',
      PYTHONIOENCODING: 'utf-8',
    }
  }

  /**
   * Call a Python module method
   *
   * @param module - Module name (e.g., 'state', 'publish')
   * @param method - Method/function name
   * @param args - Positional arguments
   * @param kwargs - Keyword arguments
   * @param options - Call options (cwd, env, timeout)
   * @returns Promise resolving to the Python function result
   */
  async call(
    module: string,
    method: string,
    args: any[] = [],
    kwargs: Record<string, any> = {},
    options: PythonCallOptions = {}
  ): Promise<any> {
    const command = {
      module,
      method,
      args,
      kwargs,
    }

    const input = JSON.stringify(command)

    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        ...this.defaultEnv,
        ...(options.env || {}),
      }

      const proc = spawn(this.pythonBin, [this.bridgePath], {
        cwd: options.cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      proc.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      // Write input to stdin
      proc.stdin.write(input)
      proc.stdin.end()

      // Timeout handling
      let timeoutId: NodeJS.Timeout | undefined
      if (options.timeout) {
        timeoutId = setTimeout(() => {
          proc.kill()
          reject(new Error(`Python call timeout after ${options.timeout}ms`))
        }, options.timeout)
      }

      proc.on('close', (code) => {
        if (timeoutId) clearTimeout(timeoutId)

        try {
          const response: PythonResponse = JSON.parse(stdout)

          if (response.status === 'ok') {
            resolve(response.result)
          } else {
            const error = new Error(response.error || 'Python call failed')
            ;(error as any).type = response.type
            ;(error as any).stderr = stderr
            reject(error)
          }
        } catch (e) {
          reject(new Error(`Failed to parse Python response: ${stdout}\nStderr: ${stderr}`))
        }
      })

      proc.on('error', (err) => {
        if (timeoutId) clearTimeout(timeoutId)
        reject(new Error(`Failed to spawn Python process: ${err.message}`))
      })
    })
  }

  /**
   * Execute a Python script with arguments (simpler interface for scripts)
   *
   * @param scriptPath - Full path to Python script
   * @param args - Command-line arguments
   * @param options - Call options
   * @returns Promise resolving to {stdout, stderr, code}
   */
  async exec(
    scriptPath: string,
    args: string[] = [],
    options: PythonCallOptions = {}
  ): Promise<{ stdout: string; stderr: string; code: number | null }> {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        ...this.defaultEnv,
        ...(options.env || {}),
      }

      const proc = spawn(this.pythonBin, [scriptPath, ...args], {
        cwd: options.cwd,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      proc.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      let timeoutId: NodeJS.Timeout | undefined
      if (options.timeout) {
        timeoutId = setTimeout(() => {
          proc.kill()
          reject(new Error(`Script execution timeout after ${options.timeout}ms`))
        }, options.timeout)
      }

      proc.on('close', (code) => {
        if (timeoutId) clearTimeout(timeoutId)
        resolve({ stdout, stderr, code })
      })

      proc.on('error', (err) => {
        if (timeoutId) clearTimeout(timeoutId)
        reject(err)
      })
    })
  }
}
