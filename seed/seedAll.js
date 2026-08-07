/* ==========================================================
   CatchIT — seedAll.js

   Inserts the development dataset. Safe to run repeatedly.

     node seed/seedAll.js              insert what is missing
     node seed/seedAll.js --no-shift   keep the authored dates as-is
     node seed/seedAll.js --dry-run    report without writing
     node seed/seedAll.js --no-files   skip placeholder file creation

   Guarantees:
     • Never deletes anything — no deleteMany, no drop, anywhere.
     • Never modifies an existing user. Users are matched by email and
       skipped if present.
     • Every collection is matched on a natural key, so re-running
       inserts nothing the second time.
     • Uses create() so the ProjectRequest and Task pre-save hooks run
       exactly as they do in the application.
========================================================== */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const connectDB = require('../config/db');

const User = require('../models/User');
const ProjectRequest = require('../models/ProjectRequest');
const Task = require('../models/Task');
const Discussion = require('../models/Discussion');
const Notification = require('../models/Notification');
const RolloutForm = require('../models/RolloutForm');
const ProjectFile = require('../models/ProjectFile');

const DIR = __dirname;
const load = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));

const ARGS = process.argv.slice(2);
const DRY = ARGS.includes('--dry-run');
const NO_SHIFT = ARGS.includes('--no-shift');
const NO_FILES = ARGS.includes('--no-files');

/* ----------------------------------------------------------
   Date rebasing

   The dataset was authored against a fixed anchor. Shifting every
   date by (today - anchor) keeps "overdue", "due soon", and
   "completed last month" meaningful whenever the seeder is run,
   instead of the whole set drifting into the past.
---------------------------------------------------------- */
const ANCHOR = new Date('2026-08-08T00:00:00.000Z');
const SHIFT_MS = NO_SHIFT ? 0 : (Date.now() - ANCHOR.getTime());
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function shiftDates(value) {
    if (typeof value === 'string' && ISO.test(value)) {
        return new Date(new Date(value).getTime() + SHIFT_MS);
    }
    if (Array.isArray(value)) return value.map(shiftDates);
    if (value && typeof value === 'object') {
        const out = {};
        for (const k of Object.keys(value)) out[k] = shiftDates(value[k]);
        return out;
    }
    return value;
}

const stats = {};
const bump = (k, n = 1) => { stats[k] = (stats[k] || 0) + n; };

function report(label, inserted, skipped, failed) {
    const pad = (n) => String(n).padStart(5);
    console.log(
        `  ${label.padEnd(16)} inserted ${pad(inserted)}   ` +
        `skipped ${pad(skipped)}` + (failed ? `   FAILED ${pad(failed)}` : '')
    );
}

async function main() {
    await connectDB();

    console.log(
        `\nCatchIT dataset seeder` +
        (DRY ? '  [DRY RUN — nothing will be written]' : '') +
        (NO_SHIFT ? '  [dates not rebased]' : '')
    );
    if (!NO_SHIFT) {
        const days = Math.round(SHIFT_MS / 86400000);
        console.log(`Dates rebased by ${days >= 0 ? '+' : ''}${days} day(s) from the authored anchor.\n`);
    } else {
        console.log('');
    }

    /* ── 1. Users ──────────────────────────────────────────
       Existing users are matched by email and left untouched.
       Only genuinely new officers are created.                */
    const executives = load('executives.json');
    let uIns = 0, uSkip = 0;

    for (const u of executives) {
        const exists = await User.findOne({ email: u.email }).lean();
        if (exists) { uSkip += 1; continue; }
        if (!DRY) {
            await User.create({
                name: u.name,
                committee: u.committee,
                position: u.position,
                email: u.email,
                password: await bcrypt.hash(u.password, 10)
            });
        }
        uIns += 1;
    }
    report('Users', uIns, uSkip, 0);
    bump('users', uIns);

    // Resolve every officer once — existing seeded users included
    const allUsers = await User.find().select('_id name email').lean();
    const userByEmail = new Map(allUsers.map((u) => [u.email.toLowerCase(), u]));

    const requireUser = (email, where) => {
        const u = userByEmail.get(String(email || '').toLowerCase());
        if (!u) throw new Error(`Unknown user "${email}" referenced by ${where}`);
        return u;
    };

    /* ── 2. Project Requests ─────────────────────────────── */
    const projects = load('projects.json');
    let pIns = 0, pSkip = 0;

    for (const raw of projects) {
        const exists = await ProjectRequest.findOne({ refNumber: raw.refNumber }).lean();
        if (exists) { pSkip += 1; continue; }

        const p = shiftDates(raw);
        const head = requireUser(raw.requestingHeadEmail, `project ${raw.refNumber}`);
        const submitter = requireUser(raw.submittedByEmail, `project ${raw.refNumber}`);

        if (!DRY) {
            // create() so the refNumber pre-save hook behaves as in the app
            await ProjectRequest.create({
                projectName: p.projectName,
                committee: p.committee,
                projectType: p.projectType,
                targetPlatform: p.targetPlatform,
                priority: p.priority,
                requestingHead: p.requestingHead,
                requestingHeadUser: head._id,
                pointPersons: p.pointPersons,
                startDate: p.startDate,
                postingDate: p.postingDate,
                eventDate: p.eventDate,
                description: p.description,
                keyMessages: p.keyMessages,
                deliverables: p.deliverables,
                referenceLinks: p.referenceLinks,
                attachments: p.attachments,
                additionalNotes: p.additionalNotes,
                status: p.status,
                submittedBy: submitter._id,
                refNumber: p.refNumber,
                createdAt: p.createdAt,
                revisions: p.revisions.map((r) => ({
                    action: r.action,
                    madeBy: r.madeBy,
                    userId: requireUser(r.userEmail, `revision on ${raw.refNumber}`)._id,
                    changes: r.changes,
                    note: r.note,
                    timestamp: r.timestamp
                }))
            });
        }
        pIns += 1;
    }
    report('Projects', pIns, pSkip, 0);
    bump('projects', pIns);

    const allProjects = await ProjectRequest.find().select('_id refNumber projectName').lean();
    const projByRef = new Map(allProjects.map((p) => [p.refNumber, p]));

    const requireProject = (ref, where) => {
        const p = projByRef.get(ref);
        if (!p) throw new Error(`Unknown project "${ref}" referenced by ${where}`);
        return p;
    };

    /* ── 3. Tasks ─────────────────────────────────────────
       Natural key: project + title.                          */
    const tasks = load('tasks.json');
    const taskIdByKey = new Map();
    let tIns = 0, tSkip = 0;

    for (const raw of tasks) {
        const proj = requireProject(raw.projectRef, `task ${raw.taskKey}`);
        const existing = await Task.findOne({ project: proj._id, title: raw.title }).select('_id').lean();

        if (existing) {
            taskIdByKey.set(raw.taskKey, existing._id);
            tSkip += 1;
            continue;
        }

        const t = shiftDates(raw);
        if (!DRY) {
            const doc = await Task.create({
                project: proj._id,
                title: t.title,
                description: t.description,
                assignedMembers: raw.assignedMemberEmails.map(
                    (e) => requireUser(e, `task ${raw.taskKey}`)._id
                ),
                deadline: t.deadline,
                priority: t.priority,
                status: t.status,
                completedAt: t.completedAt,
                createdBy: requireUser(raw.createdByEmail, `task ${raw.taskKey}`)._id,
                createdAt: t.createdAt
            });
            taskIdByKey.set(raw.taskKey, doc._id);

            // The Task pre-save hook stamps completedAt with "now"; restore the
            // authored completion date so on-time delivery stays historical.
            if (t.completedAt) {
                await Task.updateOne({ _id: doc._id }, { $set: { completedAt: t.completedAt } });
            }
        }
        tIns += 1;
    }
    report('Tasks', tIns, tSkip, 0);
    bump('tasks', tIns);

    /* ── 4. Discussions ───────────────────────────────────
       Natural key: project + author + message text.          */
    const discussions = load('discussions.json');
    let dIns = 0, dSkip = 0;

    for (const raw of discussions) {
        const proj = requireProject(raw.projectRef, 'discussion');
        const author = requireUser(raw.authorEmail, 'discussion');

        const exists = await Discussion.findOne({
            project: proj._id, author: author._id, update: raw.update
        }).lean();
        if (exists) { dSkip += 1; continue; }

        const d = shiftDates(raw);
        if (!DRY) {
            await Discussion.create({
                project: proj._id,
                author: author._id,
                update: d.update,
                comments: (d.comments || []).map((c, i) => ({
                    author: requireUser(raw.comments[i].authorEmail, 'discussion comment')._id,
                    message: c.message,
                    createdAt: c.createdAt
                })),
                createdAt: d.createdAt
            });
        }
        dIns += 1;
    }
    report('Discussions', dIns, dSkip, 0);
    bump('discussions', dIns);

    /* ── 5. Notifications ─────────────────────────────────
       Natural key: recipient + type + message.               */
    const notifications = load('notifications.json');
    let nIns = 0, nSkip = 0;

    for (const raw of notifications) {
        const recipient = requireUser(raw.recipientEmail, 'notification');

        const exists = await Notification.findOne({
            recipient: recipient._id, type: raw.type, message: raw.message
        }).lean();
        if (exists) { nSkip += 1; continue; }

        const n = shiftDates(raw);
        if (!DRY) {
            await Notification.create({
                recipient: recipient._id,
                title: n.title,
                message: n.message,
                type: n.type,
                relatedProject: raw.relatedProjectRef
                    ? requireProject(raw.relatedProjectRef, 'notification')._id
                    : null,
                relatedTask: raw.relatedTaskKey ? (taskIdByKey.get(raw.relatedTaskKey) || null) : null,
                isRead: n.isRead,
                readAt: n.readAt,
                createdAt: n.createdAt
            });
        }
        nIns += 1;
    }
    report('Notifications', nIns, nSkip, 0);
    bump('notifications', nIns);

    /* ── 6. Rollout Forms ─────────────────────────────────
       Natural key: projectName + committee.                  */
    const rollouts = load('rolloutForms.json');
    let rIns = 0, rSkip = 0;

    for (const raw of rollouts) {
        const exists = await RolloutForm.findOne({
            projectName: raw.projectName, committee: raw.committee
        }).lean();
        if (exists) { rSkip += 1; continue; }

        const r = shiftDates(raw);
        if (!DRY) {
            await RolloutForm.create({
                projectName: r.projectName,
                committee: r.committee,
                projectType: r.projectType,
                targetPlatform: r.targetPlatform,
                priority: r.priority,
                requestingHead: r.requestingHead,
                pointPersons: r.pointPersons,
                startDate: r.startDate,
                endDate: r.endDate,
                daamDeadline: r.daamDeadline,
                eventDate: r.eventDate,
                description: r.description,
                keyMessages: r.keyMessages,
                publications: r.publications,
                creativesNotes: r.creativesNotes,
                publicityPlan: r.publicityPlan,
                coordinationNotes: r.coordinationNotes,
                status: r.status,
                submittedBy: requireUser(raw.submittedByEmail, 'rollout form')._id,
                checklist: r.checklist,
                createdAt: r.createdAt,
                revisions: r.revisions.map((rev, i) => ({
                    action: rev.action,
                    madeBy: rev.madeBy,
                    userId: requireUser(raw.revisions[i].userEmail, 'rollout revision')._id,
                    changes: rev.changes,
                    note: rev.note,
                    timestamp: rev.timestamp
                }))
            });
        }
        rIns += 1;
    }
    report('Rollout Forms', rIns, rSkip, 0);
    bump('rollouts', rIns);

    /* ── 7. Project Files ─────────────────────────────────
       Natural key: storedName (unique by construction).

       A placeholder byte-file is written alongside each record so the
       repository's download route resolves instead of 404-ing. The
       schema does not require it; --no-files skips this.        */
    const files = load('files.json');
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!DRY && !NO_FILES && !fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }

    let fIns = 0, fSkip = 0;

    for (const raw of files) {
        const exists = await ProjectFile.findOne({ storedName: raw.storedName }).lean();
        if (exists) { fSkip += 1; continue; }

        const proj = requireProject(raw.projectRef, `file ${raw.fileKey}`);
        const f = shiftDates(raw);

        if (!DRY) {
            await ProjectFile.create({
                project: proj._id,
                originalName: f.originalName,
                storedName: f.storedName,
                filePath: f.filePath,
                category: f.category,
                folder: f.folder,
                mimeType: f.mimeType,
                size: f.size,
                uploadedBy: requireUser(raw.uploadedByEmail, `file ${raw.fileKey}`)._id,
                createdAt: f.createdAt
            });

            if (!NO_FILES) {
                const target = path.join(uploadsDir, f.storedName);
                if (!fs.existsSync(target)) {
                    fs.writeFileSync(
                        target,
                        `CatchIT development placeholder for ${f.originalName}\n`
                    );
                }
            }
        }
        fIns += 1;
    }
    report('Project Files', fIns, fSkip, 0);
    bump('files', fIns);

    /* ── Summary ─────────────────────────────────────────── */
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    console.log(`\n  ${'TOTAL INSERTED'.padEnd(16)} ${String(total).padStart(14)}`);

    if (DRY) console.log('\nDry run — no documents were written.');
    if (total === 0 && !DRY) console.log('\nNothing to insert; the dataset is already present.');

    console.log('\nCurrent collection sizes:');
    for (const [label, Model] of [
        ['Users', User], ['Projects', ProjectRequest], ['Tasks', Task],
        ['Discussions', Discussion], ['Notifications', Notification],
        ['Rollout Forms', RolloutForm], ['Project Files', ProjectFile]
    ]) {
        console.log(`  ${label.padEnd(16)} ${String(await Model.countDocuments()).padStart(5)}`);
    }

    await mongoose.connection.close();
    process.exit(0);
}

main().catch(async (err) => {
    console.error('\nSeeding failed:', err.message);
    try { await mongoose.connection.close(); } catch (_) {}
    process.exit(1);
});
