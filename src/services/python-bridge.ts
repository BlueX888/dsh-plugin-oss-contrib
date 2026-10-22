import { spawn, ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
export interface PythonCallOptions {
  cwd?: string
  env?: Record<string, string>
  timeout?: number
  signal?: AbortSignal
}
export interface ProcessResult {
  stdout: string
  stderr: string
  code: number | null
}
export class PythonBridge {
  private children = new Set<ChildProcess>()
  private disposed = false
  readonly pythonBin: string
  readonly defaultEnv: Record<string, string>
  readonly bridgePath = join(dirname(fileURLToPath(import.meta.url)), '../../python/bridge.py')
  private timeout: number
  constructor(config: {
    ossBin?: string
    pythonBin?: string
    env?: Record<string, string>
    timeout?: number
  }) {
    this.pythonBin = config.pythonBin || 'python'
    this.defaultEnv = {
      OSS_BIN: config.ossBin || 'F:/PR/bin',
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
      PYTHONDONTWRITEBYTECODE: '1',
      ...config.env,
    }
    this.timeout = config.timeout || 120000
  }
  private kill(proc: ChildProcess) {
    if (!proc.pid || proc.exitCode !== null) return
    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      })
      killer.on('error', () => proc.kill())
    } else {
      try {
        process.kill(-proc.pid, 'SIGKILL')
      } catch {
        proc.kill('SIGKILL')
      }
    }
  }
  async dispose() {
    this.disposed = true
    await Promise.all(
      [...this.children].map(
        (proc) =>
          new Promise<void>((resolve) => {
            proc.once('close', () => resolve())
            this.kill(proc)
          }),
      ),
    )
  }
  private run(
    script: string,
    args: string[],
    options: PythonCallOptions,
    input?: string,
  ): Promise<ProcessResult> {
    if (this.disposed) return Promise.reject(new Error('Python bridge disposed'))
    if (options.signal?.aborted) return Promise.reject(new Error('Operation cancelled'))
    return new Promise((resolve, reject) => {
      const proc = spawn(this.pythonBin, [script, ...args], {
        cwd: options.cwd,
        env: { ...process.env, ...this.defaultEnv, ...options.env },
        windowsHide: true,
        detached: process.platform !== 'win32',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      this.children.add(proc)
      let stdout = '',
        stderr = '',
        failure: Error | undefined
      const abort = (reason: string) => {
        failure ||= new Error(reason)
        this.kill(proc)
      }
      const cancel = () => abort('Operation cancelled')
      const timer = setTimeout(
        () => abort('Python operation timed out after ' + (options.timeout ?? this.timeout) + 'ms'),
        options.timeout ?? this.timeout,
      )
      options.signal?.addEventListener('abort', cancel, { once: true })
      proc.stdout.setEncoding('utf8')
      proc.stderr.setEncoding('utf8')
      proc.stdout.on('data', (d) => {
        stdout += d
        if (stdout.length > 16 * 1024 * 1024) abort('Python output exceeded 16 MiB')
      })
      proc.stderr.on('data', (d) => {
        stderr = (stderr + d).slice(-1024 * 1024)
      })
      proc.stdin.on('error', () => {})
      proc.stdin.end(input)
      const cleanup = () => {
        clearTimeout(timer)
        options.signal?.removeEventListener('abort', cancel)
        this.children.delete(proc)
      }
      proc.on('error', (err) => {
        cleanup()
        reject(err)
      })
      proc.on('close', (code) => {
        cleanup()
        if (failure) reject(failure)
        else resolve({ stdout, stderr, code })
      })
    })
  }
  exec(script: string, args: string[] = [], options: PythonCallOptions = {}) {
    return this.run(script, args, options)
  }
  async call(
    module: string,
    method: string,
    args: any[] = [],
    kwargs: Record<string, any> = {},
    options: PythonCallOptions = {},
  ): Promise<any> {
    const result = await this.run(
      this.bridgePath,
      [],
      options,
      JSON.stringify({ module, method, args, kwargs }),
    )
    let response: any
    try {
      response = JSON.parse(result.stdout)
    } catch {
      throw new Error('Invalid Python response: ' + (result.stderr || result.stdout))
    }
    if (result.code !== 0 || response.status !== 'ok')
      throw new Error(response.error || result.stderr || 'Python operation failed')
    return response.result
  }
}
