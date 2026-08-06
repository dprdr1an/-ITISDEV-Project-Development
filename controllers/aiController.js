/* ==========================================================
   AI Assistant — thin controller over the Ollama service.
   Validation lives here; the API key never leaves the server.
========================================================== */

const { generateProposal, isConfigured } = require('../services/ollamaService');

const MAX_FIELD = 500;

/** Trims and caps a free-text field so one request can't carry an essay. */
function clean(value) {
    return String(value || '').trim().slice(0, MAX_FIELD);
}

// GET /api/ai/status — lets the UI hide the feature when unconfigured
exports.getStatus = (req, res) => {
    return res.status(200).json({
        success: true,
        enabled: isConfigured()
    });
};

// POST /api/ai/project-proposal
exports.createProposal = async (req, res) => {
    try {
        const brief = {
            projectType: clean(req.body.projectType),
            targetParticipants: clean(req.body.targetParticipants),
            studentProblem: clean(req.body.studentProblem),
            goal: clean(req.body.goal),
            estimatedParticipants: clean(req.body.estimatedParticipants),
            budget: clean(req.body.budget),
            additionalNotes: clean(req.body.additionalNotes)
        };

        const missing = ['projectType', 'targetParticipants', 'studentProblem', 'goal']
            .filter((field) => !brief[field]);

        if (missing.length) {
            return res.status(400).json({
                success: false,
                message:
                    'Please complete the project type, participants, problem and goal.'
            });
        }

        const proposal = await generateProposal(brief);

        return res.status(200).json({ success: true, data: proposal });
    } catch (error) {
        console.error('AI proposal error:', error.message);

        return res.status(error.status || 500).json({
            success: false,
            message:
                error.status
                    ? error.message
                    : 'Something went wrong generating the proposal. Please try again.'
        });
    }
};
