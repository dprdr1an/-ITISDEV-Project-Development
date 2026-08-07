/* ==========================================================
   Ollama service — server-side only.

   The host and model are read from process.env and never leave the
   server; the browser talks to /api/ai/* instead.

   Reliability model: a single user click may cost more than one call to
   Ollama. Transient failures (truncated output, empty message, a model
   still loading) are retried internally, so the user only ever sees an
   error once every attempt has failed.
========================================================== */

const OLLAMA_HOST =
    process.env.OLLAMA_HOST || "http://localhost:11434";

const OLLAMA_MODEL =
    process.env.OLLAMA_MODEL || "qwen2.5:7b";

const { COMMITTEE_STRUCTURE } = require("../config/constants");

/* ── Tuning ─────────────────────────────────────────────────
   MAX_ATTEMPTS  one automatic retry, so two calls at most.
   REQUEST_TIMEOUT_MS  per attempt, unchanged from the original.
   NUM_PREDICT   a schema-conforming proposal serializes to roughly
                 700 tokens. The previous cap of 450 truncated the
                 response mid-object, which is what surfaced to users
                 as "returned an unexpected format" — the JSON was
                 never malformed by the model, it was cut off.
─────────────────────────────────────────────────────────── */
const MAX_ATTEMPTS = 2;
const REQUEST_TIMEOUT_MS = 180000;
const NUM_PREDICT = 1400;

/**
 * Ollama gained JSON-Schema structured output in v0.5. Older builds only
 * accept format: "json". We start with the schema and, if a server
 * rejects it, fall back for the remainder of the process lifetime.
 */
let schemaFormatSupported = true;

/** Renders the official structure into the prompt from one source. */
function committeeReference() {
    return COMMITTEE_STRUCTURE.map((group) => {
        if (!group.subCommittees.length) return '- ' + group.name;

        return (
            '- ' +
            group.name +
            '\n' +
            group.subCommittees.map((sub) => '    - ' + sub).join('\n')
        );
    }).join('\n');
}

const SYSTEM_CONTEXT = `You are the AI Project Planning Assistant for the DLSU College of Computer Studies Batch Government CATCH2T28.

Your role is to help Executive Officers brainstorm realistic, creative, and feasible student organization projects.

TERMINOLOGY — use these naturally and never deviate:
- First-year students are called "Frosh". Never write "Freshmen" or "Freshman".
- Officers are called Executive Officers, or simply Executives.
- Committee leaders are called Chairpersons.
- The organization is a Batch Government, not a company.

Avoid corporate language (no "synergy", "leverage", "stakeholders", "KPIs", "deliverables-driven", "value proposition"). Write the way student leaders actually speak.

OFFICIAL COMMITTEES — you may only recommend committees from this list:
${committeeReference()}

Only recommend the committees that are genuinely necessary for the project. Do NOT list every committee. Two to four is typical.

REFERENCE PROJECTS (for inspiration on tone and scope only — never copy them):
- "General Assembly" — batch engagement, announcements, community building.
- "LeadWare: Upgrading Your Officer OS" — leadership seminar, Executive Officer development, team management.
- "LRT (Light Reboot Transit)" — academic support, reviewer sharing, student mentors, helping students transition back after Independent Learning Week, student welfare.

Generate similarly meaningful, student-centered ideas. Be concise, practical and implementation-ready. Prefer concrete specifics over vague ambition.

Keep responses concise.

- Project title: under 10 words.
- Elevator pitch: 1 sentence.
- Project description: maximum 80 words.
- Objectives: exactly 3 bullet points.
- Committee recommendations: maximum 4 committees.
- Deliverables: maximum 4 items.

Return ONLY valid JSON.

Recommend only the committees that are genuinely needed.

Do not recommend Documentations unless the project requires document-making. Documentations is not meedia coverage, it is paperwork.

Do not recommend every committee.

Most projects only need 2–4 committees.`;

/**
 * Shape the model must return. Asking for JSON directly is what lets the
 * client populate form fields rather than parsing prose.
 */
const RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        projectTitle: { type: 'string' },
        elevatorPitch: { type: 'string' },
        projectDescription: { type: 'string' },
        studentProblem: { type: 'string' },
        objectives: { type: 'array', items: { type: 'string' } },
        targetParticipants: { type: 'string' },
        recommendedCommittees: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    committee: { type: 'string' },
                    reason: { type: 'string' }
                },
                required: ['committee', 'reason']
            }
        },
        estimatedScale: { type: 'string' },
        suggestedDeliverables: { type: 'array', items: { type: 'string' } },
        suggestedRolloutMaterials: { type: 'array', items: { type: 'string' } },
        whyItFits: { type: 'string' }
    },
    required: [
        'projectTitle',
        'elevatorPitch',
        'projectDescription',
        'studentProblem',
        'objectives',
        'targetParticipants',
        'recommendedCommittees',
        'estimatedScale',
        'suggestedDeliverables',
        'suggestedRolloutMaterials',
        'whyItFits'
    ]
};

/** Fields the client cannot render a useful preview without. */
const ESSENTIAL_FIELDS = ['projectTitle', 'projectDescription'];

/** Schema fields that must end up as arrays of strings. */
const ARRAY_FIELDS = [
    'objectives',
    'suggestedDeliverables',
    'suggestedRolloutMaterials'
];

function isConfigured() {
    return Boolean(process.env.OLLAMA_HOST);
}

/* ── Logging ────────────────────────────────────────────────
   Server-side only. Every line is prefixed so AI activity can be
   grepped out of the application log; none of it reaches the client.
─────────────────────────────────────────────────────────── */
function log(message) {
    console.log('[ai] ' + message);
}

function logError(message) {
    console.error('[ai] ' + message);
}

/** Builds an Error carrying the HTTP status the controller should return. */
function fail(message, status, retryable) {
    const error = new Error(message);
    error.status = status;
    error.retryable = Boolean(retryable);
    return error;
}

/** Builds the user-facing brief from the modal's answers. */
function buildPrompt(brief) {
    const lines = [
        'Draft a CATCH2T28 project proposal from this brief.',
        '',
        'Project / event type: ' + brief.projectType,
        'Target participants: ' + brief.targetParticipants,
        'Student problem to solve: ' + brief.studentProblem,
        'Goal / objective: ' + brief.goal
    ];

    if (brief.estimatedParticipants) {
        lines.push('Estimated participants: ' + brief.estimatedParticipants);
    }

    if (brief.budget) {
        lines.push('Budget: ' + brief.budget);
    }

    if (brief.additionalNotes) {
        lines.push('Additional notes: ' + brief.additionalNotes);
    }

    lines.push(
        '',
        'Return ONLY valid JSON matching the required schema. Do not use markdown. Do not wrap the JSON in ``` blocks. Do not include explanations before or after the JSON.'
    );

    return lines.join('\n');
}

/* ── JSON recovery ──────────────────────────────────────────
   Each step is a safe, non-inventive transformation: it either
   removes wrapping the model added, or it fails. No step supplies
   content the model did not produce.
─────────────────────────────────────────────────────────── */

/** Removes a ```json … ``` (or bare ``` … ```) wrapper if present. */
function stripCodeFences(text) {
    const fenced = text.match(/^\s*```(?:json)?\s*\r?\n([\s\S]*?)\r?\n?\s*```\s*$/i);
    return fenced ? fenced[1].trim() : text;
}

/**
 * Returns the outermost {...} span, discarding any prose the model may
 * have written around it. Brace counting is string-aware so a brace
 * inside a value does not end the span early.
 */
function extractJsonObject(text) {
    const start = text.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
        const ch = text[i];

        if (inString) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '"') inString = false;
            continue;
        }

        if (ch === '"') inString = true;
        else if (ch === '{') depth++;
        else if (ch === '}' && --depth === 0) return text.slice(start, i + 1);
    }

    return null; // unbalanced — the response was truncated
}

/**
 * Parses the model's text into an object, applying only reversible
 * cleanup. Returns null when the text cannot be recovered, so the
 * caller can retry rather than guess.
 */
function parseProposal(rawText) {
    const text = String(rawText).trim();

    const candidates = [];
    const unfenced = stripCodeFences(text);

    candidates.push(unfenced);

    // Prose before or after the object is common when a model ignores
    // the "JSON only" instruction; isolate the object and try again.
    const extracted = extractJsonObject(unfenced);
    if (extracted && extracted !== unfenced) candidates.push(extracted);

    // Trailing commas are the one malformation worth repairing: it is a
    // purely syntactic fix that cannot alter any value.
    const decommaed = (extracted || unfenced).replace(/,\s*([}\]])/g, '$1');
    if (decommaed !== (extracted || unfenced)) candidates.push(decommaed);

    for (let i = 0; i < candidates.length; i++) {
        try {
            const parsed = JSON.parse(candidates[i]);

            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                if (i > 0) log(`recovered JSON using cleanup step ${i}`);
                return parsed;
            }

            logError('parsed value was not a JSON object');
            return null;
        } catch (err) {
            // try the next candidate
        }
    }

    return null;
}

/**
 * Normalizes shapes the client depends on, without inventing content.
 * A field the model omitted stays omitted; only wrapping and stray
 * entries are corrected. Returns null when an essential field is
 * missing, so the caller retries instead of rendering a blank preview.
 */
function validateProposal(proposal) {
    const missing = ESSENTIAL_FIELDS.filter(
        (f) => typeof proposal[f] !== 'string' || !proposal[f].trim()
    );

    if (missing.length) {
        logError('response missing essential field(s): ' + missing.join(', '));
        return null;
    }

    ARRAY_FIELDS.forEach((field) => {
        const value = proposal[field];

        if (value === undefined || value === null) return;

        if (Array.isArray(value)) {
            // Drop entries that are not usable strings rather than coercing them
            proposal[field] = value
                .filter((v) => typeof v === 'string' && v.trim())
                .map((v) => v.trim());
            return;
        }

        if (typeof value === 'string' && value.trim()) {
            // A single item returned unwrapped — wrapping is not fabrication
            log(`normalized "${field}" from string to single-item array`);
            proposal[field] = [value.trim()];
            return;
        }

        log(`dropped unusable "${field}" of type ${typeof value}`);
        delete proposal[field];
    });

    if (proposal.recommendedCommittees !== undefined) {
        if (Array.isArray(proposal.recommendedCommittees)) {
            proposal.recommendedCommittees = proposal.recommendedCommittees
                .filter((c) => c && typeof c === 'object' && typeof c.committee === 'string' && c.committee.trim())
                .map((c) => ({
                    committee: c.committee.trim(),
                    reason: typeof c.reason === 'string' ? c.reason.trim() : ''
                }));
        } else {
            log('dropped unusable "recommendedCommittees"');
            delete proposal.recommendedCommittees;
        }
    }

    const returned = RESPONSE_SCHEMA.required.filter((f) => proposal[f] !== undefined);

    if (returned.length < RESPONSE_SCHEMA.required.length) {
        // Not fatal: the preview renders what is present and the officer
        // edits the rest. Logged so gaps are visible during tuning.
        const absent = RESPONSE_SCHEMA.required.filter((f) => proposal[f] === undefined);
        log('response omitted optional-to-render field(s): ' + absent.join(', '));
    }

    return proposal;
}

/* ── Single Ollama call ─────────────────────────────────────
   One attempt: build the body, post it, validate the envelope, and
   return the message text. Every retry path goes through here, so the
   fetch and its timeout handling exist in exactly one place.
─────────────────────────────────────────────────────────── */
async function requestCompletion(brief, attempt) {
    const body = {
        model: OLLAMA_MODEL,
        stream: false,
        // Schema when the server supports it, plain JSON mode otherwise
        format: schemaFormatSupported ? RESPONSE_SCHEMA : 'json',

        options: {
            // Low temperature keeps the structure stable. No fixed seed:
            // "Generate Again" must be able to produce a different idea.
            temperature: 0.2,
            top_p: 0.9,
            num_predict: NUM_PREDICT
        },

        messages: [
            {
                role: "system",
                content: SYSTEM_CONTEXT
            },
            {
                role: "user",
                content: buildPrompt(brief)
            }
        ]
    };

    // Abort rather than hang the request if Ollama is slow. The signal
    // stays armed until the body has been read, not just the headers.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const startedAt = Date.now();

    try {
        let response;

        try {
            response = await fetch(
                `${OLLAMA_HOST}/api/chat`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(body),
                    signal: controller.signal
                }
            );
        } catch (err) {
            if (err.name === 'AbortError') {
                logError(`attempt ${attempt}: timed out after ${REQUEST_TIMEOUT_MS}ms`);
                // Not retried: a second 180s wait would strand the user
                throw fail(
                    'The AI assistant took too long to respond. Please try again.',
                    504,
                    false
                );
            }

            logError(`attempt ${attempt}: cannot reach Ollama at ${OLLAMA_HOST} — ${err.message}`);
            throw fail(
                'Could not reach the AI assistant. Please try again.',
                504,
                true
            );
        }

        if (!response.ok) {
            let detail = '';

            try {
                const payload = await response.json();
                detail = (payload && payload.error && (payload.error.message || payload.error)) || '';
            } catch (err) {
                detail = '';
            }

            logError(
                `attempt ${attempt}: Ollama responded ${response.status} — ` +
                (detail || '(no detail)')
            );

            // An older Ollama rejects a JSON-Schema `format`. Drop to plain
            // JSON mode and let the retry succeed instead of failing.
            if (response.status === 400 && schemaFormatSupported) {
                schemaFormatSupported = false;
                log('server rejected JSON-Schema format; falling back to format:"json"');
                throw fail(
                    'The AI assistant could not generate a proposal. Please try again.',
                    502,
                    true
                );
            }

            throw fail(
                response.status === 429
                    ? 'The AI assistant is busy right now. Please try again in a moment.'
                    : 'The AI assistant could not generate a proposal. Please try again.',
                502,
                response.status === 429 || response.status >= 500
            );
        }

        let payload;

        try {
            payload = await response.json();
        } catch (err) {
            logError(`attempt ${attempt}: response body was not JSON — ${err.message}`);
            throw fail(
                'The AI assistant returned an unexpected format. Please try again.',
                502,
                true
            );
        }

        const elapsed = Date.now() - startedAt;

        // Envelope validation, checked step by step so the log says which
        // part was missing rather than just "empty response".
        if (!payload || typeof payload !== 'object') {
            logError(`attempt ${attempt}: payload missing or not an object (${elapsed}ms)`);
            throw fail('The AI assistant returned an empty response. Please try again.', 502, true);
        }

        if (!payload.message || typeof payload.message !== 'object') {
            logError(
                `attempt ${attempt}: payload.message missing (${elapsed}ms)` +
                (payload.error ? ` — server said: ${payload.error}` : '')
            );
            throw fail('The AI assistant returned an empty response. Please try again.', 502, true);
        }

        if (typeof payload.message.content !== 'string') {
            logError(`attempt ${attempt}: payload.message.content missing or not a string (${elapsed}ms)`);
            throw fail('The AI assistant returned an empty response. Please try again.', 502, true);
        }

        if (!payload.message.content.trim()) {
            logError(`attempt ${attempt}: payload.message.content was blank (${elapsed}ms)`);
            throw fail('The AI assistant returned an empty response. Please try again.', 502, true);
        }

        // done_reason "length" means num_predict cut the model off, which
        // is the usual cause of a half-finished JSON object.
        if (payload.done_reason === 'length') {
            logError(
                `attempt ${attempt}: output truncated at num_predict=${NUM_PREDICT} ` +
                `(${payload.message.content.length} chars, ${elapsed}ms)`
            );
        }

        log(
            `attempt ${attempt}: ${response.status} in ${elapsed}ms, ` +
            `${payload.message.content.length} chars` +
            (payload.eval_count ? `, ${payload.eval_count} tokens` : '')
        );

        return payload.message.content;
    } finally {
        // Cleared on every path, including a thrown error
        clearTimeout(timeout);
    }
}

/**
 * Calls Ollama and returns the parsed proposal.
 * Throws an Error carrying a `status` so the controller can map it.
 *
 * Retries once on transient failures — empty message, unparseable or
 * truncated JSON, a 5xx, or a dropped connection. The retry is silent:
 * the caller either receives a proposal or the last error.
 */
async function generateProposal(brief) {
    if (!isConfigured()) {
        logError('generateProposal called while OLLAMA_HOST is unset');
        throw fail('The AI assistant is not configured on this server.', 503, false);
    }

    log(`request started — model ${OLLAMA_MODEL}, type "${brief.projectType}"`);

    const overallStart = Date.now();
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (attempt > 1) log(`retry ${attempt - 1}/${MAX_ATTEMPTS - 1}`);

        let text;

        try {
            text = await requestCompletion(brief, attempt);
        } catch (err) {
            lastError = err;

            if (err.retryable && attempt < MAX_ATTEMPTS) continue;
            break;
        }

        const parsed = parseProposal(text);

        if (!parsed) {
            logError(
                `attempt ${attempt}: could not parse JSON — first 300 chars: ` +
                text.trim().slice(0, 300)
            );

            lastError = fail(
                'The AI assistant returned an unexpected format. Please try again.',
                502,
                true
            );

            if (attempt < MAX_ATTEMPTS) continue;
            break;
        }

        const validated = validateProposal(parsed);

        if (!validated) {
            lastError = fail(
                'The AI assistant returned an incomplete proposal. Please try again.',
                502,
                true
            );

            if (attempt < MAX_ATTEMPTS) continue;
            break;
        }

        log(
            `proposal ready after ${attempt} attempt(s) in ` +
            `${Date.now() - overallStart}ms — "${validated.projectTitle}"`
        );

        return validated;
    }

    logError(
        `all ${MAX_ATTEMPTS} attempt(s) failed in ${Date.now() - overallStart}ms — ` +
        (lastError ? lastError.message : 'unknown reason')
    );

    throw lastError || fail(
        'The AI assistant could not generate a proposal. Please try again.',
        502,
        false
    );
}

module.exports = {
    generateProposal,
    isConfigured,
    buildPrompt,
    SYSTEM_CONTEXT,
    OLLAMA_MODEL
};