/* ==========================================================
   projectAccess — decides whether a user "belongs to" a project.

   Discussions are private to a project's team, so this rule is
   shared rather than re-derived per controller.
========================================================== */

const Task = require('../../models/Task');

const CHAIRPERSON = 'Chairperson';

/**
 * A user belongs to a project when any of these hold:
 *   - they submitted the request
 *   - they are named as requesting head or a point person
 *   - they have a task assigned on the project
 *   - the project belongs to their committee
 *   - they are a Chairperson (department-wide oversight)
 *
 * Name matching is case-insensitive and trimmed because
 * requestingHead/pointPersons are free-text fields, not references.
 */
async function canAccessProject(project, user) {
    if (!project || !user) return false;

    // Chairpersons oversee every project
    if (user.position === CHAIRPERSON) return true;

    const submittedBy =
        project.submittedBy && project.submittedBy._id
            ? project.submittedBy._id
            : project.submittedBy;

    if (submittedBy && String(submittedBy) === String(user.id)) {
        return true;
    }

    const name = String(user.name || '').trim().toLowerCase();

    if (name) {
        const head = String(project.requestingHead || '').trim().toLowerCase();

        if (head && head === name) return true;

        const points = (project.pointPersons || []).map((person) =>
            String(person || '').trim().toLowerCase()
        );

        if (points.includes(name)) return true;
    }

    if (
        project.committee &&
        user.committee &&
        String(project.committee).toLowerCase() ===
            String(user.committee).toLowerCase()
    ) {
        return true;
    }

    // Falls back to an actual task assignment on the project
    const assigned = await Task.exists({
        project: project._id,
        assignedMembers: user.id
    });

    return Boolean(assigned);
}

/** Filters a list of projects down to the ones the user may open. */
async function accessibleProjects(projects, user) {
    const checks = await Promise.all(
        projects.map((project) => canAccessProject(project, user))
    );

    return projects.filter((_, index) => checks[index]);
}

module.exports = { canAccessProject, accessibleProjects, CHAIRPERSON };
