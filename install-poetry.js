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
    const steps = JSON.parse(process.env['STEPS'])
    const boolMap = {true: true, false: false}
    const inputs = {
        'venv-base-dir':     steps['vars']             .outputs['venv-base-dir'] ?.trim(),
        'poetry-version':    steps['vars']             .outputs['poetry-version']?.trim(),
        'cache-hit': boolMap[steps['poetry-venv-cache'].outputs['cache-hit']     ?.trim().toLowerCase()],
    }

    core.debug(`Inputs: ${JSON.stringify(inputs)}`)

    const validateInputs = () => {
        if ( typeof inputs['poetry-version'] !== 'string' || ! inputs['poetry-version'].length ) {
            throw new Error("Version must be a non-empty string")
        }
        if ( typeof inputs['cache-hit'] !== 'boolean' ) {
            throw new Error(`Invalid cache-hit value: \`${inputs['cache-hit']}\``)
        }
        if ( inputs['cache-hit'] ) {
            if ( ! fs.existsSync(inputs['venv-base-dir']) || ! fs.lstatSync(inputs['venv-base-dir']).isDirectory() ) {
                throw new Error(`The path \`${inputs['venv-base-dir']}\` is not a directory`)
            }
        }
    }

    const execWithAnnounce = (command, args) => {
        core.debug(`Executing: ${[command, ...args].map(arg => `\`${arg}\``).join(' ')}`)
        return execFileSync(command, args, { encoding: 'utf8' }).trim()
    }

    const installPoetry = () => {
        core.info(`Installing Poetry version ${inputs['poetry-version']}`)
        execWithAnnounce('python3', ['-m', "venv", inputs['venv-base-dir']])
        execWithAnnounce(`${inputs['venv-base-dir']}/bin/pip`, ['install', `poetry===${inputs['poetry-version']}`])
    }

    validateInputs()

    if ( ! inputs['cache-hit'] ) {
        core.info('Cache miss. Installing Poetry...')
        installPoetry()
    } else {
        core.info('Using cached Poetry installation')
    }

    core.addPath(`${inputs.venv}/bin`)
    core.info('Poetry installation complete')
}

return await main(context, core, github, exec, glob, io, require)
