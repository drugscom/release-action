import * as core from '@actions/core'
import * as github from '@actions/github'
import * as helpers from './helpers'
import {RequestError} from '@octokit/request-error'
import * as utils from '@actions/utils'
import * as semver from 'semver'

async function run(): Promise<void> {
  try {
    const token = core.getInput('token')
    const tagPrefix = core.getInput('tag-prefix')
    const updateMajor = core.getBooleanInput('update-major-tag')

    const octokit = github.getOctokit(token)
    const {owner: owner, repo: repo} = github.context.repo
    const sha = github.context.sha

    let releaseTagName: string
    let releaseVersion: semver.SemVer | null

    if (utils.gitEventIsPushTag()) {
      core.debug('Getting version from pushed tag')
      releaseTagName = utils.getGitRef()

      releaseVersion = semver.coerce(releaseTagName)
      if (!releaseVersion) {
        core.warning(`Tag is not a valid version: ${releaseTagName}, ignoring event`)
        return
      }
    } else {
      core.debug('Getting version from related pull-requests')
      releaseVersion = await helpers.getReleaseVersion(octokit, owner, repo, sha)
      if (!releaseVersion) {
        core.warning('Could not determine the release version, ignoring event')
        return
      }

      releaseTagName = `${tagPrefix}${releaseVersion.version}`

      core.info(`Creating tag for version ${releaseVersion}`)
      await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/tags/${releaseTagName}`,
        sha
      })
    }

    core.info(`Creating release for tag ${releaseTagName}`)
    await octokit.rest.repos.createRelease({
      owner,
      repo,
      tag_name: releaseTagName
    })

    if (!updateMajor) {
      return
    }

    const majorTagName = `${tagPrefix}${releaseVersion.major}`
    try {
      await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `tags/${majorTagName}`
      })

      core.info(`Updating major version tag: ${majorTagName}`)
      await octokit.rest.git.updateRef({
        owner,
        repo,
        ref: `tags/${majorTagName}`,
        sha,
        force: true
      })
    } catch (error) {
      if (error instanceof RequestError && error.status === 404) {
        core.info(`Creating major version tag: ${majorTagName}`)
        await octokit.rest.git.createRef({
          owner,
          repo,
          ref: `refs/tags/${majorTagName}`,
          sha
        })
      }
    }
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    core.setFailed(error.message)
  }
}

void run()
