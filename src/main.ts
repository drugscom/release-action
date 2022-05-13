import * as core from '@actions/core'
import * as github from '@actions/github'
import * as helpers from './helpers'
import {RequestError} from '@octokit/request-error'

async function run(): Promise<void> {
  try {
    const token = core.getInput('tokens')
    const tagPrefix = core.getInput('tag-prefix')
    const updateMajor = core.getBooleanInput('update-major-tag')

    const octokit = github.getOctokit(token)
    const {owner: owner, repo: repo} = github.context.repo
    const sha = github.context.sha

    const releaseVersion = await helpers.getReleaseVersion(octokit, owner, repo, sha)
    if (!releaseVersion) {
      core.warning('Could not determine the release version, ignoring commit')
      return
    }

    core.info(`Creating tag for version ${releaseVersion}`)
    const releaseTagName = `${tagPrefix}${releaseVersion.version}`
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/tags/${releaseTagName}`,
      sha
    })

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
