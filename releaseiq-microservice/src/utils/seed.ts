/**
 * ReleaseIQ Database Seed Script
 * Run: npm run seed
 * Seeds all collections with realistic dummy data for local development
 */

import '../config'; // loads env first
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { connectDB } from './db';
import {
  User, Project, JiraStory, JiraFixVersion,
  CopadoBundle, CertificationSession, Activity
} from '../models';
import logger from './logger';
import config from '../config';

const TEAMS = ['TEAM-A', 'TEAM-B', 'TEAM-C', 'TEAM-D', 'TEAM-E', 'TEAM-F', 'TEAM-G', 'TEAM-H'];

const LOREM_TITLES = [
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
  'Itaque earum rerum hic tenetur sapiente delectus reiciendis home page layout fix',
  'Quis autem vel eum iure reprehenderit voluptate velit two instances open cases',
  'Ut enim ad minima veniam nostrum exercitationem corporis edit contact previous',
];

async function seedUsers(): Promise<void> {
  await User.deleteMany({});
  await User.insertMany([
    { email: 'john.doe@adp.com', name: 'John Doe', initials: 'JD', role: 'main-admin', projectAdminOf: [], isActive: true },
    { email: 'jane.smith@adp.com', name: 'Jane Smith', initials: 'JS', role: 'project-admin', projectAdminOf: ['ecertify', 'sf1'], isActive: true },
    { email: 'alex.johnson@adp.com', name: 'Alex Johnson', initials: 'AJ', role: 'project-admin', projectAdminOf: ['sf1'], isActive: true },
    { email: 'sam.rivera@adp.com', name: 'Sam Rivera', initials: 'SR', role: 'project-admin', projectAdminOf: ['sf2'], isActive: true },
    { email: 'taylor.morgan@adp.com', name: 'Taylor Morgan', initials: 'TM', role: 'project-admin', projectAdminOf: ['abc'], isActive: true },
    { email: 'tester.bu@adp.com', name: 'BU Tester', initials: 'BT', role: 'user', projectAdminOf: [], isActive: true },
    { email: 'qa.lead@adp.com', name: 'QA Lead', initials: 'QL', role: 'user', projectAdminOf: [], isActive: true },
  ]);
  logger.info('[Seed] Users seeded');
}

async function seedProjects(): Promise<void> {
  await Project.deleteMany({});
  await Project.insertMany([
    {
      projectId: 'ecertify',
      name: 'E-Certify Salesforce',
      shortName: 'E-Certify SF',
      type: 'salesforce',
      icon: '🔐',
      color: '#d0271d',
      status: 'In Progress',
      healthScore: 78,
      currentSprint: '26.14',
      currentRelease: 'IAT Salesforce 26.14',
      releaseAnchorDate: new Date('2026-03-24'),
      cadence: 'biweekly',
      description: 'Lorem ipsum dolor sit amet consectetur adipiscing elit eiusmod tempor incididunt ut labore dolore magna aliqua certification platform.',
      tags: ['Certification', 'Jira', 'Copado', 'PROD'],
      jiraKey: 'SF',
      jiraBaseUrl: config.jira.baseUrl,
      jiraApiToken: '',
      releaseLabel: 'Salesforce_26.14',
      copadoCICD: 'CopadoCICD',
      copadoConfig: {
        url: config.copado.baseUrl,
        apiToken: '',
        pipelineName: 'SF Main Production Pipeline',
        trackedEnvs: ['DEV', 'SIT', 'UAT', 'STG', 'PROD'],
        bundleNamingConvention: 'Bundle_{n}_{release}',
        apexCoverageThreshold: 75,
      },
      isLive: true,
      teamCount: 8,
      ownerEmail: 'jane.smith@adp.com',
      adminEmails: ['jane.smith@adp.com', 'john.doe@adp.com'],
      storyCount: 47,
      doneCount: 34,
      defectCount: 13,
      syncStatus: 'synced',
      lastJiraSync: new Date(),
    },
    {
      projectId: 'sf1',
      name: 'SF1 — Commerce Cloud',
      shortName: 'SF1 Commerce',
      type: 'salesforce',
      icon: '☁️',
      color: '#2060d8',
      status: 'Planning',
      healthScore: 35,
      currentSprint: '4.2',
      currentRelease: 'Salesforce Commerce 4.2',
      releaseAnchorDate: new Date('2026-04-15'),
      cadence: 'biweekly',
      description: 'Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure dolor.',
      tags: ['Commerce', 'B2B', 'API', 'UAT'],
      jiraKey: 'COM',
      jiraBaseUrl: config.jira.baseUrl,
      jiraApiToken: '',
      releaseLabel: 'SFCommerce_4.2',
      copadoCICD: 'CopadoCICD',
      copadoConfig: {
        url: config.copado.baseUrl,
        apiToken: '',
        pipelineName: 'Commerce Production Pipeline',
        trackedEnvs: ['DEV', 'SIT', 'UAT', 'STG', 'PROD'],
        bundleNamingConvention: 'COM_Bundle_{n}',
        apexCoverageThreshold: 75,
      },
      isLive: false,
      teamCount: 7,
      ownerEmail: 'alex.johnson@adp.com',
      adminEmails: ['alex.johnson@adp.com'],
      storyCount: 22,
      doneCount: 8,
      defectCount: 3,
      syncStatus: 'never',
    },
    {
      projectId: 'sf2',
      name: 'SF2 — Service Cloud',
      shortName: 'SF2 Service',
      type: 'salesforce',
      icon: '⚡',
      color: '#7967ae',
      status: 'Complete',
      healthScore: 100,
      currentSprint: '8.5',
      currentRelease: 'Salesforce Service 8.5',
      releaseAnchorDate: new Date('2026-03-17'),
      cadence: 'biweekly',
      description: 'Excepteur sint occaecat cupidatat non proident sunt in culpa officia deserunt mollit anim id est laborum lorem ipsum dolor sit.',
      tags: ['Service', 'Cases', 'Complete', 'Live'],
      jiraKey: 'SVC',
      jiraBaseUrl: config.jira.baseUrl,
      jiraApiToken: '',
      releaseLabel: 'SFService_8.5',
      copadoCICD: 'CopadoCICD',
      copadoConfig: {
        url: config.copado.baseUrl,
        apiToken: '',
        pipelineName: 'Service Production Pipeline',
        trackedEnvs: ['DEV', 'SIT', 'UAT', 'STG', 'PROD'],
        bundleNamingConvention: 'SVC_Bundle_{n}',
        apexCoverageThreshold: 75,
      },
      isLive: false,
      teamCount: 7,
      ownerEmail: 'sam.rivera@adp.com',
      adminEmails: ['sam.rivera@adp.com'],
      storyCount: 31,
      doneCount: 31,
      defectCount: 0,
      syncStatus: 'synced',
      lastJiraSync: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      projectId: 'abc',
      name: 'ABC — React Dashboard',
      shortName: 'ABC React',
      type: 'react',
      icon: '⚛️',
      color: '#0d9488',
      status: 'In Progress',
      healthScore: 60,
      currentSprint: '2.3',
      currentRelease: 'ABC React 2.3',
      releaseAnchorDate: new Date('2026-04-01'),
      cadence: 'biweekly',
      description: 'Duis aute irure dolor in reprehenderit voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat.',
      tags: ['React', 'Dashboard', 'TypeScript', 'CI/CD'],
      jiraKey: 'ABC',
      jiraBaseUrl: config.jira.baseUrl,
      jiraApiToken: '',
      releaseLabel: 'ABCReact_2.3',
      copadoCICD: 'N/A',
      isLive: false,
      teamCount: 3,
      ownerEmail: 'taylor.morgan@adp.com',
      adminEmails: ['taylor.morgan@adp.com'],
      storyCount: 18,
      doneCount: 11,
      defectCount: 4,
      syncStatus: 'never',
    },
  ]);
  logger.info('[Seed] Projects seeded');
}

async function seedJiraStories(): Promise<void> {
  await JiraStory.deleteMany({});
  await JiraFixVersion.deleteMany({});

  const stories = [];
  const fixVersions: Record<string, Record<string, { done: number; inProg: number; todo: number; total: number }>> = {};

  // Generate 47 stories for ecertify
  for (let i = 0; i < 47; i++) {
    const team = TEAMS[i % 8];
    const statuses = ['Done', 'Done', 'Done', 'In Progress', 'In Progress', 'To Do'];
    const status = statuses[i % statuses.length];
    const hasC = Math.random() > 0.12;
    const hasR = Math.random() > 0.08;
    const bundles = ['Bundle 1', 'Bundle 2', 'Bundle 3', null, null];
    const bundle = hasC ? bundles[i % bundles.length] : null;
    const labels = [...(hasC ? ['CopadoCICD'] : []), ...(hasR ? ['Salesforce_26.14'] : [])];

    stories.push({
      projectId: 'ecertify',
      releaseVersion: 'Salesforce 26.14',
      key: `SF-${1000 + i}`,
      title: LOREM_TITLES[i % LOREM_TITLES.length] + ` (item ${i + 1})`,
      type: i % 5 === 0 ? 'Bug' : 'Story',
      status,
      team,
      assignee: `User ${String.fromCharCode(65 + (i % 8))}`,
      labels,
      bundle,
      jiraUrl: `${config.jira.baseUrl}/browse/SF-${1000 + i}`,
      subtasks: i % 4 === 0 ? [{ key: `SF-${2000 + i}`, title: 'Sub-task: ' + LOREM_TITLES[i % LOREM_TITLES.length].substring(0, 40), status: 'To Do', jiraUrl: `${config.jira.baseUrl}/browse/SF-${2000 + i}` }] : [],
      commentCount: Math.floor(Math.random() * 5),
      attachmentCount: Math.floor(Math.random() * 3),
      hasCopadoCICD: hasC,
      hasReleaseLabel: hasR,
      isBlocker: i % 7 === 0,
      priority: ['Highest', 'High', 'Medium', 'Low'][i % 4],
      storyPoints: [1, 2, 3, 5, 8][i % 5],
      lastSyncedAt: new Date(),
    });

    // Track for fix versions
    if (!fixVersions['ecertify']) fixVersions['ecertify'] = {};
    if (!fixVersions['ecertify'][team]) fixVersions['ecertify'][team] = { done: 0, inProg: 0, todo: 0, total: 0 };
    fixVersions['ecertify'][team].total++;
    if (status === 'Done' || status === 'Accepted') fixVersions['ecertify'][team].done++;
    else if (status === 'In Progress') fixVersions['ecertify'][team].inProg++;
    else fixVersions['ecertify'][team].todo++;
  }

  await JiraStory.insertMany(stories);

  // Seed fix versions for ecertify
  const fvDocs = Object.entries(fixVersions['ecertify'] || {}).map(([team, counts]) => ({
    projectId: 'ecertify',
    team,
    versionName: 'Salesforce 26.14',
    releaseDate: new Date('2026-03-24'),
    storyCount: counts.total,
    doneCount: counts.done,
    inProgressCount: counts.inProg,
    todoCount: counts.todo,
    hotfix: false,
    stagingRelease: false,
    lastSyncedAt: new Date(),
  }));
  await JiraFixVersion.insertMany(fvDocs);

  logger.info('[Seed] Jira stories and fix versions seeded');
}

async function seedBundles(): Promise<void> {
  await CopadoBundle.deleteMany({});
  await CopadoBundle.insertMany([
    {
      projectId: 'ecertify',
      releaseVersion: 'Salesforce 26.14',
      name: 'Bundle 1 — Core Platform',
      bundleNumber: 1,
      status: 'Deployed',
      deployedAt: new Date('2026-03-24T10:28:00'),
      storyCount: 18,
      teams: ['TEAM-A', 'TEAM-C', 'TEAM-E'],
      componentSummary: 'Apex (47), LWC (12), Flows (8)',
      promotions: [
        { env: 'DEV', status: 'Passed', promotedAt: new Date('2026-03-22T09:00:00') },
        { env: 'SIT', status: 'Passed', promotedAt: new Date('2026-03-22T14:00:00') },
        { env: 'UAT', status: 'Passed', promotedAt: new Date('2026-03-23T10:00:00') },
        { env: 'STG', status: 'Passed', promotedAt: new Date('2026-03-23T18:00:00') },
        { env: 'PROD', status: 'Passed', promotedAt: new Date('2026-03-24T10:28:00') },
      ],
      apexResults: { totalTests: 248, passed: 248, failed: 0, skipped: 3, coveragePercent: 94, runAt: new Date('2026-03-23T17:00:00') },
      validationResult: { status: 'Passed', checks: ['Component Validation', 'Permission Set Check', 'Flow Activation', 'Field Access'], runAt: new Date('2026-03-23T17:45:00') },
      backPromoHistory: [],
      lastSyncedAt: new Date(),
    },
    {
      projectId: 'ecertify',
      releaseVersion: 'Salesforce 26.14',
      name: 'Bundle 2 — BU Features',
      bundleNumber: 2,
      status: 'Deployed',
      deployedAt: new Date('2026-03-24T11:15:00'),
      storyCount: 14,
      teams: ['TEAM-B', 'TEAM-D', 'TEAM-F'],
      componentSummary: 'Apex (31), LWC (8), Perms (5)',
      promotions: [
        { env: 'DEV', status: 'Passed', promotedAt: new Date('2026-03-22T10:00:00') },
        { env: 'SIT', status: 'Passed', promotedAt: new Date('2026-03-22T15:30:00') },
        { env: 'UAT', status: 'Passed', promotedAt: new Date('2026-03-23T11:00:00') },
        { env: 'STG', status: 'Passed', promotedAt: new Date('2026-03-23T20:00:00') },
        { env: 'PROD', status: 'Passed', promotedAt: new Date('2026-03-24T11:15:00') },
      ],
      apexResults: { totalTests: 184, passed: 182, failed: 2, skipped: 1, coveragePercent: 91, runAt: new Date('2026-03-23T19:00:00') },
      validationResult: { status: 'Passed with Warnings', checks: ['Component Validation', 'Field Access'], warnings: ['2 deprecated API usages found'], runAt: new Date('2026-03-23T19:30:00') },
      backPromoHistory: [{ fromEnv: 'PROD', toEnv: 'STG', performedAt: new Date('2026-03-21'), reason: 'Hotfix rollback test', performedBy: 'john.doe@adp.com' }],
      lastSyncedAt: new Date(),
    },
    {
      projectId: 'ecertify',
      releaseVersion: 'Salesforce 26.14',
      name: 'Bundle 3 — Hotfixes',
      bundleNumber: 3,
      status: 'In Progress',
      storyCount: 6,
      teams: ['TEAM-G', 'TEAM-H'],
      componentSummary: 'Apex (4), Labels (12)',
      promotions: [
        { env: 'DEV', status: 'Passed', promotedAt: new Date('2026-03-24T08:00:00') },
        { env: 'SIT', status: 'Passed', promotedAt: new Date('2026-03-24T09:30:00') },
        { env: 'UAT', status: 'In Progress' },
        { env: 'STG', status: 'Pending' },
        { env: 'PROD', status: 'Pending' },
      ],
      apexResults: { totalTests: 42, passed: 40, failed: 0, skipped: 2, coveragePercent: 88 },
      validationResult: { status: 'In Progress', checks: ['Component Validation'] },
      backPromoHistory: [],
      lastSyncedAt: new Date(),
    },
  ]);
  logger.info('[Seed] Copado bundles seeded');
}

async function seedCertificationSessions(): Promise<void> {
  await CertificationSession.deleteMany({});

  const completedSessions = [
    { name: 'Team Alpha', email: 'team.alpha@adp.com', role: 'bu', bu: 'Enterprise', dur: 517, defects: 0 },
    { name: 'Team Beta', email: 'team.beta@adp.com', role: 'bu', bu: 'Enterprise', dur: 3943, defects: 0 },
    { name: 'Jane Smith', email: 'jane.smith@adp.com', role: 'bu', bu: 'MAS', dur: 3861, defects: 1 },
    { name: 'Alex Johnson', email: 'alex.johnson@adp.com', role: 'bu', bu: 'NAS', dur: 83, defects: 0 },
    { name: 'Sam Rivera', email: 'sam.rivera@adp.com', role: 'bu', bu: 'Canada', dur: 87, defects: 0 },
    { name: 'Jordan Lee', email: 'jordan.lee@adp.com', role: 'bu', bu: 'SBS', dur: 4296, defects: 5 },
    { name: 'QA Team Lead', email: 'qa.lead@adp.com', role: 'qa', bu: 'All BUs', dur: 8130, defects: 3 },
  ];

  const sessions = completedSessions.map((s, i) => ({
    sessionId: uuidv4(),
    projectId: 'ecertify',
    releaseVersion: 'IAT Salesforce 26.14',
    certifierName: s.name,
    certifierEmail: s.email,
    certifierRole: s.role,
    businessUnit: s.bu,
    environment: 'UAT',
    status: 'Complete',
    startedAt: new Date(Date.now() - (12 - i) * 60 * 60 * 1000),
    completedAt: new Date(Date.now() - (12 - i) * 60 * 60 * 1000 + s.dur * 1000),
    durationSeconds: s.dur,
    defects: Array.from({ length: s.defects }).map((_, di) => ({
      id: uuidv4(),
      title: LOREM_TITLES[di % LOREM_TITLES.length].substring(0, 60) + ` defect ${di + 1}`,
      description: 'Steps to reproduce: navigate to screen, click button, observe error',
      severity: ['Critical', 'Major', 'Minor'][di % 3],
      jiraPriority: ['Highest', 'High', 'Medium'][di % 3],
      linkedStoryKey: `SF-${1000 + di}`,
      environment: 'UAT',
      functionalArea: 'Payroll',
      reporterName: s.name,
      reporterEmail: s.email,
      reporterRole: s.role,
      businessUnit: s.bu,
      queuedForJira: true,
      loggedAt: new Date(),
    })),
    defectCount: s.defects,
    verifiedStoryKeys: [`SF-${1000 + i}`, `SF-${1001 + i}`],
    jiraIssuesCreated: false,
    jiraIssueKeys: [],
  }));

  // Add two active in-progress sessions to show the active session list feature
  sessions.push(
    {
      sessionId: uuidv4(),
      projectId: 'ecertify',
      releaseVersion: 'IAT Salesforce 26.14',
      certifierName: 'Chris Davis',
      certifierEmail: 'chris.davis@adp.com',
      certifierRole: 'bu',
      businessUnit: 'Wisely-Wage Pay',
      environment: 'UAT',
      status: 'In Progress',
      startedAt: new Date(Date.now() - 45 * 60 * 1000),
      durationSeconds: 45 * 60,
      defects: [],
      defectCount: 0,
      verifiedStoryKeys: [],
      jiraIssuesCreated: false,
      jiraIssueKeys: [],
    } as any,
    {
      sessionId: uuidv4(),
      projectId: 'ecertify',
      releaseVersion: 'IAT Salesforce 26.14',
      certifierName: 'QA Regression',
      certifierEmail: 'qa.regression@adp.com',
      certifierRole: 'qa',
      businessUnit: 'All BUs',
      environment: 'UAT',
      status: 'In Progress',
      startedAt: new Date(Date.now() - 90 * 60 * 1000),
      durationSeconds: 90 * 60,
      defects: [{
        id: uuidv4(),
        title: 'Regression issue found in payroll calculation screen',
        description: 'Amount field shows incorrect value after state change',
        severity: 'Major',
        jiraPriority: 'High',
        environment: 'UAT',
        functionalArea: 'Payroll',
        reporterName: 'QA Regression',
        reporterEmail: 'qa.regression@adp.com',
        reporterRole: 'qa',
        queuedForJira: true,
        loggedAt: new Date(),
      }],
      defectCount: 1,
      verifiedStoryKeys: ['SF-1001', 'SF-1002', 'SF-1003'],
      jiraIssuesCreated: false,
      jiraIssueKeys: [],
    } as any
  );

  await CertificationSession.insertMany(sessions);
  logger.info('[Seed] Certification sessions seeded');
}

async function seedActivity(): Promise<void> {
  await Activity.deleteMany({});
  await Activity.insertMany([
    { projectId: 'ecertify', type: 'cert_complete', message: 'Team Alpha completed Enterprise certification', icon: '✅', actorName: 'Team Alpha', createdAt: new Date(Date.now() - 2 * 60 * 1000) },
    { projectId: 'ecertify', type: 'bundle_deployed', message: 'Bundle 2 deployed to PROD via Copado', icon: '🚀', actorName: 'System', createdAt: new Date(Date.now() - 18 * 60 * 1000) },
    { projectId: 'abc', type: 'jira_synced', message: 'PR #147 merged — charts module', icon: '🔀', actorName: 'Taylor Morgan', createdAt: new Date(Date.now() - 30 * 60 * 1000) },
    { projectId: 'sf1', type: 'jira_synced', message: 'UAT environment refreshed', icon: '🔄', actorName: 'System', createdAt: new Date(Date.now() - 60 * 60 * 1000) },
    { projectId: 'ecertify', type: 'defect_logged', message: 'Team Eta logged 2 defects — SBS certification', icon: '🐛', actorName: 'Team Eta', createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    { projectId: 'sf2', type: 'bundle_deployed', message: 'SF2 PROD deploy successful — clean release!', icon: '🎉', actorName: 'System', createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) },
  ]);
  logger.info('[Seed] Activity seeded');
}

async function main(): Promise<void> {
  try {
    await connectDB();
    logger.info('[Seed] Starting database seed...');

    await seedUsers();
    await seedProjects();
    await seedJiraStories();
    await seedBundles();
    await seedCertificationSessions();
    await seedActivity();

    logger.info('[Seed] ✅ Database seeded successfully!');
    logger.info('[Seed] Mock login emails for local dev:');
    logger.info('[Seed]   Main Admin: john.doe@adp.com');
    logger.info('[Seed]   Project Admin: jane.smith@adp.com');
    logger.info('[Seed]   BU Tester: tester.bu@adp.com');
  } catch (err) {
    logger.error('[Seed] Seed failed', { error: err });
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main();
