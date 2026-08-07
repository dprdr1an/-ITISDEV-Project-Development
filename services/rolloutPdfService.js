/* ==========================================================
   Rollout form PDF service — server-side only.

   Renders a submitted rollout form as a printable document and writes
   it into the same uploads directory the File Repository serves from,
   so the result behaves exactly like a manually uploaded file.
========================================================== */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

/* ── Layout constants ───────────────────────────────────────
   Values chosen to match the application's own visual language:
   the CatchIT orange for rules and headings, neutral greys for
   body copy and labels.                                        */
const ORANGE = '#F97316';
const GREY_900 = '#111827';
const GREY_600 = '#4B5563';
const GREY_400 = '#9CA3AF';
const GREY_200 = '#E5E7EB';

const MARGIN = 56;
const LABEL_WIDTH = 150;

/** Filesystem-safe filename that still reads naturally in the repository. */
function buildFileName(projectName) {
    const clean = String(projectName || 'Untitled Project')
        .replace(/[\\/:*?"<>|]/g, '-')   // characters no filesystem accepts
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);

    return `Rollout Form - ${clean}.pdf`;
}

function formatDate(value) {
    if (!value) return '—';

    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';

    return d.toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric'
    });
}

function textOrDash(value) {
    const text = String(value === undefined || value === null ? '' : value).trim();
    return text || '—';
}

function listOrDash(values) {
    if (!Array.isArray(values) || !values.length) return '—';
    return values.filter(Boolean).join(', ') || '—';
}

/* ── Drawing helpers ─────────────────────────────────────── */

function sectionHeading(doc, title) {
    // Keep a heading with at least a little of its content
    if (doc.y > doc.page.height - MARGIN - 90) doc.addPage();

    doc.moveDown(0.8);

    doc.fillColor(ORANGE)
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(title.toUpperCase(), MARGIN, doc.y, { characterSpacing: 0.6 });

    const y = doc.y + 4;

    doc.moveTo(MARGIN, y)
        .lineTo(doc.page.width - MARGIN, y)
        .lineWidth(1)
        .strokeColor(ORANGE)
        .stroke();

    doc.moveDown(0.7);
}

/** One label/value row. Long values wrap under their own column. */
function field(doc, label, value) {
    if (doc.y > doc.page.height - MARGIN - 50) doc.addPage();

    const top = doc.y;
    const valueX = MARGIN + LABEL_WIDTH;
    const valueWidth = doc.page.width - MARGIN - valueX;

    doc.fillColor(GREY_400)
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(label, MARGIN, top, { width: LABEL_WIDTH - 12 });

    const labelBottom = doc.y;

    doc.fillColor(GREY_900)
        .fontSize(10)
        .font('Helvetica')
        .text(textOrDash(value), valueX, top, { width: valueWidth });

    doc.y = Math.max(labelBottom, doc.y) + 6;
}

/** Free-text block that spans the full width, for longer prose. */
function block(doc, label, value) {
    if (doc.y > doc.page.height - MARGIN - 60) doc.addPage();

    doc.fillColor(GREY_400)
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(label, MARGIN, doc.y);

    doc.moveDown(0.25);

    doc.fillColor(GREY_600)
        .fontSize(10)
        .font('Helvetica')
        .text(textOrDash(value), MARGIN, doc.y, {
            width: doc.page.width - MARGIN * 2,
            align: 'left'
        });

    doc.moveDown(0.6);
}

/** Simple bordered table with a repeating header. */
function table(doc, columns, rows, emptyMessage) {
    const usable = doc.page.width - MARGIN * 2;
    const widths = columns.map((c) => Math.round(usable * c.width));

    if (!rows.length) {
        doc.fillColor(GREY_400)
            .fontSize(10)
            .font('Helvetica-Oblique')
            .text(emptyMessage, MARGIN, doc.y, { width: usable });
        doc.moveDown(0.6);
        return;
    }

    function header() {
        const top = doc.y;

        doc.rect(MARGIN, top, usable, 20).fill('#F8F8F8');

        let x = MARGIN;
        columns.forEach((col, i) => {
            doc.fillColor(GREY_600)
                .fontSize(8.5)
                .font('Helvetica-Bold')
                .text(col.label.toUpperCase(), x + 6, top + 6, {
                    width: widths[i] - 12, lineBreak: false
                });
            x += widths[i];
        });

        doc.y = top + 20;
    }

    header();

    rows.forEach((row) => {
        // Measure first so a row is never split across a page break
        const heights = columns.map((col, i) =>
            doc.fontSize(9).font('Helvetica')
                .heightOfString(textOrDash(row[col.key]), { width: widths[i] - 12 })
        );
        const rowHeight = Math.max(18, Math.max.apply(null, heights) + 10);

        if (doc.y + rowHeight > doc.page.height - MARGIN - 30) {
            doc.addPage();
            header();
        }

        const top = doc.y;
        let x = MARGIN;

        columns.forEach((col, i) => {
            doc.fillColor(GREY_900)
                .fontSize(9)
                .font('Helvetica')
                .text(textOrDash(row[col.key]), x + 6, top + 5, {
                    width: widths[i] - 12
                });
            x += widths[i];
        });

        doc.moveTo(MARGIN, top + rowHeight)
            .lineTo(MARGIN + usable, top + rowHeight)
            .lineWidth(0.5)
            .strokeColor(GREY_200)
            .stroke();

        doc.y = top + rowHeight;
    });

    doc.moveDown(0.6);
}

/** Footer stamped on every page once the content is laid out. */
function stampFooters(doc, reference) {
    const range = doc.bufferedPageRange();

    for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);

        // Writing below the bottom margin makes PDFKit start a new page,
        // which would append a blank page per footer. Drop the margin for
        // the duration of the stamp and restore it afterwards.
        const savedBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        const y = doc.page.height - MARGIN + 12;

        doc.moveTo(MARGIN, y - 10)
            .lineTo(doc.page.width - MARGIN, y - 10)
            .lineWidth(0.5)
            .strokeColor(GREY_200)
            .stroke();

        doc.fillColor(GREY_400)
            .fontSize(8)
            .font('Helvetica')
            .text('Generated automatically by CatchIT', MARGIN, y, {
                width: doc.page.width - MARGIN * 2,
                align: 'left',
                lineBreak: false
            });

        doc.fillColor(GREY_400)
            .fontSize(8)
            .text(
                `${reference}   ·   Page ${i + 1} of ${range.count}`,
                MARGIN, y,
                {
                    width: doc.page.width - MARGIN * 2,
                    align: 'right',
                    lineBreak: false
                }
            );

        doc.page.margins.bottom = savedBottom;
    }
}

/**
 * Renders a rollout form to `uploads/` and returns the metadata a
 * ProjectFile record needs.
 *
 * @param {Object} rollout  a saved RolloutForm document
 * @param {Object} options  { submitterName, projectName }
 * @returns {Promise<{originalName, storedName, filePath, size, mimeType}>}
 */
function generateRolloutPdf(rollout, options) {
    const settings = options || {};
    const projectName = settings.projectName || rollout.projectName;

    return new Promise((resolve, reject) => {
        try {
            if (!fs.existsSync(UPLOADS_DIR)) {
                fs.mkdirSync(UPLOADS_DIR, { recursive: true });
            }

            const originalName = buildFileName(projectName);

            // Same collision-proof naming multer uses for manual uploads
            const storedName =
                Date.now() + '-' + Math.round(Math.random() * 1e9) + '.pdf';

            const absolutePath = path.join(UPLOADS_DIR, storedName);
            const relativePath = path.join('uploads', storedName);

            const doc = new PDFDocument({
                size: 'LETTER',
                margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
                bufferPages: true,     // needed to stamp "Page x of y"
                info: {
                    Title: originalName.replace(/\.pdf$/, ''),
                    Author: settings.submitterName || 'CatchIT',
                    Subject: 'IMC Rollout Form',
                    Creator: 'CatchIT — Integrated Task and Rollout Management System'
                }
            });

            const stream = fs.createWriteStream(absolutePath);

            stream.on('error', reject);
            stream.on('finish', () => {
                try {
                    resolve({
                        originalName,
                        storedName,
                        filePath: relativePath,
                        size: fs.statSync(absolutePath).size,
                        mimeType: 'application/pdf'
                    });
                } catch (err) {
                    reject(err);
                }
            });

            doc.pipe(stream);

            /* ── Header ── */
            doc.fillColor(GREY_400)
                .fontSize(9)
                .font('Helvetica-Bold')
                .text('CATCH2T28  ·  INTEGRATED MARKETING COMMUNICATIONS',
                    MARGIN, MARGIN, { characterSpacing: 0.8 });

            doc.moveDown(0.4);

            doc.fillColor(GREY_900)
                .fontSize(20)
                .font('Helvetica-Bold')
                .text('IMC Rollout Form', MARGIN, doc.y);

            doc.moveDown(0.2);

            doc.fillColor(ORANGE)
                .fontSize(13)
                .font('Helvetica-Bold')
                .text(textOrDash(projectName), MARGIN, doc.y);

            doc.moveDown(0.4);

            doc.fillColor(GREY_600)
                .fontSize(9)
                .font('Helvetica')
                .text(
                    'Status: ' + textOrDash(rollout.status) +
                    '     Date Submitted: ' + formatDate(rollout.createdAt || new Date()) +
                    (settings.submitterName
                        ? '     Submitted by: ' + settings.submitterName
                        : ''),
                    MARGIN, doc.y
                );

            const ruleY = doc.y + 8;
            doc.moveTo(MARGIN, ruleY)
                .lineTo(doc.page.width - MARGIN, ruleY)
                .lineWidth(2)
                .strokeColor(ORANGE)
                .stroke();

            doc.y = ruleY + 10;

            /* ── Project details ── */
            sectionHeading(doc, 'Project Details');
            field(doc, 'Project Name', projectName);
            field(doc, 'Event Date', formatDate(rollout.eventDate));
            field(doc, 'Committee', rollout.committee);
            field(doc, 'Project Type', rollout.projectType);
            field(doc, 'Target Platform', rollout.targetPlatform);
            field(doc, 'Priority', rollout.priority);
            field(doc, 'Requesting Head', rollout.requestingHead);
            field(doc, 'Point Person(s)', listOrDash(rollout.pointPersons));

            /* ── Schedule ── */
            sectionHeading(doc, 'Schedule');
            field(doc, 'Start Date', formatDate(rollout.startDate));
            field(doc, 'End Date', formatDate(rollout.endDate));
            field(doc, 'DAAM Deadline', formatDate(rollout.daamDeadline));
            field(doc, 'Event Date', formatDate(rollout.eventDate));

            /* ── Objectives ── */
            sectionHeading(doc, 'Objectives and Key Messages');
            block(doc, 'Description / Objectives', rollout.description);
            block(doc, 'Key Messages', rollout.keyMessages);

            /* ── Publication plan ── */
            sectionHeading(doc, 'Publication Plan');
            table(doc, [
                { key: 'title', label: 'Title', width: 0.24 },
                { key: 'materialType', label: 'Material', width: 0.16 },
                { key: 'postingDate', label: 'Posting Date', width: 0.16 },
                { key: 'postingTime', label: 'Time', width: 0.10 },
                { key: 'assignedTo', label: 'Assigned To', width: 0.20 },
                { key: 'status', label: 'Status', width: 0.14 }
            ], (rollout.publications || []).map((p) => ({
                title: p.title,
                materialType: p.materialType,
                postingDate: formatDate(p.postingDate),
                postingTime: p.postingTime,
                assignedTo: p.assignedTo,
                status: p.status
            })), 'No publications were listed on this rollout.');

            block(doc, 'Creatives Notes', rollout.creativesNotes);

            /* ── Publicity plan ── */
            sectionHeading(doc, 'Publicity Plan and Logistics');
            table(doc, [
                { key: 'date', label: 'Date', width: 0.22 },
                { key: 'activity', label: 'Activity', width: 0.50 },
                { key: 'personResponsible', label: 'Responsible', width: 0.28 }
            ], (rollout.publicityPlan || []).map((p) => ({
                date: formatDate(p.date),
                activity: p.activity,
                personResponsible: p.personResponsible
            })), 'No publicity activities were listed on this rollout.');

            block(doc, 'Coordination Notes', rollout.coordinationNotes);

            /* ── Manpower ── */
            sectionHeading(doc, 'Manpower');
            field(doc, 'Requesting Head', rollout.requestingHead);
            field(doc, 'Point Person(s)', listOrDash(rollout.pointPersons));
            field(doc, 'Publication Assignees',
                listOrDash(
                    Array.from(new Set(
                        (rollout.publications || [])
                            .map((p) => p.assignedTo)
                            .filter(Boolean)
                    ))
                ));

            /* ── Completion checklist ── */
            sectionHeading(doc, 'Completion Checklist');

            if ((rollout.checklist || []).length) {
                rollout.checklist.forEach((item) => {
                    if (doc.y > doc.page.height - MARGIN - 40) doc.addPage();

                    doc.fillColor(GREY_900)
                        .fontSize(10)
                        .font('Helvetica')
                        .text('•  ' + item, MARGIN + 4, doc.y, {
                            width: doc.page.width - MARGIN * 2 - 4
                        });

                    doc.moveDown(0.15);
                });
                doc.moveDown(0.5);
            } else {
                doc.fillColor(GREY_400)
                    .fontSize(10)
                    .font('Helvetica-Oblique')
                    .text('No checklist items were marked complete.', MARGIN, doc.y);
                doc.moveDown(0.6);
            }

            /* ── Approval ── */
            sectionHeading(doc, 'Approval');
            field(doc, 'Approval Status', rollout.status);
            field(doc, 'Date Submitted', formatDate(rollout.createdAt || new Date()));
            field(doc, 'Submitted By', settings.submitterName);

            const last = (rollout.revisions || [])[(rollout.revisions || []).length - 1];
            if (last) {
                field(doc, 'Latest Action',
                    last.action + (last.madeBy ? ' — ' + last.madeBy : ''));
            }

            stampFooters(doc, originalName.replace(/\.pdf$/, ''));

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = { generateRolloutPdf, buildFileName };
