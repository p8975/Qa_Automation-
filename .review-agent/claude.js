// AI Router API client for code review
// Supports both single-reviewer mode and council mode (5 personas + chairman + judge)

import {
  PERSONAS,
  buildPersonaSystemPrompt,
  buildChairmanPrompt,
  buildJudgePrompt,
} from "./personas.js";

// Configurable settings
const CONFIG = {
  maxTokens: parseInt(process.env.REVIEW_MAX_TOKENS, 10) || 30000,
  maxInputTokens: parseInt(process.env.REVIEW_MAX_INPUT_TOKENS, 10) || 28000,
  charsPerToken: 4,
  baseUrl: process.env.AIROUTER_BASE_URL || "http://neorouter.stage.in/v1/chat/completions",
  model: process.env.REVIEW_MODEL || "auto",
  maxRetries: 2,
  retryBatchDivisor: 2,
};

function estimateTokens(text) {
  return Math.ceil(text.length / CONFIG.charsPerToken);
}

// Files to skip entirely
const SKIP_FILE_PATTERNS = [
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /\.lock$/,
  /\.snap$/,
  /__snapshots__\//,
  /\.generated\./,
  /\.min\.(js|css)$/,
  /\/dist\//,
  /\/build\//,
  /\/coverage\//,
  /\.d\.ts$/,
  /\.map$/,
];

function filterDiff(diff) {
  const fileDiffs = diff.split(/(?=^diff --git)/m);

  return fileDiffs
    .filter((fileDiff) => {
      const match = fileDiff.match(/diff --git a\/(.+?) b\//);
      if (!match) return true;

      const filename = match[1];
      return !SKIP_FILE_PATTERNS.some((pattern) => pattern.test(filename));
    })
    .join("");
}

function splitDiffIntoBatches(diff, maxTokensPerBatch) {
  const fileDiffs = diff.split(/(?=^diff --git)/m).filter((d) => d.trim());
  const batches = [];
  let currentBatchParts = [];
  let currentBatchTokens = 0;
  let currentBatchFiles = [];

  for (const fileDiff of fileDiffs) {
    const fileTokens = estimateTokens(fileDiff);

    if (fileTokens > maxTokensPerBatch) {
      if (currentBatchParts.length > 0) {
        batches.push({ diff: currentBatchParts.join(""), files: currentBatchFiles });
        currentBatchParts = [];
        currentBatchTokens = 0;
        currentBatchFiles = [];
      }
      const match = fileDiff.match(/diff --git a\/(.+?) b\//);
      const filename = match ? match[1] : "unknown";
      batches.push({ diff: fileDiff, files: [filename] });
      continue;
    }

    if (
      currentBatchTokens + fileTokens > maxTokensPerBatch &&
      currentBatchParts.length > 0
    ) {
      batches.push({ diff: currentBatchParts.join(""), files: currentBatchFiles });
      currentBatchParts = [];
      currentBatchTokens = 0;
      currentBatchFiles = [];
    }

    currentBatchParts.push(fileDiff);
    currentBatchTokens += fileTokens;
    const match = fileDiff.match(/diff --git a\/(.+?) b\//);
    if (match) {
      currentBatchFiles.push(match[1]);
    }
  }

  if (currentBatchParts.length > 0) {
    batches.push({ diff: currentBatchParts.join(""), files: currentBatchFiles });
  }

  return batches;
}

function prepareDiff(diff, reviewStandards, codebaseContext = "") {
  let processed = filterDiff(diff);
  const originalTokens = estimateTokens(diff);
  const filteredTokens = estimateTokens(processed);

  if (filteredTokens < originalTokens) {
    console.log(
      `   Filtered diff: ~${originalTokens} -> ~${filteredTokens} tokens`
    );
  }

  const systemPromptTokens =
    estimateTokens(reviewStandards) + estimateTokens(codebaseContext) + 2000;
  const availableTokens = CONFIG.maxInputTokens - systemPromptTokens;

  console.log(
    `   Token budget: ~${systemPromptTokens} system, ~${availableTokens} available for diff`
  );

  if (filteredTokens <= availableTokens) {
    return { batches: [{ diff: processed, files: [] }], totalBatches: 1 };
  }

  const batches = splitDiffIntoBatches(processed, availableTokens);
  console.log(
    `   Diff too large, split into ${batches.length} batch(es) for complete review`
  );

  return { batches, totalBatches: batches.length };
}

class ContextWindowExceededError extends Error {
  constructor(model, rawResponse) {
    super(`Model context window exceeded (${model})`);
    this.name = "ContextWindowExceededError";
    this.model = model;
    this.rawResponse = rawResponse;
  }
}

async function callAIRouter(systemPrompt, userPrompt, retryAttempt = 0) {
  const apiKey = process.env.AIROUTER_API_KEY;
  const MAX_RATE_LIMIT_RETRIES = 3;

  if (!apiKey) {
    throw new Error(
      "No API key found. Set AIROUTER_API_KEY environment variable."
    );
  }

  const response = await fetch(CONFIG.baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CONFIG.model,
      max_tokens: CONFIG.maxTokens,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    if (response.status === 429 && retryAttempt < MAX_RATE_LIMIT_RETRIES) {
      const retryAfter = response.headers.get("retry-after");
      const waitMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : Math.min(1000 * Math.pow(2, retryAttempt) + Math.random() * 1000, 30000);
      console.log(
        `   Rate limited (429), retrying in ${(waitMs / 1000).toFixed(1)}s...`
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return callAIRouter(systemPrompt, userPrompt, retryAttempt + 1);
    }

    const errorText = await response.text();
    throw new Error(`AI API error: ${response.status} - ${errorText}`);
  }

  const responseText = await response.text();

  // Check if response is SSE format (streaming)
  if (responseText.includes("data: ")) {
    const lines = responseText.split("\n");
    let fullContent = "";
    let usage = null;
    let modelUsed = null;

    for (const line of lines) {
      if (line.startsWith(":") || !line.trim()) continue;

      if (line.startsWith("data: ")) {
        const dataStr = line.slice(6);
        if (dataStr === "[DONE]") continue;

        try {
          const chunk = JSON.parse(dataStr);
          if (chunk.model) modelUsed = chunk.model;
          if (chunk.choices?.[0]?.delta?.content) {
            fullContent += chunk.choices[0].delta.content;
          }
          if (chunk.usage) usage = chunk.usage;
        } catch {
          // Skip malformed chunks
        }
      }
    }

    if (fullContent) {
      return {
        choices: [{ message: { content: fullContent } }],
        usage,
        model: modelUsed,
      };
    }
  }

  // Try parsing as JSON (non-streaming OpenAI format)
  try {
    const data = JSON.parse(responseText);

    // OpenAI format
    if (data.choices?.[0]?.message?.content) {
      return {
        choices: [{ message: { content: data.choices[0].message.content } }],
        usage: data.usage,
        model: data.model,
      };
    }

    // Anthropic API format
    if (data.content && Array.isArray(data.content)) {
      const textContent = data.content.find((c) => c.type === "text");
      if (textContent) {
        return {
          choices: [{ message: { content: textContent.text } }],
          usage: data.usage,
          model: data.model,
        };
      }
    }
  } catch {
    // Not valid JSON
  }

  throw new Error(`Empty response from AI API. Raw: ${responseText.substring(0, 200)}`);
}

function salvageTruncatedJson(jsonStr) {
  const salvaged = [];
  let depth = 0;
  let objectStart = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === "\\") {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") {
      if (depth === 0) {
        objectStart = i;
      }
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0 && objectStart !== -1) {
        const objectStr = jsonStr.substring(objectStart, i + 1);
        try {
          const obj = JSON.parse(objectStr);
          if (obj.file && obj.line && obj.severity && obj.message) {
            salvaged.push(obj);
          }
        } catch {
          // Skip malformed object
        }
        objectStart = -1;
      }
    }
  }

  return salvaged;
}

function parseReviewResponse(content, batchNum, totalBatches) {
  const comments = [];

  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const batchComments = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(batchComments)) {
        throw new Error(`Parsed JSON is not an array: ${typeof batchComments}`);
      }

      comments.push(...batchComments);
      if (totalBatches > 1) {
        console.log(
          `   Found ${batchComments.length} issues in batch ${batchNum}`
        );
      }
    } catch (parseError) {
      console.log(
        `   JSON parse error, attempting to salvage: ${parseError.message}`
      );

      const salvaged = salvageTruncatedJson(jsonMatch[0]);
      if (salvaged.length > 0) {
        console.log(
          `   Salvaged ${salvaged.length} complete comment(s) from truncated response`
        );
        comments.push(...salvaged);
      }
    }
  } else {
    const trimmedContent = content.trim();
    if (trimmedContent.startsWith("[")) {
      console.log(
        `   Response starts with '[' but no closing ']' found - attempting to salvage`
      );
      const salvaged = salvageTruncatedJson(trimmedContent);
      if (salvaged.length > 0) {
        console.log(
          `   Salvaged ${salvaged.length} complete comment(s) from truncated response`
        );
        comments.push(...salvaged);
      }
    }
  }

  return comments;
}

async function reviewBatchWithRetry(
  batch,
  filesChanged,
  systemPrompt,
  batchNum,
  totalBatches,
  retryCount = 0
) {
  const batchFiles = batch.files.length > 0 ? batch.files : filesChanged;
  const userPrompt = `Review this PR.

FILES CHANGED:
${batchFiles.join("\n")}

DIFF:
${batch.diff}

Return ONLY the JSON array, no other text.`;

  try {
    const response = await callAIRouter(systemPrompt, userPrompt);

    if (response.usage) {
      console.log(
        `   Tokens: ${response.usage.input_tokens} prompt, ${response.usage.output_tokens} completion`
      );
    }

    const content = response.choices[0].message.content;
    console.log(`   AI response length: ${content.length} chars`);

    return parseReviewResponse(content, batchNum, totalBatches);
  } catch (error) {
    if (
      error instanceof ContextWindowExceededError &&
      retryCount < CONFIG.maxRetries
    ) {
      console.log(
        `   Context window exceeded, splitting batch and retrying...`
      );

      const currentTokens = estimateTokens(batch.diff);
      const smallerSize = Math.floor(currentTokens / CONFIG.retryBatchDivisor);
      const subBatches = splitDiffIntoBatches(batch.diff, smallerSize);

      console.log(
        `   Split into ${subBatches.length} smaller sub-batches`
      );

      const allSubComments = [];
      for (let j = 0; j < subBatches.length; j++) {
        console.log(
          `   Reviewing sub-batch ${j + 1}/${subBatches.length} of batch ${batchNum}...`
        );
        const subComments = await reviewBatchWithRetry(
          subBatches[j],
          filesChanged,
          systemPrompt,
          batchNum,
          totalBatches,
          retryCount + 1
        );
        allSubComments.push(...subComments);
      }
      return allSubComments;
    }

    console.error(`AI API error in batch ${batchNum}:`, error.message);
    throw error;
  }
}

export async function reviewCode(
  reviewStandards,
  filesChanged,
  diff,
  codebaseContext,
  falsePositives = []
) {
  const { batches, totalBatches } = prepareDiff(
    diff,
    reviewStandards,
    codebaseContext
  );

  let systemPrompt = `You are a senior code reviewer. Follow these review standards strictly:\n\n${reviewStandards}`;

  if (codebaseContext) {
    systemPrompt += `\n\nCODEBASE CONTEXT:\n${codebaseContext}`;
  }

  if (falsePositives && falsePositives.length > 0) {
    systemPrompt += `\n\nLEARNED FALSE POSITIVES (DO NOT flag these):\n`;
    falsePositives.forEach((fp) => {
      systemPrompt += `- ${fp.rule}\n  Example: ${fp.example}\n`;
    });
  }

  systemPrompt += `\n\nIMPORTANT RULES:
1. Only comment if you are >80% confident about the issue
2. Skip lines with "// @review-ignore" comments
3. Group similar issues together
4. Focus on bugs, performance, and code quality - not style preferences
5. NEVER post appreciation, praise, or positive comments
6. Every comment MUST describe a concrete problem or risk
7. For TEST FILES and CONFIG FILES: Be lenient, only flag actual bugs

Return your review as a JSON array:
[
  {
    "file": "path/to/file.js",
    "line": 42,
    "severity": "HIGH|MEDIUM|LOW",
    "message": "Clear explanation of the issue and suggested fix"
  }
]

If the code looks good with no issues, return an empty array: []

Severity Guide:
- HIGH: Bugs, security issues, breaking changes, missing error handling
- MEDIUM: Performance issues, code quality concerns, potential bugs
- LOW: Minor improvements, nice-to-haves`;

  const allComments = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    if (totalBatches > 1) {
      console.log(`   Reviewing batch ${i + 1}/${totalBatches}...`);
    }

    const batchComments = await reviewBatchWithRetry(
      batch,
      filesChanged,
      systemPrompt,
      i + 1,
      totalBatches
    );
    allComments.push(...batchComments);
  }

  return allComments;
}

// Council review functions

async function reviewBatchWithPersona(
  batch,
  filesChanged,
  persona,
  reviewStandards,
  codebaseContext,
  falsePositives,
  batchNum,
  totalBatches
) {
  const systemPrompt = buildPersonaSystemPrompt(persona, reviewStandards, codebaseContext, falsePositives);
  return reviewBatchWithRetry(
    batch,
    filesChanged,
    systemPrompt,
    batchNum,
    totalBatches
  );
}

async function runPersonaReview(
  persona,
  batches,
  filesChanged,
  reviewStandards,
  codebaseContext,
  falsePositives
) {
  const allFindings = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    if (batches.length > 1) {
      console.log(`   ${persona.label} reviewing batch ${i + 1}/${batches.length}...`);
    }

    const batchFindings = await reviewBatchWithPersona(
      batch,
      filesChanged,
      persona,
      reviewStandards,
      codebaseContext,
      falsePositives,
      i + 1,
      batches.length
    );

    for (const finding of batchFindings) {
      if (!finding.persona) {
        finding.persona = persona.name;
      }
    }

    allFindings.push(...batchFindings);
  }

  return allFindings;
}

async function chairmanSynthesize(personaFindings) {
  console.log("\n   Chairman synthesizing findings...");

  const totalFindings = personaFindings.reduce((sum, pf) => sum + pf.findings.length, 0);
  console.log(`   Total findings from all personas: ${totalFindings}`);

  if (totalFindings === 0) {
    console.log("   No findings to synthesize - skipping chairman");
    return [];
  }

  const { systemPrompt, userPrompt } = buildChairmanPrompt(personaFindings);

  try {
    const response = await callAIRouter(systemPrompt, userPrompt);

    if (response.usage) {
      console.log(
        `   Chairman tokens: ${response.usage.input_tokens} prompt, ${response.usage.output_tokens} completion`
      );
    }

    const content = response.choices[0].message.content;
    const findings = parseReviewResponse(content, 1, 1);
    console.log(`   Chairman consolidated to ${findings.length} findings`);
    return findings;
  } catch (error) {
    console.error("   Chairman synthesis failed:", error.message);
    console.log("   Falling back to raw concatenated findings");

    return personaFindings.flatMap((pf) => pf.findings);
  }
}

async function judgeFilter(chairmanFindings) {
  console.log("\n   Judge applying quality gate...");
  console.log(`   Input findings: ${chairmanFindings.length}`);

  if (chairmanFindings.length === 0) {
    console.log("   No findings to judge - skipping");
    return [];
  }

  const { systemPrompt, userPrompt } = buildJudgePrompt(chairmanFindings);

  try {
    const response = await callAIRouter(systemPrompt, userPrompt);

    if (response.usage) {
      console.log(
        `   Judge tokens: ${response.usage.input_tokens} prompt, ${response.usage.output_tokens} completion`
      );
    }

    const content = response.choices[0].message.content;
    const filteredFindings = parseReviewResponse(content, 1, 1);
    const dropped = chairmanFindings.length - filteredFindings.length;
    console.log(
      `   Judge passed ${filteredFindings.length} findings, dropped ${dropped}`
    );
    return filteredFindings;
  } catch (error) {
    console.error("   Judge filtering failed:", error.message);
    console.log("   Falling back to chairman findings (unfiltered)");
    return chairmanFindings;
  }
}

export async function councilReview(
  reviewStandards,
  filesChanged,
  diff,
  codebaseContext,
  falsePositives = []
) {
  console.log("\n   Code Review Council convening...");
  console.log("   5 personas will review in parallel\n");

  const { batches, totalBatches } = prepareDiff(
    diff,
    "",
    codebaseContext
  );

  const personaList = Object.values(PERSONAS);

  // Stage 1: Run all 5 personas in parallel
  console.log("--- Stage 1: Parallel Persona Reviews ---");
  const personaResults = await Promise.all(
    personaList.map(async (persona, index) => {
      if (index > 0) {
        await new Promise((resolve) => setTimeout(resolve, index * 500));
      }
      console.log(`\n${persona.label} starting review...`);
      const startTime = Date.now();

      try {
        const findings = await runPersonaReview(
          persona,
          batches,
          filesChanged,
          reviewStandards,
          codebaseContext,
          falsePositives
        );
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`${persona.label} done - ${findings.length} findings (${duration}s)`);
        return { persona, findings, failed: false };
      } catch (error) {
        console.error(`${persona.label} failed: ${error.message}`);
        return { persona, findings: [], failed: true };
      }
    })
  );

  // Log summary
  console.log("\n--- Persona Summary ---");
  for (const { persona, findings } of personaResults) {
    const high = findings.filter((f) => f.severity === "HIGH").length;
    const medium = findings.filter((f) => f.severity === "MEDIUM").length;
    const low = findings.filter((f) => f.severity === "LOW").length;
    console.log(
      `   ${persona.label}: ${findings.length} findings (${high} HIGH, ${medium} MEDIUM, ${low} LOW)`
    );
  }

  const failedCount = personaResults.filter((r) => r.failed).length;
  if (failedCount === personaList.length) {
    throw new Error(
      "All 5 council personas failed due to API errors. Aborting to prevent false approval."
    );
  }
  if (failedCount > 0) {
    console.log(`   ${failedCount}/${personaList.length} personas failed - continuing with partial results`);
  }

  // Stage 2: Chairman synthesis
  console.log("\n--- Stage 2: Chairman Synthesis ---");
  const synthesized = await chairmanSynthesize(personaResults);

  // Stage 3: Judge quality gate
  console.log("\n--- Stage 3: Judge Quality Gate ---");
  const finalFindings = await judgeFilter(synthesized);

  // Log final verdict
  console.log("\n--- Final Council Verdict ---");
  const high = finalFindings.filter((f) => f.severity === "HIGH").length;
  const medium = finalFindings.filter((f) => f.severity === "MEDIUM").length;
  const low = finalFindings.filter((f) => f.severity === "LOW").length;
  console.log(
    `   ${finalFindings.length} total findings: ${high} HIGH, ${medium} MEDIUM, ${low} LOW`
  );

  return finalFindings.map(({ persona, ...rest }) => rest);
}
