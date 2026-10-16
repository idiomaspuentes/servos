/**
 * The Door43 (DCS, a Gitea) client Servos publishes with: the parts of Taller's `packages/dcs-client` (itself taken
 * from Idiomas Puentes' LMS) that publishing needs, copied as they are so the two stay comparable: signing in (a
 * password exchanged for a token, never kept), files, repositories, releases.
 */

export { QA_HOST, PRODUCTION_HOST, type DcsClientConfig } from './config'
export { DcsApiError } from './errors'
export { signInWithPassword, getAuthenticatedUser, type DcsUser } from './auth'
export { getContents, createOrUpdateContents, createOrUpdateBinaryContents, type ContentsResponse } from './content'
export { decodeBase64 } from './base64'
export { getRepo, createOrgRepo, getUserOrgs, type DcsRepo, type DcsOrg } from './repos'
export { createRelease, listReleases, type DcsRelease } from './releases'
