goog.provide('myapplication.widgets.ProfileLoginButton');

goog.require('goog.dom');
goog.require('goog.net.XhrIo');
goog.require('goog.net.cookies');


/**
 * @constructor
 * @export
 * @param {!myapplication.WidgetScope} scope
 * @implements {recoil.ui.Widget}
 */
myapplication.widgets.ProfileLoginButton = function(scope) {
    let loggedIn = goog.net.cookies.get('username');
	
	
	let profileElement = goog.dom.createDom('a', {"href":"/profile"}, '');
	profileElement.appendChild(goog.dom.createDom('i', {"class":"fas fa-user-circle"}, ''));
	let loginElement = goog.dom.createDom('a', {"href":"/login"}, '');
	loginElement.appendChild(goog.dom.createDom('i', {"class":"fas fa-user-circle"}, ''));
	
    this.component_ = recoil.ui.ComponentWidgetHelper.elementToNoFocusControl(loggedIn ? profileElement : loginElement);
};

/**
 * @return {!goog.ui.Component}
 */
myapplication.widgets.ProfileLoginButton.prototype.getComponent = function() {
    return this.component_;
};


/**
 * all widgets should not allow themselves to be flatterned
 *
 */

myapplication.widgets.ProfileLoginButton.prototype.flatten = recoil.frp.struct.NO_FLATTEN;

