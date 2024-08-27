const fs = require('fs')
const { execFileSync } = require('child_process')

/**
 * @typedef {import('@actions/github/lib/context').Context} Context
 * @typedef {import('@actions/core')} core
 * @typedef {import('@actions/exec')} exec
 * @typedef {import('@actions/github/lib/utils').GitHub} GitHub
 * @typedef {import('@actions/glob')} glob
 * @typedef {import('@actions/io')} io
 */

/**
 * @param {Context} context - The GitHub Actions context
 * @param {core} core - The core functions from GitHub Actions
 * @param {InstanceType<GitHub>} github - The GitHub API client
 * @param {exec} exec - The exec functions from GitHub Actions
 * @param {glob} glob - The glob functions from GitHub Actions
 * @param {io} io - The io functions from GitHub Actions
 * @param {NodeRequire} require - The Node.js require function
 */
async function main(context, core, github, exec, glob, io, require) {
    /**
     * Executes a command with arguments and returns the trimmed output.
     * @param {string} command - The command to execute.
     * @param {string[]} args - The arguments for the command.
     * @returns {string} - The trimmed output of the command.
     */
    const execWithAnnounce = (command, args) => {
        core.debug(`Executing: ${[command, ...args].map(arg => `\`${arg}\``).join(' ')}`)
        return execFileSync(command, args, { encoding: 'utf8' }).trim()
    }

    /**
     * Gets the Python site key by executing site commands.
     * @returns {Promise<string>} - The Python site key.
     */
    const getPythonSiteKey = async () => {
        const [ base, site ] = await Promise.all([
            execWithAnnounce('python3', ['-m', 'site', '--user-base']),
            execWithAnnounce('python3', ['-m', 'site', '--user-site']),
        ])
        core.debug(`Python site.USER_BASE = \`${base}\``)
        core.debug(`Python site.USER_SITE = \`${site}\``)
        const key = site.slice(base.length)
        core.debug(`Python site key = \`${key}\``)
        return key
    }

    /**
     * Gets the specified or latest Poetry version.
     * @returns {Promise<string>} - The Poetry version.
     * @throws {Error} - If the 'poetry-version' input is undefined.
     */
    const getPoetryVersion = async () => {
        const inputs = JSON.parse(process.env['INPUTS'])
        const version = inputs['poetry-version']
        if ( typeof version === 'undefined' ) {
            throw new Error(`'poetry-version' input is undefined`)
        }
        if ( version ) {
            core.info(`Using specified Poetry version: \`${version}\``)
            return version
        }

        core.info('Fetching latest Poetry version...')
        const latestVersion = await github.rest.repos.getLatestRelease({
            owner: 'python-poetry',
            repo: 'poetry'
        }).then(response => response.data.tag_name.replace(/^v/, ''))

        core.info(`Latest Poetry version: ${latestVersion}`)
        return latestVersion
    }

    /**
     * Gets the base directory for the virtual environment.
     * @returns {Promise<string>} - The base directory for the virtual environment.
     * @throws {Error} - If the directory does not exist or is not writable.
     */
    const getVenvBaseDir = async () => {
        const dir = process.env['VENV_BASE_DIR']
        if ( ! fs.existsSync(dir) || ! fs.statSync(dir).isDirectory() ) {
            throw new Error(`VENV_BASE_DIR \`${dir}\` is not a valid directory`)
        }
        try {
            fs.accessSync(dir, fs.constants.W_OK)
        } catch (err) {
            throw new Error(`VENV_BASE_DIR \`${dir}\` is not writable`)
        }
        return dir
    }

    const outputs = {
        'poetry-version':   await getPoetryVersion(),
        'venv-base-dir': `${await getVenvBaseDir()}/.poetry-venv`,
        'python-site-key':  await getPythonSiteKey(),
    }
    for (const [key, value] of Object.entries(outputs)) {
        core.debug(`Setting output: \`${key}\` = \`${value}\``)
        core.setOutput(key, value)
    }
}

return await main(context, core, github, exec, glob, io, require)
