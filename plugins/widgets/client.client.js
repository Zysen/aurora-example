goog.provide('myapplication.Client');


goog.require('aurora.Client');
goog.require('aurora.db.Comms');
goog.require('aurora.db.PermDatabase');
goog.require('aurora.db.Schema');
goog.require('myapplication.WidgetScope');
goog.require('recoil.db.ChangeDb');
goog.require('recoil.db.ReadWriteDatabase');


/**
 * @export
 * @constructor
 * @extends {aurora.Client}
 */
myapplication.Client = function() {
    let schema = new aurora.db.Schema();
    let db = new recoil.db.ChangeDb(schema);
    let comms = new aurora.db.Comms(db, schema, this);


    let database = new aurora.db.PermDatabase(new recoil.db.ReadWriteDatabase(aurora.recoil.frp, comms));

    let scope = new myapplication.WidgetScope(aurora.recoil.frp, database, comms);
    let frp = scope.getFrp();
    this.actionErrorsE_ = frp.createE();
    let me = this;
    comms.addActionErrorListener(frp.accessTransFunc(function(error) {
        me.actionErrorsE_.set(error);
    }, this.actionErrorsE_));
	
    aurora.Client.call(this, scope, function() {
        document.getElementById('aurora-loading').style.display = 'none';
        document.getElementById('content').style.display = '';
    });
};
goog.inherits(myapplication.Client, aurora.Client);

/**
 * @return {!recoil.frp.Behaviour}
 */
myapplication.Client.prototype.getActionErrorsE = function() {
    return this.actionErrorsE_;
};

/**
 * @final
 * @type {!myapplication.Client}
 */
myapplication.Client.instance = new myapplication.Client();


/**
 * @return {!myapplication.WidgetScope}
 */
myapplication.Client.scope = function() {
    return/** @type {!myapplication.WidgetScope} */(myapplication.Client.instance.scope());
};


/**
 * @final
 * @type {Object<string,function(recoil.structs.table.ColumnKey,string,Object):recoil.ui.widgets.table.Column>}
 */
myapplication.Client.typeFactories = (function() {
    let factories = {};
    return goog.object.extend(aurora.Client.typeFactories, factories);
})();


/**
 * @const
 */
myapplication.Client.VERSION = '1';

/**
 * @param {boolean} val
 */
myapplication.Client.setOverride = function(val) {
    aurora.permissions.setOverride(myapplication.Client.scope(), val);
};
