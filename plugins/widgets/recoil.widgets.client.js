goog.provide('myapplication.widget.loader');

goog.require('aurora.websocket');
goog.require('myapplication.Client');
goog.require('recoil.frp.Frp');


/**
 * @export
 */
myapplication.widget.loader = function() {};

aurora.Client.startLoader(myapplication.Client.instance);
