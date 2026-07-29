/* ==========================================================
   Authentication & role-based authorization

   Identity comes from the server-side session established at login.
   The client's localStorage copy drives the UI only — it is never
   trusted for authorization decisions.
========================================================== */

const ROLES = {
    CHAIRPERSON: 'Chairperson',
    EXECUTIVE: 'Executive'
};

/**
 * Rejects the request unless a valid session exists.
 * On success, `req.currentUser` holds the signed-in user.
 */
function requireAuth(req, res, next) {
    const sessionUser = req.session && req.session.user;

    if (!sessionUser || !sessionUser.id) {
        return res.status(401).json({
            success: false,
            message: 'You must be signed in to perform this action.'
        });
    }

    req.currentUser = sessionUser;
    return next();
}

/**
 * Restricts a route to one or more positions.
 * Always runs requireAuth first, so it can be used on its own.
 *
 *   router.post('/', requireRole('Chairperson'), handler)
 */
function requireRole(...allowed) {
    return function (req, res, next) {
        requireAuth(req, res, function () {
            if (!allowed.includes(req.currentUser.position)) {
                return res.status(403).json({
                    success: false,
                    message:
                        'Your role does not have permission to perform this action.'
                });
            }

            return next();
        });
    };
}

/**
 * Allows the action when the signed-in user owns the resource
 * (`req.params[param]` matches their id) or holds one of the listed roles.
 * Used so a user can edit their own profile while chairpersons can help.
 */
function requireSelfOrRole(param, ...allowed) {
    return function (req, res, next) {
        requireAuth(req, res, function () {
            const isSelf =
                String(req.params[param]) === String(req.currentUser.id);

            if (isSelf || allowed.includes(req.currentUser.position)) {
                return next();
            }

            return res.status(403).json({
                success: false,
                message: 'You can only modify your own profile.'
            });
        });
    };
}

module.exports = {
    ROLES,
    requireAuth,
    requireRole,
    requireSelfOrRole
};
