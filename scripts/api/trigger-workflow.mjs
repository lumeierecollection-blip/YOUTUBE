#!/usr/bin/env node
/**
 * Trigger GitHub Actions Workflow
 * 
 * Triggers the margaret-clitherow-rework.yml workflow for the ci-fix/coverage-audit branch
 * with dry_run=true
 */

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// Configuration
const REPO = 'lumeierecollection-blip/YOUTUBE';
const WORKFLOW = 'margaret-clitherow-rework.yml';
const BRANCH = 'ci-fix/coverage-audit';
const CHANNEL_ID = '1';
const DRY_RUN = 'true';

// Get GitHub token from environment
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_API = 'https://api.github.com';

async function triggerWorkflow() {
  console.log('[trigger] Starting GitHub Actions workflow trigger...');
  console.log('[trigger] Repository:', REPO);
  console.log('[trigger] Workflow:', WORKFLOW);
  console.log('[trigger] Branch:', BRANCH);
  console.log('[trigger] Channel ID:', CHANNEL_ID);
  console.log('[trigger] Dry run:', DRY_RUN);
  
  if (!GITHUB_TOKEN) {
    console.error('[trigger] ERROR: GITHUB_TOKEN environment variable not set');
    console.error('[trigger] Please set GITHUB_TOKEN and retry');
    process.exit(1);
  }
  
  const response = await fetch(`${GITHUB_API}/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ref: BRANCH,
      inputs: {
        channel_id: CHANNEL_ID,
        dry_run: DRY_RUN
      }
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('[trigger] ERROR: Failed to trigger workflow');
    console.error('[trigger] Status:', response.status);
    console.error('[trigger] Response:', error);
    process.exit(1);
  }
  
  console.log('[trigger] Workflow triggered successfully!');
  console.log('[trigger] Check: https://github.com/lumeierecollection-blip/YOUTUBE/actions');
  
  // Get recent workflow runs
  console.log('\n[trigger] Fetching recent workflow runs...');
  
  const runsResponse = await fetch(`${GITHUB_API}/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=5`, {
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json'
    }
  });
  
  const runs = await runsResponse.json();
  
  if (runs.workflows?.[0]?.name) {
    console.log('[trigger] Workflow:', runs.workflows[0].name);
  }
  
  if (runs.workflow_runs?.length > 0) {
    const run = runs.workflow_runs[0];
    console.log('\n[trigger] Latest Run Details:');
    console.log('[trigger]   Run ID:', run.id);
    console.log('[trigger]   Run Number:', run.run_number);
    console.log('[trigger]   Status:', run.status);
    console.log('[trigger]   Conclusion:', run.conclusion || 'in_progress');
    console.log('[trigger]   Created:', run.created_at);
    console.log('[trigger]   HTML URL:', run.html_url);
    
    // Save run info
    const outputDir = join(ROOT, '.cache', 'inspect', 'margaret-clitherow-rework');
    mkdirSync(outputDir, { recursive: true });
    
    writeFileSync(join(outputDir, 'workflow-run-info.json'), JSON.stringify({
      run_id: run.id,
      run_number: run.run_number,
      status: run.status,
      conclusion: run.conclusion,
      html_url: run.html_url,
      triggered_at: new Date().toISOString(),
      inputs: { channel_id: CHANNEL_ID, dry_run: DRY_RUN }
    }, null, 2));
    
    console.log('\n[trigger] Run info saved to:', join(outputDir, 'workflow-run-info.json'));
    
    return { run_id: run.id, html_url: run.html_url };
  }
  
  return null;
}

// Run it
triggerWorkflow().catch(e => {
  console.error('[trigger] Exception:', e.message);
  process.exit(1);
});