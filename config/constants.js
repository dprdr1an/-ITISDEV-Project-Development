/* ==========================================================
   CATCH2T28 organisational constants — single source of truth.

   Committee lists used to be duplicated across register.html,
   project-request.html, rollout-form.html and several scripts, and had
   drifted apart (three different lists, none of them official).
   Everything now reads from here.

   The browser copy lives at public/js/constants.js and is generated
   from this same structure — see the note at the bottom of that file.
========================================================== */

/**
 * Official CATCH2T28 structure. A committee with sub-committees is a
 * grouping; the sub-committees are the assignable units.
 */
const COMMITTEE_STRUCTURE = [
    {
        name: 'Project Management',
        subCommittees: ['Administrative', 'Activities']
    },
    {
        name: 'Finance',
        subCommittees: ['Auditor', 'Treasurer']
    },
    {
        name: 'Documentation',
        subCommittees: []
    },
    {
        name: 'Integrated Marketing Communications (IMC)',
        subCommittees: ['Creatives', 'Marketing', 'Media Productions']
    },
    {
        name: 'External Relations',
        subCommittees: []
    },
    {
        name: 'Internal Relations',
        subCommittees: []
    },
    {
        name: 'Student Services',
        subCommittees: []
    },
    {
        name: 'Research & Development',
        subCommittees: ['Research', 'Development']
    },
    {
        name: 'Student Welfare',
        subCommittees: []
    },
    {
        name: 'Logistics',
        subCommittees: []
    },
    {
        name: 'Human Resources',
        subCommittees: ['Administrative', 'Activities']
    }
];

/**
 * Flat list of every selectable committee value.
 *
 * Sub-committee names repeat across parents ("Administrative" and
 * "Activities" appear under both Project Management and Human Resources),
 * so a sub-committee is qualified as "Parent — Sub" to stay unambiguous.
 * A committee with no sub-committees is selectable by its own name.
 */
function buildCommitteeOptions() {
    const options = [];

    COMMITTEE_STRUCTURE.forEach((group) => {
        if (!group.subCommittees.length) {
            options.push({ value: group.name, label: group.name, group: group.name });
            return;
        }

        group.subCommittees.forEach((sub) => {
            const value = group.name + ' — ' + sub;
            options.push({ value: value, label: sub, group: group.name });
        });
    });

    return options;
}

const COMMITTEE_OPTIONS = buildCommitteeOptions();

const COMMITTEE_VALUES = COMMITTEE_OPTIONS.map((option) => option.value);

/** Top-level committee names, for AI prompting and grouping. */
const COMMITTEE_NAMES = COMMITTEE_STRUCTURE.map((group) => group.name);

/** Positions understood by the system (mirrors the User model enum). */
const POSITIONS = ['Chairperson', 'Executive'];

/**
 * Accepts an official value, and also tolerates a bare sub-committee name
 * ("Creatives") so records created before this list was centralised still
 * resolve. Returns the canonical value, or null when unrecognised.
 */
function normaliseCommittee(value) {
    const input = String(value || '').trim();

    if (!input) return null;

    const exact = COMMITTEE_OPTIONS.find(
        (option) => option.value.toLowerCase() === input.toLowerCase()
    );

    if (exact) return exact.value;

    // Unique bare sub-committee name, e.g. "Creatives"
    const matches = COMMITTEE_OPTIONS.filter(
        (option) => option.label.toLowerCase() === input.toLowerCase()
    );

    return matches.length === 1 ? matches[0].value : null;
}

module.exports = {
    COMMITTEE_STRUCTURE,
    COMMITTEE_OPTIONS,
    COMMITTEE_VALUES,
    COMMITTEE_NAMES,
    POSITIONS,
    normaliseCommittee
};
