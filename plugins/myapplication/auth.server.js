goog.provide('budget.auth.Server');
goog.provide('budget.auth.instance');

goog.require('aurora.auth.Auth');
goog.require('aurora.auth.instance');
goog.require('aurora.db.Authenticator');
goog.require('aurora.http');
goog.require('aurora.template');
goog.require('budget.Server');

/**
 * @constructor
 * @export
 */
budget.auth.Server = function() {
    var inst = aurora.auth.instance;
    var qs = require('querystring');

    // for backwards compatablity /resources/images is just images
    aurora.http.addPreRequestCallback(/^\/resources\/(theme|images)\//, function(state) {
        state.outUrl = state.outUrl.substring(10);
        return undefined;
    });

    /**
     * @param {string} cookies
     * @return {{token:string, seriesId:string}}
     */
    function extractSession(cookies) {
        var info = aurora.auth.Auth.getSessionFromCookies(cookies);
        return info ? info : {token: '', seriesId: ''};
    }

};
/**
 * @export
 */
budget.auth.instance = new budget.auth.Server();
