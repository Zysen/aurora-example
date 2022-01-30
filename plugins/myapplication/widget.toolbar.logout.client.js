goog.provide('myapplication.widgets.LogoutButton');

goog.require('goog.dom');
goog.require('goog.net.XhrIo');
goog.require('goog.net.cookies');


/**
 * @constructor
 * @export
 * @param {!myapplication.WidgetScope} scope
 * @implements {recoil.ui.Widget}
 */
myapplication.widgets.LogoutButton = function(scope) {
    let loggedIn = goog.net.cookies.get('username');
	
	
	let anchorElement = goog.dom.createDom('a', {"href":"/logout"}, '');
	anchorElement.appendChild(goog.dom.createDom('i', {"class":"fas fa-sign-out-alt"}, ''));
	let emptyElement = goog.dom.createDom('span', {}, '');
	
    this.component_ = recoil.ui.ComponentWidgetHelper.elementToNoFocusControl(loggedIn ? anchorElement : emptyElement);
};

/**
 * @return {!goog.ui.Component}
 */
myapplication.widgets.LogoutButton.prototype.getComponent = function() {
    return this.component_;
};


/**
 * all widgets should not allow themselves to be flatterned
 *
 */

myapplication.widgets.LogoutButton.prototype.flatten = recoil.frp.struct.NO_FLATTEN;

