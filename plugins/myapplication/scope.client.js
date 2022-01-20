goog.provide('budget.WidgetScope');

goog.require('aurora.WidgetScope');
goog.require('aurora.db.Comms');

/**
 * @extends {aurora.WidgetScope}
 * @param {!recoil.frp.Frp} frp
 * @param {!recoil.db.Database} db
 * @param {!aurora.db.Comms} comms
 * @constructor
 */
budget.WidgetScope = function(frp, db, comms) {
    aurora.WidgetScope.call(this, frp, db);
    this.comms_ = comms;
};
goog.inherits(budget.WidgetScope, aurora.WidgetScope);



