/* ==========================================================
   Gemini service — server-side only.

   The API key is read from process.env and never leaves the server;
   the browser talks to /api/ai/* instead.
========================================================== */

const OLLAMA_HOST =
    process.env.OLLAMA_HOST || "http://localhost:11434";

const OLLAMA_MODEL =
    process.env.OLLAMA_MODEL || "qwen3:8b";

const { COMMITTEE_STRUCTURE } = require("../config/constants");

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

function isConfigured() {
    return Boolean(process.env.OLLAMA_HOST);
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

/**
 * Calls Gemini and returns the parsed proposal.
 * Throws an Error carrying a `status` so the controller can map it.
 */
async function generateProposal(brief) {
    if (!isConfigured()) {
        const error = new Error(
            'The AI assistant is not configured on this server.'
        );
        error.status = 503;
        throw error;
    }

    const body = {
        model: OLLAMA_MODEL,
        stream: false,
        format: RESPONSE_SCHEMA,

        options: {
            temperature: 0.2,
            num_predict: 450
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

    // Abort rather than hang the request if Gemini is slow
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000);

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
        const error = new Error(
            err.name === 'AbortError'
                ? 'The AI assistant took too long to respond. Please try again.'
                : 'Could not reach the AI assistant. Please try again.'
        );
        error.status = 504;
        throw error;
    } finally {
        clearTimeout(timeout);
    }

    if (!response.ok) {
        let detail = '';

        try {
            const payload = await response.json();
            detail = (payload.error && payload.error.message) || '';
        } catch (err) {
            detail = '';
        }

        // Logged for operators; the client gets a friendly message
        console.error(
            'Gemini API error:',
            response.status,
            detail || '(no detail)'
        );

        const error = new Error(
            response.status === 429
                ? 'The AI assistant is busy right now. Please try again in a moment.'
                : 'The AI assistant could not generate a proposal. Please try again.'
        );

        error.status = 502;
        throw error;
    }

    const payload = await response.json();

    const text = payload.message?.content;

    if (!text) {
        const error = new Error(
            'The AI assistant returned an empty response. Please try again.'
        );
        error.status = 502;
        throw error;
    }

    try {
        return JSON.parse(text);
    } catch (err) {
        console.error('Gemini returned unparseable JSON:', text.slice(0, 300));

        const error = new Error(
            'The AI assistant returned an unexpected format. Please try again.'
        );
        error.status = 502;
        throw error;
    }
}

module.exports = {
    generateProposal,
    isConfigured,
    buildPrompt,
    SYSTEM_CONTEXT,
    OLLAMA_MODEL
};
