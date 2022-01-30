goog.provide('aurora.SystemSettings');

/**
 * @constructor
 */
aurora.SystemSettings = function() {
    this.log_ = aurora.log.createModule('SYS-SETTINGS');
    this.settings_ = {};
};

/**
 * @param {string} path
 * @param {Object} defVal
 * @return {?}
 */
aurora.SystemSettings.prototype.getSettings = function(path, defVal) {
    let obj = recoil.util.object.clone(recoil.util.map.safeRecGet(this.settings_, path.split('/')));
    let fillDef = function(to, from) {
        for (let k in from) {
            let toV = to[k];
            let fromV = from[k];
            if (to[k] === undefined) {
                to[k] = from[k];
            }
            else if (toV instanceof Array) {
                if (fromV instanceof Array) {
                    for (let i = 0; i < toV.length && i < fromV.length; i++) {
                        fillDef(toV[i], fromV[i]);
                    }
                }
            } else if (toV instanceof Object) {
                if (fromV instanceof Object) {
                    fillDef(toV, fromV);
                }
            }
        }
    };
    fillDef(obj, defVal);
    return obj;
};

/**
 * forces an update of the settings
 * @param {!aurora.db.Reader} reader
 * @param {string=} opt_user
 */
aurora.SystemSettings.prototype.update = function(reader, opt_user) {
    let me = this;
    reader.readObjects({}, aurora.db.schema.tables.base.system_settings, null, null, function(err, rows) {

        if (!err) {
            let newObject = {};
            for (let i = 0; i < rows.length; i++) {
                try {
                    let val = rows[i].value;
                    let type = rows[i].type;
                    if (type == 'boolean') {
                        val = val.toLocaleLowerCase() === 'true';
                    }
                    else if (type === 'number') {
                        val = parseFloat(val);
                    }

                    recoil.util.map.safeRecGet(newObject, rows[i].name.split('/'), val);
                } catch (e) {
                    me.log_.error('unable to parse system setting ' + rows[i].name);
                    // skip its
                }
            }
            if (opt_user) {
                me.log_.info(opt_user + ' updated system settings');
            }
            me.settings_ = newObject;
        }
    });

};


/**
 */
aurora.SystemSettings.instance = new aurora.SystemSettings();
