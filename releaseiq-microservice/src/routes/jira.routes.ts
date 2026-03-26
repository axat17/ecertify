import { Router } from 'express';
import { authenticate, requireProjectAdmin } from '../middleware/auth';
import { JiraStory, JiraFixVersion, Project, Activity, ErrorLog } from '../models';
import logger from '../utils/logger';
import config from '../config';

const router = Router();

const RETRY_MAX = 3;
const RETRY_DELAY_MS = 2000;

async function withRetry<T>(fn: () => Promise<T>, retries = RETRY_MAX): Promise<T> {
  try { return await fn(); }
  catch (err) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      return withRetry(fn, retries - 1);
    }
    throw err;
  }
}

// Build mock Jira payload that mirrors the real Jira Cloud REST API response shape
function buildMockJiraPayload(projectId: string, releaseLabel: string, jiraKey: string) {
  const TEAMS = ['TEAM-A', 'TEAM-B', 'TEAM-C', 'TEAM-D', 'TEAM-E', 'TEAM-F', 'TEAM-G', 'TEAM-H'];
  const LOREM = [
    'Lorem ipsum dolor sit amet consectetur adipiscing elit platform permissions',
    'Ut labore et dolore magna aliqua eiusmod tempor dashboard visibility config',
    'Quis nostrud exercitation ullamco laboris nisi aliquip autopay dual maintenance',
    'Duis aute irure dolor reprehenderit voluptate velit picklist value set change',
    'Excepteur sint occaecat cupidatat proident lightning design system implementation',
    'Sunt in culpa officia deserunt mollit anim retail segment exceed limit fix',
    'Sed perspiciatis omnis iste natus voluptatem notice comments sort order update',
    'Nemo enim ipsam voluptatem quia aspernatur HOD promote field dependency setup',
    'Neque porro quisquam dolorem ipsum quia dolor voice call lightning record pages',
    'At vero eos et accusamus iusto odio dignissimos parse error processing report',
    'Nam libero tempore soluta nobis eligendi optio cumque nihil account associations',
    'Temporibus autem quibusdam officiis debitis rerum necessitatibus contact role UI',
  ];
  const totalStories = projectId === 'ecertify' ? 47 : projectId === 'sf2' ? 31 : 22;
  const stories = [];
  const fixVersionMap: Record<string, { done: number; inProg: number; todo: number; total: number }> = {};

  for (let i = 0; i < totalStories; i++) {
    const team = TEAMS[i % 8];
    const statuses = ['Done', 'Done', 'Done', 'In Progress', 'In Progress', 'To Do'];
    const status = statuses[i % statuses.length];
    const hasC = Math.random() > 0.12;
    const hasR = Math.random() > 0.08;
    const bundles = ['Bundle 1', 'Bundle 2', 'Bundle 3', null, null];
    const bundle = hasC ? bundles[i % bundles.length] : null;

    stories.push({
      key: `${jiraKey}-${1000 + i}`,
      fields: {
        summary: LOREM[i % LOREM.length] + ` (item ${i + 1})`,
        issuetype: { name: i % 5 === 0 ? 'Bug' : 'Story' },
        status: { name: status },
        assignee: { displayName: `User ${String.fromCharCode(65 + (i % 8))}` },
        labels: [...(hasC ? ['CopadoCICD'] : []), ...(hasR ? [releaseLabel] : [])],
        customfield_bundle: bundle,
        priority: { name: ['Highest', 'High', 'Medium', 'Low'][i % 4] },
        story_points: [1, 2, 3, 5, 8][i % 5],
        comment: { total: Math.floor(Math.random() * 5) },
        attachment: { length: Math.floor(Math.random() * 3) },
        subtasks: i % 4 === 0 ? [{ key: `${jiraKey}-${2000 + i}`, fields: { summary: 'Sub-task item', status: { name: 'To Do' } } }] : [],
        fixVersions: [{ name: releaseLabel, releaseDate: new Date().toISOString().split('T')[0] }],
        // Team is typically a custom field
        customfield_team: team,
      },
    });

    if (!fixVersionMap[team]) fixVersionMap[team] = { done: 0, inProg: 0, todo: 0, total: 0 };
    fixVersionMap[team].total++;
    if (status === 'Done' || status === 'Accepted') fixVersionMap[team].done++;
    else if (status === 'In Progress') fixVersionMap[team].inProg++;
    else fixVersionMap[team].todo++;
  }

  return { stories, fixVersionMap, totalStories };
}

// POST /jira/sync/:projectId — trigger a full Jira sync
router.post('/sync/:projectId', authenticate, async (req, res) => {
  const { projectId } = req.params;

  try {
    const project = await Project.findOne({ projectId });
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    // Mark as syncing
    project.syncStatus = 'syncing';
    await project.save();

    logger.info('[Jira Sync] Starting sync', { projectId, mock: config.jira.mock });

    let storiesData: ReturnType<typeof buildMockJiraPayload>;

    if (config.jira.mock) {
      // Simulate network latency
      await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
      storiesData = buildMockJiraPayload(projectId, project.releaseLabel, project.jiraKey);
    } else {
      // Real Jira Cloud REST API v3
      // Step 1: GET /rest/api/3/project/{key}/versions
      // Step 2: GET /rest/api/3/search?jql=project={key} AND fixVersion="{releaseLabel}"&fields=summary,status,assignee,labels,issuetype,subtasks,comment,attachment,priority,story_points,customfield_team&maxResults=200
      const response = await withRetry(async () => {
        const axios = (await import('axios')).default;
        const auth = Buffer.from(`${config.jira.userEmail}:${config.jira.apiToken}`).toString('base64');
        const jql = encodeURIComponent(`project = "${project.jiraKey}" AND fixVersion = "${project.releaseLabel}" ORDER BY created DESC`);
        const url = `${config.jira.baseUrl}/rest/api/3/search?jql=${jql}&maxResults=500&fields=summary,status,assignee,labels,issuetype,subtasks,comment,attachment,priority,story_points,customfield_team,fixVersions`;
        const resp = await axios.get(url, {
          headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
          timeout: 30000,
        });
        return resp.data;
      });
      // Transform real response to match mock shape
      storiesData = {
        stories: response.issues || [],
        fixVersionMap: {},
        totalStories: response.total || 0,
      };
    }

    // Upsert stories into MongoDB
    const bulkOps = storiesData.stories.map((issue: any) => {
      const fields = issue.fields || issue;
      const team = fields.customfield_team || fields.team || 'TEAM-A';
      const labels: string[] = fields.labels || [];
      const hasCopadoCICD = labels.includes('CopadoCICD');
      const hasReleaseLabel = labels.includes(project.releaseLabel);

      return {
        updateOne: {
          filter: { key: issue.key, projectId },
          update: {
            $set: {
              projectId,
              releaseVersion: project.releaseLabel,
              key: issue.key,
              title: fields.summary,
              type: fields.issuetype?.name || 'Story',
              status: fields.status?.name || 'To Do',
              team,
              assignee: fields.assignee?.displayName || 'Unassigned',
              labels,
              bundle: fields.customfield_bundle || null,
              jiraUrl: `${config.jira.baseUrl}/browse/${issue.key}`,
              subtasks: (fields.subtasks || []).map((st: any) => ({
                key: st.key,
                title: st.fields?.summary || '',
                status: st.fields?.status?.name || 'To Do',
                jiraUrl: `${config.jira.baseUrl}/browse/${st.key}`,
              })),
              commentCount: fields.comment?.total || 0,
              attachmentCount: (fields.attachment || []).length,
              hasCopadoCICD,
              hasReleaseLabel,
              isBlocker: labels.includes('blocker') || labels.includes('Blocker'),
              priority: fields.priority?.name,
              storyPoints: fields.story_points || fields.customfield_storypoints,
              lastSyncedAt: new Date(),
            },
          },
          upsert: true,
        },
      };
    });

    if (bulkOps.length > 0) {
      await JiraStory.bulkWrite(bulkOps);
    }

    // Upsert fix versions per team
    const fvBulkOps = Object.entries(storiesData.fixVersionMap).map(([team, counts]) => ({
      updateOne: {
        filter: { projectId, team, versionName: project.releaseLabel },
        update: {
          $set: {
            projectId,
            team,
            versionName: project.releaseLabel,
            storyCount: counts.total,
            doneCount: counts.done,
            inProgressCount: counts.inProg,
            todoCount: counts.todo,
            lastSyncedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    if (fvBulkOps.length > 0) {
      await JiraFixVersion.bulkWrite(fvBulkOps);
    }

    // Update project sync status
    project.syncStatus = 'synced';
    project.lastJiraSync = new Date();
    project.storyCount = storiesData.totalStories;
    project.retrySyncCount = 0;
    project.lastSyncError = undefined;
    await project.save();

    await Activity.create({
      projectId,
      type: 'jira_synced',
      message: `Jira sync completed — ${storiesData.totalStories} stories loaded for ${project.releaseLabel}`,
      icon: '🔄',
      actorEmail: req.user?.email,
      actorName: req.user?.name,
    });

    logger.info('[Jira Sync] Completed', { projectId, stories: storiesData.totalStories });
    res.json({
      success: true,
      data: { storyCount: storiesData.totalStories, syncedAt: new Date() },
      message: `Sync complete — ${storiesData.totalStories} stories loaded`,
    });

  } catch (err) {
    const errMsg = (err as Error).message;
    logger.error('[Jira Sync] Failed', { error: err, projectId });

    // Update project with error state
    await Project.findOneAndUpdate({ projectId }, {
      syncStatus: 'error',
      lastSyncError: errMsg,
      $inc: { retrySyncCount: 1 },
    });

    await ErrorLog.create({
      context: 'jira_sync',
      message: errMsg,
      stack: (err as Error).stack,
      projectId,
      level: 'error',
    }).catch(() => {});

    res.status(502).json({
      success: false,
      error: `Jira sync failed: ${errMsg}. Cached data is still available.`,
      retryable: true,
    });
  }
});

// GET /jira/stories/:projectId — get stories from MongoDB (already synced)
router.get('/stories/:projectId', authenticate, async (req, res) => {
  try {
    const { team, status, hasCopadoCICD, hasReleaseLabel, bundle, type } = req.query;
    const filter: Record<string, unknown> = { projectId: req.params.projectId };
    if (team) filter.team = team;
    if (status) filter.status = status;
    if (hasCopadoCICD !== undefined) filter.hasCopadoCICD = hasCopadoCICD === 'true';
    if (hasReleaseLabel !== undefined) filter.hasReleaseLabel = hasReleaseLabel === 'true';
    if (bundle) filter.bundle = bundle;
    if (type) filter.type = type;

    const stories = await JiraStory.find(filter).sort({ team: 1, key: 1 }).lean();
    const total = stories.length;
    const missing = stories.filter(s => !s.hasCopadoCICD || !s.hasReleaseLabel).length;

    res.json({
      success: true,
      data: stories,
      meta: {
        total,
        missing,
        ready: total - missing,
        lastSyncedAt: stories[0]?.lastSyncedAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch stories' });
  }
});

// GET /jira/fix-versions/:projectId — consolidated + per-team fix version breakdown
router.get('/fix-versions/:projectId', authenticate, async (req, res) => {
  try {
    const fixVersions = await JiraFixVersion.find({ projectId: req.params.projectId }).lean();
    const hotfixes = fixVersions.filter(v => v.hotfix);
    const regular = fixVersions.filter(v => !v.hotfix);

    // Consolidated totals
    const consolidated = regular.reduce((acc, fv) => ({
      totalStories: acc.totalStories + fv.storyCount,
      done: acc.done + fv.doneCount,
      inProgress: acc.inProgress + fv.inProgressCount,
      todo: acc.todo + fv.todoCount,
    }), { totalStories: 0, done: 0, inProgress: 0, todo: 0 });

    res.json({
      success: true,
      data: {
        consolidated: { ...consolidated, teamCount: regular.length },
        perTeam: regular,
        hotfixes,
        lastSyncedAt: regular[0]?.lastSyncedAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch fix versions' });
  }
});

// PATCH /jira/story/:projectId/:storyKey/label — add label to a story (mock)
router.patch('/story/:projectId/:storyKey/label', authenticate, requireProjectAdmin(), async (req, res) => {
  try {
    const { label } = req.body;
    if (!label) { res.status(400).json({ success: false, error: 'label is required' }); return; }

    const story = await JiraStory.findOne({ projectId: req.params.projectId, key: req.params.storyKey });
    if (!story) { res.status(404).json({ success: false, error: 'Story not found in local cache. Run sync first.' }); return; }

    if (!story.labels.includes(label)) story.labels.push(label);
    if (label === 'CopadoCICD') story.hasCopadoCICD = true;
    const proj = await Project.findOne({ projectId: req.params.projectId }).lean();
    if (proj && story.labels.includes(proj.releaseLabel)) story.hasReleaseLabel = true;

    await story.save();

    // In production: call Jira API PUT /rest/api/3/issue/{storyKey} to add label
    logger.info('[Jira] Label added (mock)', { storyKey: req.params.storyKey, label });
    res.json({ success: true, data: { key: story.key, labels: story.labels }, message: `Label '${label}' added to ${req.params.storyKey}` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to add label' });
  }
});

export default router;
