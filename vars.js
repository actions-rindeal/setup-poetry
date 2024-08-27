const fs = require('fs')
const { execFileSync } = require('child_process')

/**
 * @param {import('@actions/github/lib/context').Context} context
 * @param {import('@actions/core')} core
 * @param {InstanceType<import('@actions/github/lib/utils').GitHub>} github
 * @param {import('@actions/exec')} exec
 * @param {import('@actions/glob')} glob
 * @param {import('@actions/io')} io
 * @param {NodeRequire} require
 */
async function main(context, core, github, exec, glob, io, require) {
    /**
     * Executes a Python command to retrieve user site-packages directory.
     * @param {string} dirType - The user directory type (e.g., 'base', 'site').
     * @returns {Promise<string>} - The result of the Python command execution.
     */
    const execPySite = async (dirType) => {
        const [cmd, args] = ['python3', ['-m', 'site', `--user-${dirType.toLowerCase()}`]]
        core.debug(`Executing: ${[cmd, ...args].map(arg => `\`${arg}\``).join(' ')}`)
        const result = execFileSync(cmd, args, { encoding: 'utf8' }).trim()
        core.debug(`Python site.USER_${dirType.toUpperCase()} = \`${result}\``)
        return result
    }

    /**
     * Gets the Python site cache key by executing site commands.
     * @returns {Promise<string>} - The Python site cache key.
     */
    const getPythonSiteCacheKey = async () => {   
        const [base, site] = await Promise.all([
            execPySite('base'),
            execPySite('site'),
        ])

        const key = site.slice(base.length)
        core.debug(`Python site cache key = \`${key}\``)

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
        if ( ! dir ) {
            throw new Error('VENV_BASE_DIR is not set')
        }
    
        const statPromise = () => new Promise((resolve, reject) => {
            fs.stat(dir)
                .then(stats => {
                    if ( ! stats.isDirectory() ) {
                        reject(new Error(`VENV_BASE_DIR \`${dir}\` is not a valid directory`))
                    } else {
                        resolve()
                    }
                })
                .catch(reject)
        })
    
        try {
            await Promise.all([
                statPromise(),
                fs.access(dir, fs.constants.W_OK)
            ])
        } catch (err) {
            if ( err.code === 'ENOENT' ) {
                throw new Error(`VENV_BASE_DIR \`${dir}\` does not exist`)
            } else if ( err.code === 'EACCES' ) {
                throw new Error(`VENV_BASE_DIR \`${dir}\` is not writable`)
            } else {
                throw err
            }
        }
    
        return dir
    }    

    const outputs = {
        'poetry-version':   await getPoetryVersion(),
        'venv-base-dir': `${await getVenvBaseDir()}/.poetry-venv`,
        'python-site-key':  await getPythonSiteCacheKey(),
    }
    for (const [key, value] of Object.entries(outputs)) {
        core.debug(`Setting output: \`${key}\` = \`${value}\``)
        core.setOutput(key, value)
    }
}

return await main(context, core, github, exec, glob, io, require)
