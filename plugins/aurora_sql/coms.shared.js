goog.provide('aurora.db.Serializer');
goog.provide('aurora.db.ValueSerializor');

goog.require('aurora.db.PrimaryKey');


/**
 * @constructor
 * @implements {recoil.db.Query.Serializer}
 */
aurora.db.Serializer = function() {
};

/**
 * @param {?} col
 * @return {!recoil.structs.table.ColumnKey}
 */
aurora.db.Serializer.prototype.deserializeCol = function(col) {
    let parts = col.split('/');
    if (parts.length < 2) {
        throw new Error('Invalid Path ' + col);
    }
    let last = parts.pop();
    let tbl = aurora.db.schema.keyMap[parts.join('/')];
    if (!tbl) {
        throw new Error('Invalid Path no table for ' + col);
    }
    let res = tbl.meta[last] ? tbl.meta[last].key : null;
    if (!res) {
        throw new Error('Invalid Path in table ' + col);
    }
    return res;
};

/**
 * @param {!recoil.structs.table.ColumnKey} col
 * @return {?}
 */
aurora.db.Serializer.prototype.serializeCol = function(col) {
    return aurora.db.schema.getParentTable(col).info.path + '/' + col.getName();
};



/**
 * @param {?} val
 * @return {?}
 */
aurora.db.Serializer.prototype.deserializeValue = function(val) {
    if (val == undefined) {
        return val;
    }
    if (typeof (val) === 'string') {
        return val;
    }
    if (val instanceof Object) {
        if (val.type === 'pk') {
            return new aurora.db.PrimaryKey(val.value.db, val.value.mem);
        }

        if (val.type === 'bigint') {
            return BigInt(val.value);
        }
        return val.value;
    }
    return val;
};

/**
 * @param {?} val
 * @return {?}
 */
aurora.db.Serializer.prototype.serializeValue = function(val) {
    if (val == undefined) {
        return val;
    }
    let type = 'def';
    let value = val;
    if (typeof (val) === 'string') {
        return val;
    }
    if (typeof(val) === 'big' + 'int') {
        type = 'bigint';
        value = '' + val;
    }
    else if (val instanceof aurora.db.PrimaryKey) {
        type = 'pk';
        value = {db: val.db, mem: val.mem};
    }
    return {
        type: type,
        value: value
    };
};


/**
 * @constructor
 * @implements {recoil.db.ChangeSet.ValueSerializor}
 * allows override to serialize/deserialize values, eg buffers
 */
aurora.db.ValueSerializor = function() {
};

/**
 * @suppress {checkTypes}
 * @param {!recoil.db.ChangeSet.Path} path
 * @param {?} val
 * @return {?}
 */
aurora.db.ValueSerializor.prototype.serialize = function(path, val) {
    if (typeof (val) === 'bigint') {
        var def = new aurora.db.Schema().getContainerDef(path.parent());
        return val.toString();
    }
    return val;
};
/**
 * converts a path to an object that can be turned into json
 * @param {!recoil.db.ChangeSet.Path} path
 * @param {?} serialized
 * @return {?}
 */
aurora.db.ValueSerializor.prototype.deserialize = function(path, serialized) {
    var val = serialized;
    var def = new aurora.db.Schema().getContainerDef(path.parent());
    if (def && def.meta) {
        var meta = def.meta[path.last().name()];
        if (meta && val != null) {
            if (['id', 'ref'].indexOf(meta.type) !== -1) {
                return new aurora.db.PrimaryKey(BigInt(val));
            }
            if (['int64'].indexOf(meta.type) !== -1) {
                return BigInt(val);
            }
        }
    }


    return serialized;
};

