goog.provide('myapplication.widgets.AdminButton');

goog.require('goog.dom');
goog.require('goog.net.XhrIo');
goog.require('goog.net.cookies');


/**
 * @constructor
 * @export
 * @param {!myapplication.WidgetScope} scope
 * @implements {recoil.ui.Widget}
 */
myapplication.widgets.AdminButton = function(scope) {
    let loggedIn = goog.net.cookies.get('username');
	
	let anchorElement = goog.dom.createDom('a', {"href":"/admin"}, '');
	anchorElement.appendChild(goog.dom.createDom('i', {"class":"fas fa-cogs"}, ''));
	let emptyElement = goog.dom.createDom('span', {}, '');
	
    this.component_ = recoil.ui.ComponentWidgetHelper.elementToNoFocusControl(loggedIn ? anchorElement : emptyElement);
};

/**
 * @return {!goog.ui.Component}
 */
myapplication.widgets.AdminButton.prototype.getComponent = function() {
    return this.component_;
};


/**
 * all widgets should not allow themselves to be flatterned
 *
 */

myapplication.widgets.AdminButton.prototype.flatten = recoil.frp.struct.NO_FLATTEN;

