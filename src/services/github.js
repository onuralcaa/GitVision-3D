import { Octokit } from '@octokit/core'

const TOKEN = import.meta.env.VITE_GITHUB_TOKEN || ''

// Warn if no token is provided
if (!TOKEN) {
  console.warn('⚠️ No GitHub token found. API calls will be rate-limited. Please set VITE_GITHUB_TOKEN in .env')
}

const octokit = new Octokit({ auth: TOKEN || undefined })

// Check rate limit status from response headers
function checkRateLimit(response) {
  const remaining = response.headers['x-ratelimit-remaining']
  const limit = response.headers['x-ratelimit-limit']
  const reset = response.headers['x-ratelimit-reset']
  
  if (remaining === '0' || parseInt(remaining) === 0) {
    const resetDate = new Date(parseInt(reset) * 1000)
    const waitTime = resetDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    const errorMsg = `GitHub API rate limit exceeded. Token eklemelisiniz. Limit sıfırlanacağı zaman: ${waitTime}`
    throw new Error(errorMsg)
  }
  
  // Warn if limit is running low
  if (parseInt(remaining) < 50) {
    console.warn(`⚠️ GitHub API rate limit running low: ${remaining}/${limit} requests remaining`)
  }
}

// Fetch default branch via GraphQL, then fetch tree via REST for efficiency.
export async function fetchRepoData(owner, repo, onProgress = null){
  if (!TOKEN) {
    throw new Error('GitHub token required. Please create a Personal Access Token at https://github.com/settings/tokens and add it to .env file as VITE_GITHUB_TOKEN')
  }
  
  if (onProgress) onProgress(5)
  
  // get default branch name via GraphQL
  const q = `query($owner:String!, $name:String!){ repository(owner:$owner, name:$name){ defaultBranchRef{ name } } }`
  let resp
  try {
    resp = await octokit.graphql(q, { owner, name: repo })
  } catch(e) {
    if (e.status === 403 || e.message.includes('API rate limit')) {
      throw new Error(`GitHub API rate limit exceeded. Token eklemelisiniz. Lütfen GitHub Personal Access Token oluşturun: https://github.com/settings/tokens`)
    }
    throw new Error(`Failed to fetch repo: ${e.message}`)
  }
  
  if (onProgress) onProgress(15)
  
  const branch = resp.repository.defaultBranchRef ? resp.repository.defaultBranchRef.name : 'main'

  // get branch commit to obtain tree sha
  let branchInfo
  try {
    branchInfo = await octokit.request('GET /repos/{owner}/{repo}/branches/{branch}', { owner, repo, branch })
    checkRateLimit(branchInfo)
  } catch(e) {
    if (e.message.includes('rate limit')) {
      throw e
    }
    if (e.status === 403) {
      throw new Error(`GitHub API rate limit exceeded. Token eklemelisiniz. Lütfen GitHub Personal Access Token oluşturun: https://github.com/settings/tokens`)
    }
    throw new Error(`Failed to fetch branch info: ${e.message}`)
  }
  
  if (onProgress) onProgress(25)
  
  const treeSha = branchInfo.data.commit.commit.tree.sha

  // get recursive tree
  let tree
  try {
    tree = await octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}?recursive=1', { owner, repo, tree_sha: treeSha })
    checkRateLimit(tree)
  } catch(e) {
    if (e.message.includes('rate limit')) {
      throw e
    }
    if (e.status === 403) {
      throw new Error(`GitHub API rate limit exceeded. Token eklemelisiniz. Lütfen GitHub Personal Access Token oluşturun: https://github.com/settings/tokens`)
    }
    throw new Error(`Failed to fetch tree: ${e.message}`)
  }

  if (onProgress) onProgress(45)

  // collect files (blobs)
  const blobs = (tree.data.tree || []).filter(e=>e.type === 'blob')

  // limit to reasonable number to avoid rate limits
  const maxFiles = 400
  const files = []
  const processedBlobs = Math.min(maxFiles, blobs.length)
  
  for(const [idx, b] of blobs.slice(0, maxFiles).entries()){
    const path = b.path
    const size = b.size || 0
    // fetch last commit for this file (REST) - per-file call; may be slow
    let lastCommitDate = null
    try{
      const commits = await octokit.request('GET /repos/{owner}/{repo}/commits', { owner, repo, path, per_page: 1 })
      checkRateLimit(commits)
      if(commits.data && commits.data[0]) lastCommitDate = commits.data[0].commit.committer?.date || commits.data[0].commit.author?.date
    }catch(e){ 
      if (e.message.includes('rate limit')) {
        throw e
      }
      // silently ignore per-file commit fetches; they can fail if token has limited scopes
      console.debug(`Skipped commit for ${path}: ${e.message}`)
    }
    files.push({ path, size, lastCommitDate })
    
    // Update progress: 45% + (45% / total * current)
    const progressPercentage = 45 + Math.round((45 / processedBlobs) * (idx + 1))
    if (onProgress) onProgress(Math.min(95, progressPercentage))
  }

  return { owner, repo, branch, files }
}

export async function fetchFileContent(owner, repo, path, branch){
  if (!TOKEN) {
    throw new Error('GitHub token required. Please create a Personal Access Token at https://github.com/settings/tokens and add it to .env file as VITE_GITHUB_TOKEN')
  }

  try {
    const response = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner,
      repo,
      path,
      ref: branch,
      headers: {
        accept: 'application/vnd.github.raw+json'
      }
    })
    
    checkRateLimit(response)

    if (typeof response.data === 'string') {
      return response.data
    }

    if (response.data?.content) {
      return atob(response.data.content.replace(/\n/g, ''))
    }

    return ''
  } catch (e) {
    if (e.message.includes('rate limit')) {
      throw e
    }
    if (e.status === 403) {
      throw new Error(`GitHub API rate limit exceeded. Token eklemelisiniz. Lütfen GitHub Personal Access Token oluşturun: https://github.com/settings/tokens`)
    }
    throw new Error(`Failed to fetch file content: ${e.message}`)
  }
}
