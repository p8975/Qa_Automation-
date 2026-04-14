import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { reviewCode, councilReview } from "./claude.js";
import {
  getPRFiles,
  getPRDiff,
  getPRDetails,
  postReviewComment,
  submitPRReview,
  postComment,
  getLastReviewedCommit,
  getCommitRangeDiff,
  getCommitRangeFiles,
  getNonMergeCommits,
  updateReviewLabel,
  hasPendingChangesRequested,
  getAllPRFilesWithPatches,
  getPRDiffWithFallback,
  buildDiffFromPatches,
  setCurrentDiff,
  checkCIStatus,
} from "./github.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Environment variables
const PR_NUMBER = process.env.PR_NUMBER;
const PR_TITLE = process.env.PR_TITLE;
const PR_AUTHOR = process.env.PR_AUTHOR;
const PR_URL = process.env.PR_URL;
const PR_EVENT = process.env.PR_EVENT || "opened";
const PR_HEAD_SHA = process.env.PR_HEAD_SHA;
const REVIEW_MODE = process.env.REVIEW_MODE || "council";

// Config
const CONFIG = {
  groupSimilar: true,
  maxLineChangesPerFile: Infinity,
  maxIncrementalCommits: 20,
  maxIncrementalFiles: 50,
  maxIncrementalLines: 3000,
  largePRThreshold: {
    files: 100,
    lines: 10000,
  },
  batchSize: {
    files: 25,
    lines: 3000,
  },
};

// Safe error messages
const SAFE_ERROR_PATTERNS = [
  { pattern: /rate limit/i, message: "Rate limit exceeded. Please try again later." },
  { pattern: /timeout/i, message: "Request timed out. Please try again." },
  { pattern: /network/i, message: "Network error occurred." },
  { pattern: /too large/i, message: "PR is too large for automated review." },
  { pattern: /not found/i, message: "Required resource not found." },
  { pattern: /invalid.*json/i, message: "Failed to parse API response." },
  { pattern: /credit.*balance/i, message: "API credit limit reached." },
  { pattern: /quota.*exceeded/i, message: "API quota exceeded." },
  { pattern: /unauthorized|401/i, message: "Authentication failed." },
  { pattern: /forbidden|403/i, message: "Access denied." },
  { pattern: /bad request|400/i, message: "Invalid request." },
  { pattern: /internal.*error|500/i, message: "Internal server error." },
  { pattern: /service.*unavailable|503/i, message: "Service temporarily unavailable." },
];

function sanitizeErrorMessage(message) {
  if (!message) return "An unexpected error occurred.";

  for (const { pattern, message: safeMessage } of SAFE_ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return safeMessage;
    }
  }

  return "An unexpected error occurred. Check workflow logs for details.";
}

// File patterns to skip
const SKIP_PATTERNS = [
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /\.claude\/skills\//,
  /\.claude\/commands\//,
  /\.bmad-core\//,
  /_bmad\//,
  /^LICENSE$/,
  /CHANGELOG\.md$/,
];

function shouldSkipFile(filename) {
  return SKIP_PATTERNS.some((pattern) => pattern.test(filename));
}

function determineStatus(comments) {
  if (comments.some((c) => c.severity === "HIGH")) return "changes_requested";
  if (comments.some((c) => c.severity === "MEDIUM")) return "comments";
  return "approved";
}

function getReviewEvent(status) {
  switch (status) {
    case "approved":
      return "APPROVE";
    case "changes_requested":
      return "REQUEST_CHANGES";
    default:
      return "COMMENT";
  }
}

function groupSimilarComments(comments) {
  if (!CONFIG.groupSimilar) return comments;

  const groups = new Map();

  for (const comment of comments) {
    const messageKey = comment.message.substring(0, 50);
    const key = `${comment.severity}:${messageKey}`;

    if (!groups.has(key)) {
      groups.set(key, {
        ...comment,
        locations: [{ file: comment.file, line: comment.line }],
      });
    } else {
      groups.get(key).locations.push({ file: comment.file, line: comment.line });
    }
  }

  const grouped = [];
  for (const [, group] of groups) {
    if (group.locations.length > 1) {
      const locationList = group.locations
        .map((l) => `  - ${l.file}:${l.line}`)
        .join("\n");
      grouped.push({
        file: group.locations[0].file,
        line: group.locations[0].line,
        severity: group.severity,
        message: `${group.message}\n\n**Found in ${group.locations.length} locations:**\n${locationList}`,
      });
    } else {
      grouped.push({
        file: group.file,
        line: group.line,
        severity: group.severity,
        message: group.message,
      });
    }
  }

  return grouped;
}

async function main() {
  console.log(`\n PR Review Agent starting for PR #${PR_NUMBER}`);
  console.log(`   Title: ${PR_TITLE}`);
  console.log(`   Author: ${PR_AUTHOR}`);
  console.log(`   Event: ${PR_EVENT}`);
  console.log(`   Mode: ${REVIEW_MODE === "council" ? "Council (5 personas + chairman + judge)" : "Single reviewer"}\n`);

  try {
    let files;
    let diff;
    let isIncrementalReview = false;
    let lastReviewedCommit = null;

    // Check for incremental review
    if (PR_EVENT === "synchronize") {
      console.log("   Checking for previous reviews...");
      lastReviewedCommit = await getLastReviewedCommit();

      if (lastReviewedCommit && PR_HEAD_SHA) {
        console.log(`   Found previous review at commit: ${lastReviewedCommit.substring(0, 7)}`);
        console.log(`   Current head: ${PR_HEAD_SHA.substring(0, 7)}`);

        const { onlyMergeCommits, mergeCommits, nonMergeCommits } =
          await getNonMergeCommits(lastReviewedCommit, PR_HEAD_SHA);

        if (onlyMergeCommits) {
          console.log(`\n   Skipping review - only merge commit(s) detected since last review`);
          return;
        }

        const hasPendingChanges = await hasPendingChangesRequested();
        if (hasPendingChanges) {
          console.log(`   Previous review had CHANGES_REQUESTED - doing FULL review`);
        } else if (nonMergeCommits.length > CONFIG.maxIncrementalCommits) {
          console.log(`   Too many commits - falling back to FULL review`);
        } else {
          const incrementalFiles = await getCommitRangeFiles(
            lastReviewedCommit,
            PR_HEAD_SHA
          );
          const incrementalLines = incrementalFiles.reduce(
            (sum, f) => sum + f.additions + f.deletions,
            0
          );

          if (incrementalFiles.length > CONFIG.maxIncrementalFiles) {
            console.log(`   Too many files changed - falling back to FULL review`);
          } else if (incrementalLines > CONFIG.maxIncrementalLines) {
            console.log(`   Too many lines changed - falling back to FULL review`);
          } else {
            console.log(`   Performing incremental review (${nonMergeCommits.length} new commits)`);
            isIncrementalReview = true;
            files = incrementalFiles;
            diff = await getCommitRangeDiff(lastReviewedCommit, PR_HEAD_SHA);
          }
        }
      }
    }

    // Full PR review
    if (!isIncrementalReview) {
      console.log("   Fetching full PR diff...");
      files = await getAllPRFilesWithPatches();

      const totalLines = files.reduce((sum, f) => sum + (f.additions || 0) + (f.deletions || 0), 0);

      const isLargePR =
        files.length > CONFIG.largePRThreshold.files ||
        totalLines > CONFIG.largePRThreshold.lines;

      if (isLargePR) {
        console.log(`   Large PR detected (${files.length} files, ${totalLines} lines)`);
        console.log(`   Using batched review with file patches...`);
        diff = buildDiffFromPatches(files);
      } else {
        const result = await getPRDiffWithFallback(files);
        diff = result.diff;
        if (result.method === "file_patches") {
          console.log(`   Used file patches fallback`);
        }
      }
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      console.log("\n   No files to review - skipping");
      return;
    }

    const codeFiles = files.filter((f) => !shouldSkipFile(f.filename));
    const totalChanges = codeFiles.reduce(
      (sum, f) => sum + (f.additions || 0) + (f.deletions || 0),
      0
    );

    console.log(
      `   Found ${codeFiles.length} code files, ${totalChanges} lines changed${isIncrementalReview ? " (since last review)" : ""}`
    );

    const largeFiles = codeFiles.filter(
      (f) => f.additions + f.deletions > CONFIG.maxLineChangesPerFile
    );
    if (largeFiles.length > 0) {
      console.log(`\n   ${largeFiles.length} file(s) exceed ${CONFIG.maxLineChangesPerFile} lines - skipping`);
      const fileList = largeFiles.map((f) => `- ${f.filename}`).join("\n");
      await postComment(
        `**Auto-review skipped**\n\nThe following files exceed the ${CONFIG.maxLineChangesPerFile} line change limit:\n${fileList}\n\nPlease request a manual review.`
      );
      return;
    }

    if (codeFiles.length === 0) {
      console.log("\n   No code files to review - skipping");
      return;
    }

    // Load review standards
    console.log("   Loading review standards...");
    const standardsPath = join(__dirname, "..", "REVIEW_STANDARDS.md");
    let reviewStandards = "";
    if (existsSync(standardsPath)) {
      reviewStandards = readFileSync(standardsPath, "utf-8");
    } else {
      console.log("   REVIEW_STANDARDS.md not found, using defaults");
      reviewStandards = "Use standard code review practices.";
    }

    // Load codebase context
    console.log("   Loading codebase context...");
    const contextPath = join(__dirname, "CODEBASE_CONTEXT.md");
    let codebaseContext = "";
    if (existsSync(contextPath)) {
      codebaseContext = readFileSync(contextPath, "utf-8");
    }

    // Load false positives
    console.log("   Loading knowledge base...");
    let falsePositives = [];
    const fpPath = join(__dirname, "knowledge", "false-positives.json");
    if (existsSync(fpPath)) {
      try {
        const fpData = JSON.parse(readFileSync(fpPath, "utf-8"));
        falsePositives = fpData.patterns || [];
        console.log(`   Loaded ${falsePositives.length} false positive patterns`);
      } catch {
        console.log("   Error parsing false-positives.json, skipping");
      }
    }

    // Review
    const filesChanged = codeFiles.map((f) => f.filename);
    let comments;

    if (REVIEW_MODE === "council") {
      console.log("   Sending to Code Review Council (5 personas + chairman + judge)...");
      comments = await councilReview(
        reviewStandards,
        filesChanged,
        diff,
        codebaseContext,
        falsePositives
      );
    } else {
      console.log("   Sending to Claude for review (single mode)...");
      comments = await reviewCode(
        reviewStandards,
        filesChanged,
        diff,
        codebaseContext,
        falsePositives
      );
    }

    console.log(`   Review found ${comments.length} issues`);

    // Group similar comments
    if (comments.length > 0 && REVIEW_MODE !== "council") {
      comments = groupSimilarComments(comments);
      console.log(`   After grouping: ${comments.length} comments`);
    }

    // Determine status and review event
    let status = determineStatus(comments);
    const reviewEvent = getReviewEvent(status);
    console.log(`\n   Review status: ${status} (${reviewEvent})`);

    // Post review
    setCurrentDiff(diff);

    if (comments.length > 0) {
      console.log("   Posting review comments...");
      try {
        await postReviewComment(comments, reviewEvent);
      } catch (error) {
        console.log("   Inline comments failed, posting summary...");
        const summary = comments
          .map(
            (c) => `**${c.severity}** - \`${c.file}:${c.line}\`\n${c.message}`
          )
          .join("\n\n---\n\n");
        await postComment(`## Automated Review\n\n${summary}`);
        try {
          await submitPRReview(reviewEvent);
        } catch {
          console.log("   Failed to submit standalone review event");
        }
      }
    } else {
      console.log("   No issues found by code review.");

      // Check CI status before approving
      console.log("\n   Checking CI status before approval...");
      const ciStatus = await checkCIStatus();

      if (ciStatus.passed) {
        console.log("   CI checks passed - approving PR...");
        try {
          const approvalMsg =
            REVIEW_MODE === "council"
              ? "LGTM! No issues found by the Code Review Council (5 specialized reviewers). CI checks passed."
              : "LGTM! No issues found by automated review. CI checks passed.";
          await submitPRReview("APPROVE", approvalMsg);
        } catch (error) {
          console.log("   Failed to submit approval:", error.message);
        }
      } else if (ciStatus.pending) {
        console.log("   CI checks still pending - skipping approval for now");
        await postComment(
          `**Bot Review Complete** - No issues found.\n\n` +
          `Waiting for CI checks to complete before approval.\n\n` +
          `CI Status: ${ciStatus.details.join(', ')}`
        );
        // Don't approve, don't fail - just comment
        // The merge-gate will re-run when CI completes
      } else {
        console.log("   CI checks failed - cannot approve");
        await postComment(
          `**Bot Review Complete** - No code issues found.\n\n` +
          `However, CI checks have failed. Please fix the CI issues before this PR can be approved.\n\n` +
          `CI Status:\n${ciStatus.details.map(d => `- ${d}`).join('\n')}`
        );
        // Update label to show bot found no issues but CI failed
        status = "comments"; // Override to prevent "approved" label
      }
    }

    // Update PR labels
    try {
      await updateReviewLabel(status);
    } catch (error) {
      console.log("   Failed to update labels:", error.message);
    }

    console.log("\n   Review complete!");
  } catch (error) {
    const safeErrorMessage = sanitizeErrorMessage(error.message);
    console.error("\n   Review failed:", error.message);

    try {
      await postComment(
        `**Auto-review failed**\n\nReason: ${safeErrorMessage}\n\nPlease request a manual review.`
      );
    } catch (commentError) {
      console.error("   Failed to post error comment:", commentError.message);
    }

    process.exit(1);
  }
}

main();
