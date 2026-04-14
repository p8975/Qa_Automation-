// GitHub API client for PR review operations

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;
const PR_NUMBER = process.env.PR_NUMBER;

const headers = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  Accept: "application/vnd.github.v3+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

export async function getPRDetails() {
  const response = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${PR_NUMBER}`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`Failed to get PR details: ${response.statusText}`);
  }

  return response.json();
}

export async function getPRFiles() {
  const response = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${PR_NUMBER}/files`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`Failed to get PR files: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get ALL PR files with pagination (GitHub returns max 100 per page)
 * Each file includes a .patch field with its diff
 */
export async function getAllPRFilesWithPatches() {
  const allFiles = [];
  let page = 1;
  const perPage = 100;

  console.log("   Fetching all PR files (paginated)...");

  while (true) {
    const response = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${PR_NUMBER}/files?per_page=${perPage}&page=${page}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to get PR files (page ${page}): ${response.statusText}`);
    }

    const files = await response.json();
    allFiles.push(...files);

    console.log(`   Page ${page}: fetched ${files.length} files (total: ${allFiles.length})`);

    if (files.length < perPage) {
      break;
    }

    page++;

    if (page > 50) {
      console.log("   Hit pagination safety limit (5000 files)");
      break;
    }
  }

  return allFiles;
}

/**
 * Build diff from file patches for large PRs
 */
export function buildDiffFromPatches(files) {
  return files
    .filter((f) => f.patch)
    .map((f) => {
      const header = `diff --git a/${f.filename} b/${f.filename}`;
      const meta = f.status === "added"
        ? `new file mode 100644\nindex 0000000..${(f.sha || "0000000").slice(0, 7)}`
        : f.status === "removed"
        ? `deleted file mode 100644\nindex ${(f.sha || "0000000").slice(0, 7)}..0000000`
        : `index ${(f.sha || "0000000").slice(0, 7)}..${(f.sha || "0000000").slice(0, 7)}`;
      return `${header}\n${meta}\n--- a/${f.filename}\n+++ b/${f.filename}\n${f.patch}`;
    })
    .join("\n\n");
}

export async function getPRDiff() {
  const response = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${PR_NUMBER}`,
    {
      headers: {
        ...headers,
        Accept: "application/vnd.github.v3.diff",
      },
    }
  );

  if (!response.ok) {
    if (response.status === 406) {
      console.log("   Diff too large for GitHub API (406), will use file patches");
      return null;
    }
    throw new Error(`Failed to get PR diff: ${response.statusText}`);
  }

  return response.text();
}

/**
 * Get PR diff with automatic fallback to file patches for large PRs
 */
export async function getPRDiffWithFallback(files = null) {
  const diff = await getPRDiff();

  if (diff !== null) {
    return { diff, method: "full_diff" };
  }

  console.log("   Using fallback: building diff from file patches...");

  const allFiles = files || await getAllPRFilesWithPatches();
  const patchDiff = buildDiffFromPatches(allFiles);

  return { diff: patchDiff, method: "file_patches", files: allFiles };
}

/**
 * Parse diff to extract valid line numbers per file
 */
function parseDiffLines(diff) {
  const validLines = new Map();
  if (!diff) return validLines;

  const fileDiffs = diff.split(/(?=^diff --git)/m);

  for (const fileDiff of fileDiffs) {
    const fileMatch = fileDiff.match(/diff --git a\/(.+?) b\//);
    if (!fileMatch) continue;

    const filename = fileMatch[1];
    const lines = new Set();

    const hunkRegex = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm;
    let hunkMatch;

    while ((hunkMatch = hunkRegex.exec(fileDiff)) !== null) {
      const startLine = parseInt(hunkMatch[1], 10);
      const hunkStart = hunkMatch.index + hunkMatch[0].length;
      const nextHunk = fileDiff.indexOf("\n@@", hunkStart);
      const nextFile = fileDiff.indexOf("\ndiff --git", hunkStart);
      const hunkEnd = Math.min(
        nextHunk === -1 ? Infinity : nextHunk,
        nextFile === -1 ? Infinity : nextFile,
        fileDiff.length
      );
      const hunkContent = fileDiff.substring(hunkStart, hunkEnd);
      const hunkLines = hunkContent.split("\n");

      let currentLine = startLine;
      for (const line of hunkLines) {
        if (line.startsWith("-")) {
          continue;
        } else if (line.startsWith("+") || line.startsWith(" ")) {
          lines.add(currentLine);
          currentLine++;
        }
      }
    }

    if (lines.size > 0) {
      validLines.set(filename, lines);
    }
  }

  return validLines;
}

/**
 * Find the nearest valid diff line for a comment
 */
function findNearestDiffLine(targetLine, validLines) {
  if (!validLines || validLines.size === 0) return null;
  if (validLines.has(targetLine)) return targetLine;

  let nearest = null;
  let minDist = Infinity;
  const MAX_DISTANCE = 10;

  for (const line of validLines) {
    const dist = Math.abs(line - targetLine);
    if (dist < minDist && dist <= MAX_DISTANCE) {
      minDist = dist;
      nearest = line;
    }
  }

  return nearest;
}

let _currentDiff = null;

export function setCurrentDiff(diff) {
  _currentDiff = diff;
}

export async function postReviewComment(comments, reviewEvent = "COMMENT") {
  const validLines = parseDiffLines(_currentDiff);
  const inlineComments = [];
  const orphanComments = [];

  for (const c of comments) {
    const fileLines = validLines.get(c.file);
    const validLine = findNearestDiffLine(c.line, fileLines);

    if (validLine !== null) {
      inlineComments.push({
        path: c.file,
        line: validLine,
        body: `${getSeverityEmoji(c.severity)} **${c.severity}**: ${c.message}`,
      });
    } else {
      orphanComments.push(c);
    }
  }

  console.log(
    `   ${inlineComments.length} inline comments, ${orphanComments.length} orphan (no matching diff line)`
  );

  let reviewBody = "";
  if (orphanComments.length > 0) {
    reviewBody = orphanComments
      .map(
        (c) =>
          `${getSeverityEmoji(c.severity)} **${c.severity}** - \`${c.file}:${c.line}\`\n${c.message}`
      )
      .join("\n\n---\n\n");
  }

  const response = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${PR_NUMBER}/reviews`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event: reviewEvent,
        body: reviewBody || undefined,
        comments: inlineComments,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to post review: ${error}`);
  }

  return response.json();
}

export async function submitPRReview(reviewEvent, body = "") {
  const response = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${PR_NUMBER}/reviews`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event: reviewEvent,
        body,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to submit review: ${error}`);
  }

  return response.json();
}

export async function postComment(body) {
  const response = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues/${PR_NUMBER}/comments`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to post comment: ${response.statusText}`);
  }

  return response.json();
}

function getSeverityEmoji(severity) {
  switch (severity) {
    case "HIGH":
      return "\u{1F534}"; // Red circle
    case "MEDIUM":
      return "\u{1F7E1}"; // Yellow circle
    case "LOW":
      return "\u{1F7E2}"; // Green circle
    default:
      return "\u{2753}"; // Question mark
  }
}

export async function getLastReviewedCommit() {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${PR_NUMBER}/reviews`,
      { headers }
    );

    if (!response.ok) {
      return null;
    }

    const reviews = await response.json();

    const botReviews = reviews
      .filter((r) => r.user?.login === "github-actions[bot]")
      .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

    if (botReviews.length > 0 && botReviews[0].commit_id) {
      return botReviews[0].commit_id;
    }

    return null;
  } catch {
    return null;
  }
}

export async function hasPendingChangesRequested() {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${PR_NUMBER}/reviews`,
      { headers }
    );

    if (!response.ok) {
      return false;
    }

    const reviews = await response.json();

    const botReviews = reviews
      .filter((r) => r.user?.login === "github-actions[bot]")
      .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

    if (botReviews.length === 0) {
      return false;
    }

    for (const review of botReviews) {
      if (review.state === "APPROVED") {
        return false;
      }
      if (review.state === "CHANGES_REQUESTED") {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

const MERGE_COMMIT_PATTERNS = [
  /^Merge branch /i,
  /^Merge pull request /i,
  /^Merge remote-tracking branch /i,
  /^chore:\s*merge/i,
  /^chore\(merge\)/i,
];

function isMergeCommit(commit) {
  const message = commit.commit?.message || "";
  const parentCount = commit.parents?.length || 0;

  if (parentCount >= 2) return true;

  return MERGE_COMMIT_PATTERNS.some((pattern) => pattern.test(message));
}

export async function getNonMergeCommits(baseCommit, headCommit) {
  const response = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/compare/${baseCommit}...${headCommit}`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`Failed to get commit range: ${response.statusText}`);
  }

  const data = await response.json();
  const allCommits = data.commits || [];
  const mergeCommits = allCommits.filter(isMergeCommit);
  const nonMergeCommits = allCommits.filter((c) => !isMergeCommit(c));

  if (mergeCommits.length > 0) {
    console.log(
      `   Skipping ${mergeCommits.length} merge commit(s): ${mergeCommits.map((c) => c.sha.substring(0, 7)).join(", ")}`
    );
  }

  return {
    nonMergeCommits,
    mergeCommits,
    allCommits,
    onlyMergeCommits: nonMergeCommits.length === 0 && allCommits.length > 0,
  };
}

export async function getCommitRangeDiff(baseCommit, headCommit) {
  const response = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/compare/${baseCommit}...${headCommit}`,
    {
      headers: {
        ...headers,
        Accept: "application/vnd.github.v3.diff",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get commit range diff: ${response.statusText}`);
  }

  return response.text();
}

export async function getCommitRangeFiles(baseCommit, headCommit) {
  const response = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/compare/${baseCommit}...${headCommit}`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`Failed to get commit range files: ${response.statusText}`);
  }

  const data = await response.json();
  return data.files || [];
}

// Label management
const BOT_LABEL_CONFIG = {
  approved: {
    name: "bot: approved",
    color: "0E8A16",
    description: "PR approved by review bot",
  },
  comments: {
    name: "bot: comments",
    color: "FBCA04",
    description: "Review bot left comments to address",
  },
  changes_requested: {
    name: "bot: changes requested",
    color: "D93F0B",
    description: "Review bot requested changes",
  },
};

const ALL_BOT_LABELS = Object.values(BOT_LABEL_CONFIG).map((l) => l.name);

async function ensureLabelExists(labelConfig) {
  const response = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/labels/${encodeURIComponent(labelConfig.name)}`,
    { headers }
  );

  if (response.status === 404) {
    const createResponse = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/labels`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: labelConfig.name,
          color: labelConfig.color,
          description: labelConfig.description,
        }),
      }
    );

    if (!createResponse.ok) {
      console.error(
        `   Failed to create label "${labelConfig.name}": ${createResponse.statusText}`
      );
    } else {
      console.log(`   Created label: ${labelConfig.name}`);
    }
  }
}

async function removeAllBotLabels() {
  for (const labelName of ALL_BOT_LABELS) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues/${PR_NUMBER}/labels/${encodeURIComponent(labelName)}`,
        {
          method: "DELETE",
          headers,
        }
      );
      if (response.ok) {
        console.log(`   Removed label: ${labelName}`);
      }
    } catch {
      // Ignore errors when removing labels
    }
  }
}

async function addLabel(labelName) {
  const response = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues/${PR_NUMBER}/labels`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ labels: [labelName] }),
    }
  );

  if (!response.ok) {
    console.error(
      `   Failed to add label "${labelName}": ${response.statusText}`
    );
  } else {
    console.log(`   Added label: ${labelName}`);
  }
}

export async function updateReviewLabel(status) {
  const labelConfig = BOT_LABEL_CONFIG[status];
  if (!labelConfig) {
    console.log(`   Unknown status "${status}", skipping label update`);
    return;
  }

  console.log("   Updating PR labels...");

  await ensureLabelExists(labelConfig);
  await removeAllBotLabels();
  await addLabel(labelConfig.name);
}
