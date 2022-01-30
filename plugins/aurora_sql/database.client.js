/**
 * used to add permissions to a database
 */
goog.provide('aurora.db.PermDatabase');

goog.require('aurora.permissions');
goog.require('recoil.db.Database');

/**
 * @implements {recoil.db.Database}
 * @constructor
 * @param {!recoil.db.Database} db
 */
aurora.db.PermDatabase = function(db) {
    this.src_ = db;
};


/**
 * @param {!IArrayLike} values
 * @return {!Object}
 */
aurora.db.PermDatabase.prototype.makeKey = function(values) {
    return this.src_.makeKey(values);
};

/**
 * gets an individual object from the database
 * @template T
 * @param {!recoil.db.Type<T>} id an id to identify the type of object you want
 * @param {!Array<?>|!recoil.db.Query=} primaryKeys primary keys of the object you want to get
 * @param {recoil.db.QueryOptions=} opt_options extra option to the query such as poll rate or notify
 * @return {!recoil.frp.Behaviour<T>} the corisponding object
 */
aurora.db.PermDatabase.prototype.get = function(id, primaryKeys, opt_options) {
    let permT = aurora.db.schema.tables.sec.permissions;
    let behaviour = this.src_.get(id, primaryKeys, opt_options);
    if (id.key === permT) {
        // no doing permissions on permissions table
        return behaviour;
    }
    let frp = behaviour.frp();
    let permissionsB = aurora.permissions.getContextDb(frp, this.src_);

    return frp.liftBI(function(v, perms) {
        if (perms.allowAll) {
            return v;
        }
        if (v instanceof recoil.structs.table.Table) {
            let res = v.unfreeze();
            res.addMeta({permContext: perms});
            let tableT = aurora.db.schema.getTableByName(id.getData().name);
            if (tableT) {
                aurora.db.PermDatabase.addTablePermissions(res, tableT);
            }
            return res.freeze();
        }
        return v;
    }, function(v) {behaviour.set(v);}, behaviour, permissionsB);
};

/**
 * sets up the meta on a table for permissions
 * @param {!recoil.structs.table.MutableTable} table
 * @param {aurora.db.schema.TableType} tableT
 */
aurora.db.PermDatabase.addTablePermissions = function(table, tableT) {
    let perms = table.getMeta().permContext;
    let path = table.getMeta().basePath;
    if (!path || !perms) {
        return;
    }

    let tbl = aurora.db.schema.getTableByName(path);
    let baseCanUpdate = tbl.info.access ? tbl.info.access(perms, 'u') : true;
    let baseCanCreate = tbl.info.access ? tbl.info.access(perms, 'c') : true;
    let baseCanAdd = tbl.info.access ? tbl.info.access(perms, 'c') : true;
    let baseCanRemove = tbl.info.access ? tbl.info.access(perms, 'd') : true;
    let baseEditable = baseCanCreate || baseCanUpdate;


    if (!baseEditable) {
        table.addMeta({editable: false});
    }



    if (tableT.info) {
        let access = tableT.info.access;
        while (!access) {
            let parts = tableT.info.name.split('/');
            if (parts.length == 0) {
                break;
            }
            parts.pop();
            let path = parts.join('/');
            let tbl = aurora.db.schema.getTableByName(path);
            if (!tbl) {
                break;
            }
            access = tbl.info.access;
        }
        if (access) {
            table.addMeta({canAdd: access(perms, 'c'), canRemove: access(perms, 'd')});
        }
    }

    table.forEachColumn(function(col) {
        let access = aurora.db.PermDatabase.getColAccess(perms, col);
        if (baseEditable != (access('c') || access('u'))) {
            table.addColumnMeta(col, {editable: !baseEditable});
        }
        if (!access('r')) {
            table.addColumnMeta(col, {visible: false});
        }
    });
};

/***
 * @param {!aurora.permissions.Context} context
 * @param {!recoil.structs.table.ColumnKey} col
 * @return {function(string):boolean}
 */

aurora.db.PermDatabase.getColAccess = function(context, col) {
    let meta = aurora.db.schema.getMeta(col);
    let tbl = aurora.db.schema.getTable(col);
    let access = null;
    while (!access && (tbl || meta)) {
        if (!access && tbl && tbl.info && tbl.info.access) {
            access = tbl.info.access;
        }
        if (!access && meta && meta.access) {
            access = meta.access;
        }

        // now get the parent table if it exists
        let myTbl = aurora.db.schema.getParentTable(col);
        if (!myTbl || !myTbl.info) {
            break;
        }
        if (access == null && myTbl.info.access) {
            access = myTbl.info.access;
        }

        let parentParts = myTbl.info.path.split('/');
        if (parentParts.length == 0) {

            break;
        }

        parentParts.pop();
        let path = parentParts.join('/');
        tbl = aurora.db.schema.getTableByName(path);
        meta = null;
        try {
            meta = aurora.db.schema.getMetaByPath(path);
        }
        catch (e) {
            // ok it might not be there
        }
    }
    if (!access) {
        return function(perm) {
            return true;
        };
    }
    return function(perm) {
        return access(context, perm);
    };
};
