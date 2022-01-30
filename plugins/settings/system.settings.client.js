goog.provide('aurora.widgets.SystemSettings');


goog.require('aurora.db.schema.tables.base.system_settings');
goog.require('goog.dom');
goog.require('recoil.ui.ComponentWidgetHelper');


/**
 * @constructor
 * @export
 * @param {!aurora.widgetscope} scope
 * @param {number} userid
 * @implements {recoil.ui.Widget}
 */
aurora.widgets.SystemSettings = function(scope, userid) {
    this.scope_ = scope;
    let frp = scope.getFrp();
    const settingsT = aurora.db.schema.tables.base.system_settings;
    this.tableWidget_ = new recoil.ui.widgets.table.TableWidget(scope);

    let settingsB = scope.getDb().get(settingsT.key);
    let contextB = aurora.permissions.getContext(scope);

    let displaySettingsB = frp.liftBI(function(tbl, context) {
        let columns = new recoil.ui.widgets.TableMetaData();
        let res = tbl.createEmpty();

        res.addColumnMeta(settingsT.cols.value, {displayLength: 30});

        columns.add(settingsT.cols.name, 'Setting');
        columns.add(settingsT.cols.value, 'Value');
        let rows = [];


        tbl.forEachModify(function(row) {
            if (aurora.permissions.has('site-management')(context)) {
                rows.push(row);
            }
        });
        rows.sort(function(x, y) {
            return x.get(settingsT.cols.name).localeCompare(y.get(settingsT.cols.name));
        });
        rows.forEach(function(row, i) {
            row.setPos(i);
            res.addRow(row);
        });
        return columns.applyMeta(res);
    }, function(t) {
        settingsB.set(t);
    }, settingsB, contextB);

    this.tableWidget_.attachStruct(displaySettingsB);

};


/**
 * @return {!goog.ui.Component}
 */
aurora.widgets.SystemSettings.prototype.getComponent = function() {
    return this.tableWidget_.getComponent();
};


/**
 * all widgets should not allow themselves to be flatterned
 *
 */

aurora.widgets.SystemSettings.prototype.flatten = recoil.frp.struct.NO_FLATTEN;

