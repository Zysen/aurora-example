goog.provide('aurora.messages');

goog.require('recoil.ui.message');


/**
 * @type {!recoil.ui.message.Message}
 * @final
 */
aurora.messages.GROUPS = recoil.ui.message.getParamMsg('Groups');

/**
 * @type {!recoil.ui.message.Message}
 * @final
 */
aurora.messages.CHECKING_USER = recoil.ui.message.getParamMsg('Checking User Name ...');

/**
 * @type {!recoil.ui.message.Message}
 * @final
 */
aurora.messages.DUPLICATE_USER_NAME = recoil.ui.message.getParamMsg('Duplicate User Name');

/**
 * @type {!recoil.ui.message.Message}
 * @final
 */
aurora.messages.EMAIL_ADDRESS = recoil.ui.message.getParamMsg('Email Address');


/**
 * @type {!recoil.ui.message.Message}
 * @final
 */
aurora.messages.USERNAME_MUST_NOT_BE_BLANK = recoil.ui.message.getParamMsg('Username must not be blank');


/**
 * @type {!recoil.ui.message.Message}
 * @final
 */
aurora.messages.PASSWORD_MUST_NOT_BE_BLANK = recoil.ui.message.getParamMsg('Password must not be blank');


/**
 * @type {!recoil.ui.message.Message}
 * @final
 */
aurora.messages.PASSWORDS_DO_NOT_MATCH = recoil.ui.message.getParamMsg('Passwords do not match');


/**
 * @type {!recoil.ui.message.Message}
 * @final
 */
aurora.messages.RESET_PASSWORD = recoil.ui.message.getParamMsg('Reset Password');

/**
 * @type {!recoil.ui.message.Message}
 * @final
 */
aurora.messages.APPOINTMENT = recoil.ui.message.getParamMsg('Appointment');

/**
 * @type {!recoil.ui.message.Message}
 * @final
 */
aurora.messages.APPOINTMENTS = recoil.ui.message.getParamMsg('Appointments');

/**
 * @type {!recoil.ui.message.Message}
 * @final
 */
aurora.messages.VIEW_EDIT_PROFILE = recoil.ui.message.getParamMsg('View / Edit Profile');

/**
 * @type {!recoil.ui.message.Message}
 * @final
 */
aurora.messages.PROFILE = recoil.ui.message.getParamMsg('Profile');

/**
 * @type {!recoil.ui.message.Message}
 * @final
 */
aurora.messages.BUDGETS = recoil.ui.message.getParamMsg('Budgets');

/**
 * @type {!recoil.ui.message.Message}
 * @final
 */
aurora.messages.ADD = recoil.ui.message.getParamMsg('Add');

/**
 * @type {!recoil.ui.message.Message}
 * @final
 */
aurora.messages.REMOVE = recoil.ui.message.getParamMsg('Remove');

/**
 * @type {!recoil.ui.message.Message}
 * @final
 */
aurora.messages.REMOVE_USER = recoil.ui.message.getParamMsg('Remove User');
