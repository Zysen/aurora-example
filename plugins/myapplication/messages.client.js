goog.provide('myapplication.messages');

goog.require('recoil.ui.message');


/**
 * @type {!recoil.ui.message.Message}
 * @final
 */
myapplication.messages.USERNAME = recoil.ui.message.getParamMsg('Username');


/**
 * @type {!recoil.ui.message.Message}
 * @final
 */
myapplication.messages.PASSWORD = recoil.ui.message.getParamMsg('Password');

/**
 * @type {!recoil.ui.message.Message}
 * @final
 */
myapplication.messages.RESET_PASSWORD = recoil.ui.message.getParamMsg('Reset Password');

/**
 * @type {!recoil.ui.message.Message}
 * @final
 */
myapplication.messages.NEW_PASSWORD = recoil.ui.message.getParamMsg('New Password');


/**
 * @type {!recoil.ui.message.Message}
 * @final
 */
myapplication.messages.CONFIRM_PASSWORD = recoil.ui.message.getParamMsg('Confirm Password');


/**
 * @type {!recoil.ui.message.Message}
 * @final
 */
myapplication.messages.PASSWORD_STRENGTH = recoil.ui.message.getParamMsg('Password Strength');


/**
 * @type {!recoil.ui.message.Message}
 * @final
 */
myapplication.messages.LOGIN = recoil.ui.message.getParamMsg('Login');


/**
 * @type {!recoil.ui.message.Message}
 * @final
 */
myapplication.messages.SIGNUP = recoil.ui.message.getParamMsg('Signup');

/**
 * @type {!recoil.ui.message.Message}
 * @final
 */
myapplication.messages.FORGOT_PASSWORD = recoil.ui.message.getParamMsg('Forgot Password');

/**
 * @type {!recoil.ui.message.Message}
 * @final
 */
myapplication.messages.REMEMBER_ME = recoil.ui.message.getParamMsg('Remember Me');


/**
 * @type {!recoil.ui.message.Message}
 * @final
 */
myapplication.messages.LOGGING_IN = recoil.ui.message.getParamMsg('Logging In...');
