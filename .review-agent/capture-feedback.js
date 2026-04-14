// Capture review feedback when PR is merged for self-learning
// This helps identify false positives and improve future reviews

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;

const headers = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  Accept: "application/vnd.github.v3+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

async function getPRReviewComments(prNumber) {
  const response = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${prNumber}/comments`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`Failed to get PR comments: ${response.statusText}`);
  }

  return response.json();
}

async function getPRReviewThreads(prNumber) {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `
        query($owner: String!, $repo: String!, $pr: Int!) {
          repository(owner: $owner, name: $repo) {
            pullRequest(number: $pr) {
              reviewThreads(first: 100) {
                nodes {
                  isResolved
                  isOutdated
                  comments(first: 10) {
                    nodes {
                      author { login }
                      body
                      path
                      line
                    }
                  }
                }
              }
            }
          }
        }
      `,
      variables: { owner: REPO_OWNER, repo: REPO_NAME, pr: prNumber },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GraphQL error: ${error}`);
  }

  const data = await response.json();
  return data.data?.repository?.pullRequest?.reviewThreads?.nodes || [];
}

function loadFalsePositives() {
  const fpPath = join(__dirname, "knowledge", "false-positives.json");
  if (existsSync(fpPath)) {
    try {
      return JSON.parse(readFileSync(fpPath, "utf-8"));
    } catch {
      return { patterns: [], updated: new Date().toISOString() };
    }
  }
  return { patterns: [], updated: new Date().toISOString() };
}

function saveFalsePositives(data) {
  const knowledgeDir = join(__dirname, "knowledge");
  if (!existsSync(knowledgeDir)) {
    mkdirSync(knowledgeDir, { recursive: true });
  }
  const fpPath = join(knowledgeDir, "false-positives.json");
  writeFileSync(fpPath, JSON.stringify(data, null, 2));
}

async function main() {
  const prNumber = parseInt(process.argv[2], 10);

  if (!prNumber) {
    console.error("Usage: node capture-feedback.js <PR_NUMBER>");
    process.exit(1);
  }

  console.log(`\n   Capturing feedback for PR #${prNumber}...\n`);

  try {
    const threads = await getPRReviewThreads(prNumber);
    console.log(`   Found ${threads.length} review threads`);

    // Find bot comments that were resolved/dismissed
    const dismissedBotComments = threads.filter((thread) => {
      const firstComment = thread.comments?.nodes?.[0];
      if (!firstComment) return false;

      // Check if it's a bot comment
      const isBot =
        firstComment.author?.login === "github-actions[bot]" ||
        firstComment.author?.login.includes("bot");

      // Check if it was resolved (likely a false positive that human dismissed)
      return isBot && thread.isResolved;
    });

    console.log(`   Found ${dismissedBotComments.length} dismissed bot comments`);

    if (dismissedBotComments.length === 0) {
      console.log("   No feedback to capture");
      return;
    }

    // Extract patterns from dismissed comments
    const fpData = loadFalsePositives();
    let newPatterns = 0;

    for (const thread of dismissedBotComments) {
      const comment = thread.comments.nodes[0];
      const body = comment.body;

      // Extract the rule/issue type from the comment
      const severityMatch = body.match(/\*\*(HIGH|MEDIUM|LOW)\*\*/);
      const severity = severityMatch ? severityMatch[1] : "UNKNOWN";

      // Create a simple pattern identifier
      const patternId = `${comment.path}:${severity}:${body.substring(0, 100)}`;

      // Check if we already have this pattern
      const existingPattern = fpData.patterns.find(
        (p) => p.id === patternId || p.example === body.substring(0, 200)
      );

      if (!existingPattern) {
        fpData.patterns.push({
          id: patternId,
          rule: `Dismissed ${severity} comment on ${comment.path}`,
          example: body.substring(0, 200),
          path: comment.path,
          line: comment.line,
          addedAt: new Date().toISOString(),
          prNumber,
        });
        newPatterns++;
      }
    }

    if (newPatterns > 0) {
      fpData.updated = new Date().toISOString();
      saveFalsePositives(fpData);
      console.log(`   Added ${newPatterns} new false positive pattern(s)`);
      console.log(`   Total patterns in knowledge base: ${fpData.patterns.length}`);
    } else {
      console.log("   No new patterns to add");
    }

    console.log("\n   Feedback capture complete!");
  } catch (error) {
    console.error("   Error capturing feedback:", error.message);
    process.exit(1);
  }
}

main();
