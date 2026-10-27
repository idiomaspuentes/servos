import { resolve } from 'node:path'

/**
 * Where bt-synergy is, and whether it is the one Servos was tested with.
 *
 * Servos builds from bt-synergy's sources. The shared checkout beside this repository once fell 63 commits behind
 * without anything noticing, so the folder is configurable (`SERVOS_BT_SYNERGY`) and the commit Servos was tested
 * with is pinned in `bt-synergy.ref`; a test checks that the folder in use contains it.
 */

/** The bt-synergy checkout: `SERVOS_BT_SYNERGY` when set and not empty, else `../bt-synergy` beside `configDir`. */
export function btSynergyRoot(configDir: string, env: Record<string, string | undefined> = process.env): string {
  const chosen = env.SERVOS_BT_SYNERGY
  return chosen ? resolve(chosen) : resolve(configDir, '../bt-synergy')
}

export type Git = (args: string[]) => { status: number; stdout: string }

export type RefCheck = { state: 'contains' | 'behind' | 'not-git' | 'missing'; message: string }

/**
 * Does the checkout at `root` contain the pinned commit `ref`? `not-git` (a copy without history) cannot be checked,
 * so it only warns; a folder that does not exist or that lacks the commit fails, saying what to do.
 */
export function checkBtSynergyRef(args: {
  root: string
  ref: string
  exists: (path: string) => boolean
  git: Git
}): RefCheck {
  const { root, ref, exists, git } = args
  if (!exists(root)) {
    return {
      state: 'missing',
      message: `bt-synergy folder not found: ${root}. Put a checkout there, or set SERVOS_BT_SYNERGY to one.`,
    }
  }
  if (git(['-C', root, 'rev-parse', '--git-dir']).status !== 0) {
    return {
      state: 'not-git',
      message: `${root} is not a git repository, so it cannot be checked against the pinned bt-synergy commit ${ref}.`,
    }
  }
  if (git(['-C', root, 'merge-base', '--is-ancestor', ref, 'HEAD']).status === 0) {
    return { state: 'contains', message: `${root} contains bt-synergy ${ref}.` }
  }
  return {
    state: 'behind',
    message:
      `${root} does not contain the bt-synergy commit Servos was tested with (${ref}, in bt-synergy.ref). ` +
      `Either bring master into that checkout, or set SERVOS_BT_SYNERGY to a checkout that has it.`,
  }
}
