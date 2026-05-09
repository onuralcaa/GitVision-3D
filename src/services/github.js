import { Octokit } from '@octokit/core'

const TOKEN = import.meta.env.VITE_GITHUB_TOKEN || ''

// Warn if no token is provided
if (!TOKEN) {
  console.warn('⚠️ No GitHub token found. API calls will be rate-limited. Please set VITE_GITHUB_TOKEN in .env')
}

const octokit = new Octokit({ auth: TOKEN || undefined })

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
    throw new Error(`Failed to fetch repo: ${e.message}`)
  }
  
  if (onProgress) onProgress(15)
  
  const branch = resp.repository.defaultBranchRef ? resp.repository.defaultBranchRef.name : 'main'

  // get branch commit to obtain tree sha
  let branchInfo
  try {
    branchInfo = await octokit.request('GET /repos/{owner}/{repo}/branches/{branch}', { owner, repo, branch })
  } catch(e) {
    throw new Error(`Failed to fetch branch info: ${e.message}`)
  }
  
  if (onProgress) onProgress(25)
  
  const treeSha = branchInfo.data.commit.commit.tree.sha

  // get recursive tree
  let tree
  try {
    tree = await octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}?recursive=1', { owner, repo, tree_sha: treeSha })
  } catch(e) {
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
      if(commits.data && commits.data[0]) lastCommitDate = commits.data[0].commit.committer?.date || commits.data[0].commit.author?.date
    }catch(e){ 
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
