import * as core from '@actions/core'
import * as semver from 'semver'
import * as utils from '@actions/utils'
import {Api} from '@octokit/plugin-rest-endpoint-methods/dist-types/types'
import {Octokit} from '@octokit/core'
import {components} from '@octokit/openapi-types'

export async function getReleaseVersion(
  octokit: Octokit & Api,
  owner: string,
  repo: string,
  sha: string
): Promise<semver.SemVer | undefined> {
  if (utils.gitEventIsPushTag()) {
    core.debug('Getting version from pushed tag')

    const versionRaw = utils.getGitRef()

    const version = semver.coerce(versionRaw)
    if (!version) {
      core.warning(`Tag is not a valid version: ${versionRaw}`)
      return
    }

    return version
  }

  core.debug('Finding related PRs')
  const {data: relatedPRs} = await octokit.rest.search.issuesAndPullRequests({
    q: `type:pr state:closed is:merged label:release:major,release:minor,release:patch repo:${owner}/${repo} SHA:${sha}`,
    sort: 'created',
    per_page: 1
  })

  if (relatedPRs.total_count < 1) {
    core.warning(`No release PR found for commit: ${sha}`)
    return
  }

  if (relatedPRs.total_count > 1) {
    core.warning(`Multiple PRs found for commit "${sha}", will use the most recent`)
  }

  core.debug('Getting release type')
  const releaseType = getReleaseType(relatedPRs.items[0])

  core.debug('Getting latest version')
  const {data: latestRelease} = await octokit.rest.repos.getLatestRelease({owner, repo})
  const latestVersion = semver.coerce(latestRelease.tag_name)
  if (!latestVersion) {
    throw new Error(`Error parsing error string: ${latestRelease.tag_name}`)
  }
  core.debug(`Repo latest release version is ${latestVersion}`)

  const newVersion = latestVersion.inc(releaseType)

  core.debug(`Incrementing ${releaseType} version to ${newVersion}`)

  return newVersion
}

function getReleaseType(pullRequest: components['schemas']['issue-search-result-item']): semver.ReleaseType {
  for (const label of pullRequest.labels) {
    if (label.name?.startsWith('release:')) {
      return label.name.substring(8) as semver.ReleaseType
    }
  }

  throw new Error(`Error parsing release tag on pull-request`)
}
