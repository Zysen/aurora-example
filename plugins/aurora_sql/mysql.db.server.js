goog.provide('aurora.db.mysql.Pool');

goog.require('aurora.db.Pool');
goog.require('aurora.log');
/**
 * parameters are given names e.g ?name, they can be used more than once
 */

let poolCount = 0;
let conCount = 0;

/**
 * @implements {aurora.db.Pool}
 * @constructor
 * @param {{host:string, user:string, password:string, database:string}} options
 * @param {!mysql.Connection=} opt_connection
 */
aurora.db.mysql.Pool = function(options, opt_connection) {
    const mysql = require('mysql');
	if (!opt_connection) {
	    poolCount++;
	}

    this.mysql_ = mysql;
    this.options_ = options;
    this.transactionCount_ = 0;
    if (opt_connection) {
        this.connection_ = opt_connection;
    }
    else {
        let opts = goog.object.clone(options);
        opts.supportBigNumbers = true;
        opts.bigNumberStrings = true;
        this.pool_ = mysql.createPool(opts);
    }

};
/**
 * @param {string} name
 * @param {function(?,?number)} callback
 */

aurora.db.mysql.Pool.prototype.nextSequence = function(name, callback) {
    /*
  fieldCount: 0,
  affectedRows: 1,
  insertId: 4,
  serverStatus: 2,
  warningCount: 0,
  message: '',
  protocol41: true,
  changedRows: 0
  */
    let seqTable = this.escapeId(name);
    let me = this;
    this.query('INSERT INTO ' + seqTable + ' () VALUES ()', function(err, data) {
        let id = data.insertId;
        if (!err) {
            me.query('DELETE FROM ' + seqTable + ' WHERE id = ' + id, function() {
                callback(null, id);
            });
        }
        else {
            callback(err, null);
        }
    });
};
/**
 * @param {string} select
 * @param {recoil.db.QueryOptions|undefined} options
 * @return {string}
 */

aurora.db.mysql.Pool.prototype.addOptions = function(select, options) {
    if (!options) {
        return select;
    }
    if (!options.isCount()) {

        if (options.size() != undefined) {
            select += ' LIMIT ';
            if (options.start()) {
                if (options.start().page) {
                    let offset = options.size() * (options.start().page - 1);
                    select += this.mysql_.escape(offset) + ',' + this.mysql_.escape(options.size());
                }
                else {
                    select += this.mysql_.escape(options.size());
                }
            }
            else {
                select += this.mysql_.escape(options.size());
            }

        }
    }
    return select;
};


/**
 * @param {function(?)} cb
 * @suppress {checkTypes}
 */
aurora.db.mysql.Pool.prototype.dropDb = function(cb) {
    let testOpts = goog.object.clone(this.options_);
    testOpts['database'] = 'mysql';
    let testCon = this.mysql_.createConnection(testOpts);
    let database = this.options_['database'];
    let me = this;
    testCon.query('drop database ' + this.escapeId(database), function(err) {
        testCon.destroy();
        cb(err);
    });

};
/**
 * @param {function(?)} cb
 * @suppress {checkTypes}
 */
aurora.db.mysql.Pool.prototype.createDb = function(cb) {
    let testOpts = goog.object.clone(this.options_);
    testOpts['database'] = 'mysql';
    let testCon = this.mysql_.createConnection(testOpts);
    let database = this.options_['database'];
    let me = this;
    testCon.query('create database ' + this.escapeId(database), function(err) {
        testCon.destroy();
        if (!err && me.pool_) {
            // reinitialize the database it must have been an error before
            me.pool_.end(function() {});
            me.pool_ = me.mysql_.createPool(me.options_);
        }
        cb(err);
    });
};
/**
 * backs up the database
 * @param {function(?,?string)} cb
 * @suppress {checkTypes}
 */
aurora.db.mysql.Pool.prototype.backup = function(cb) {

    // first check if the database even exists if it doesn't there is no need for a backup
    let testOpts = goog.object.clone(this.options_);
    testOpts['database'] = 'mysql';
    let testCon = this.mysql_.createConnection(testOpts);
    let database = this.options_['database'];
    let me = this;
    testCon.query('SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ' + this.escape(database), function(err, rows) {
        testCon.destroy();
        if (err) {
            cb(err, null);
        }
        else if (rows.length === 0) {
            // no error but database
            cb(null, null);
        }
        else {
            me.backup_(cb);
        }
    });
};
/**
 * backs up the database
 * @private
 * @param {function(?,?string)} cb
 * @suppress {checkTypes}
 */
aurora.db.mysql.Pool.prototype.backup_ = function(cb) {
    const { spawn } = require('child_process');
    const fs = require('fs');
    const path = require('path');
    let me = this;
    let database = this.options_['database'];
    const fname = path.join(me.options_['backup'] || '.', database + '-' + new Date().toISOString().replace(/:/g, '_') + '.sql');
    let write = fs.createWriteStream(fname);
    let error = null;
    //
    write.on('ready', function() {
        let process = spawn('mysqldump', ['-u', me.options_['user'], '-p' + me.options_['password'], me.options_['database']]);
        process.stdout.on('data', (data) => {
            write.write(data);
        });

        process.on('error', function(e) {
            if (!error) {
                error = e;
                cb(e, null);
            }
        });

        process.on('exit', (code) => {
            if (code && !error) {
                error = 'Process exited with code ' + code;
                cb(error, null);
            }
            write.end();
        });
    });
    write.on('error', function (e) {
        if (e && !error) {
            error = e;
            cb(error, null);
        }
    });
    write.on('finish', function () {
        cb(error, fname);
    });
};

/**
 * @param {string} fname
 * @param {function(?)} cb
 */
aurora.db.mysql.Pool.prototype.restore = function(fname, cb) {
    const { spawn } = require('child_process');
    const fs = require('fs');
    let read = fs.createReadStream(fname);
    let error = null;
    let me = this;

    let database = me.options_['database'];
    let log = aurora.db.mysql.log;
    log.info("*********************************** restoring database '"+ database +  "' from '" + fname + "'");
    let runMysql = function (err) {
        if (err) {
            log.error("error dropping database", err);
            cb(err);
            return;
        }
        let p = spawn('mysql', ['-u', me.options_['user'], '-p' + me.options_['password'], database]);
        
            
        p.on('error', function(e) {
            if (!error) {
                error = e;
                cb(e);
            }
        });
        
        p.on('exit', (code) => {
            console.log("done",code);
            if (code && !error) {
                    error = 'Process exited with code ' + code;
                cb(error);
            }
            
        });
        read.pipe(p.stdin);
    };


    me.dropDb(
        function (err) {
            if (err) {
                runMysql(err);
            }
            else {
                me.query('create database ' + me.escapeId(database), runMysql);
            }
        });
    
};

/**
 * @param {{host:string, user:string, password:string, database:string}} options
 * @param {function(?)} cb
 */
aurora.db.mysql.Pool.prototype.createAppUser = function(options, cb) {
    let me = this;
    let user = this.escape(options.user) + '@' + this.escape(options.host);
    me.query('DROP USER IF EXISTS ' + user, function() {
        me.query(
            'CREATE USER ' + user + ' IDENTIFIED BY ' + me.escape(options.password),
            function(err) {
                if (!err) {

                    me.query(
                        'GRANT DELETE,INSERT,SELECT,UPDATE  ON ' + me.escapeId(options.database) + '.* TO ' + user,
                        function(err) {
                            cb(err);
                        });

                }

            }
        );
    });
};

/**
 * @const
 */
aurora.db.mysql.log = aurora.log.createModule('MYSQL');


aurora.db.mysql.Pool.isIdent_ = (function() {
    let map = {'_' : true};
    // doesn't really handle non asci chars

    function addCharRange(startC, endC) {
        let start = startC.charCodeAt(0);
        let end = endC.charCodeAt(0);
        for (let i = start; i <= end; i++) {
            map[String.fromCharCode(i)] = true;
        }
    }
    addCharRange('0', '9');
    addCharRange('a', 'z');
    addCharRange('A', 'Z');

    return function(ch) {
        return !!map[ch];
    };
})();

/**
 * @private
 * @param {string} query
 * @param {Object<string,?>} valueMap
 * @return {{sql:string, values:!Array<?>}}
 */
aurora.db.mysql.Pool.formatQuery = function(query, valueMap) {
    let isIdent = aurora.db.mysql.Pool.isIdent_;
    let parts = [];
    let names = [];
    let part = '';
    for (let i = 0; i < query.length; i++) {
        let ch = query[i];
        if (ch === '\'') {
            // ignore inside strings
            do {
                if (ch === '\\') {
                    part += ch;
                    ch = query[++i];
                }
                part += ch;
                ch = query[++i];
            }
            while (i < query.length && ch !== '\'');

            if (ch != undefined) {
                part += ch;
            }
        }
        else if (ch === '`') {
            // ignore inside ` escapes
            part += ch;
            ch = query[++i];
            while ((ch !== '`' || (ch === '`' && query[i + 1] === '`')) && i < query.length) {
                part += ch;
                if (ch === '`') {
                    part += '`';
                    i++;
                }
                ch = query[++i];
            }
            if (ch != undefined) {
                part += ch;
            }
        }
        // deal with identifies
        else if (ch === '?' && (part.length === 0 || !isIdent(part[part.length - 1]))) {
            parts.push(part);
            part = '';
            let name = '';
            ch = query[++i];
            while (isIdent(ch)) {
                name += ch;
                ch = query[++i];
            }


            names.push(name);

            if (ch != undefined) {
                part += ch;
            }
        }
        else {
            part += ch;
        }
    }
    if (part !== '' || parts.length <= names.length) {
        parts.push(part);
    }

    let values = [];
    for (let i = 0; i < names.length; i++) {
        values.push(valueMap[names[i]]);
    }
    return {sql: parts.join('?'), values: values};
};

(function() {
    function test(sql, args, expected) {
        let res = aurora.db.mysql.Pool.formatQuery(sql, args);
        if (!recoil.util.object.isEqual(res, expected)) {
            console.log('fail', res, sql);
            process.exit(1);
        }

    }

    test('\'', {}, {sql: '\'', values: []});
    test('``', {}, {sql: '``', values: []});
    test('```?fred`?abc', {abc: 1}, {sql: '```?fred`?', values: [1]});
    test('hi?0bc', {'0bc': 2},{sql: 'hi?0bc' , values: []});
    test('hi+?0bc', {'0bc': 3},{sql: 'hi+?' , values: [3]});
    test('hi+?0bc,', {'0bc': 4},{sql: 'hi+?,' , values: [4]});
})();

/**
 * @param {string} query
 * @param {function(?,(Array|!aurora.db.type.InsertDef),?)|!Object<string,?>} params (error, results, fields)
 * @param {function(?,(Array|!aurora.db.type.InsertDef),?)=} opt_callback not optional, but can be suplied in params argument
 */
aurora.db.mysql.Pool.prototype.query = function(query, params, opt_callback) {
    let opt_params = params instanceof Function ? {} : params;
    let callback = params instanceof Function ? params : opt_callback;
    let queryObj = aurora.db.mysql.Pool.formatQuery(query, opt_params || {});

    if (!(callback instanceof Function)) {
        throw new Error('callback not a function');
    }
    let cb = function(error, results, fields) {
		if(error){
			console.error(queryObj.sql);
		}
        callback(error, results, fields);
    };
    (this.connection_ || this.pool_).query(queryObj.sql, queryObj.values, cb);
};


/**
 * used for getting querys that have large result sets that shouldn't be stored in memory
 * @param {string} query
 * @param {!Object<string,?>} params (error, results, fields)
 * @param {function(!Object, function())} rowCb
 * @param {function(?)} doneCb
 */
aurora.db.mysql.Pool.prototype.queryLarge = function(query, params, rowCb, doneCb) {
    let queryObj = aurora.db.mysql.Pool.formatQuery(query, params || {});
    let connection = (this.connection_ || this.pool_);
    let doQuery = function (connection, doneQuery) {
        let query = connection.query(queryObj.sql, queryObj.values);
        let queryErr = null;
        query.on('error', function(err) {
            if(queryErr){
				console.error(queryObj.sql);
			}
			queryErr = err;
        }).on('fields', function(fields) {
            // the field packets for the rows to follow
        }).on('result', function(row) {
            // Pausing the connnection is useful if your processing involves I/O
            connection.pause();
            rowCb(row, function() {
                connection.resume();
                
            });
        }).on('end', function() {
            doneCb(queryErr);
        });
    };
    if (this.connection_) {
        doQuery(this.connection_, doneCb);
    }
    else {
        this.pool_.getConnection(function (err, connection) {
            if (err) {
                doneCb(err);
            }
            else {
                doQuery(connection, function (err) {
                    connection.release();
                    doneCb(err);
                });
            }
        });
    }

};
/**
 * @param {string} table
 * @param {!Object<string,?>} values
 * @param {function(?,?aurora.db.type.InsertDef)} callback (error, results)
 */
aurora.db.mysql.Pool.prototype.insert = function(table, values, callback) {
    let hasValues = false;
    
    for (let k in values) {
        hasValues = true;
        break;
    }

    let query = 'INSERT INTO ' + this.escapeId(table) + (hasValues ? ' SET ?values' : ' VALUES ()');
    this.query(
        query,
        {values: values},
        function(error, results, fields) {
            if (error) {
                aurora.db.mysql.log.info("query error", error, query);
            }
            
            callback(error, /** @type {?aurora.db.type.InsertDef} */ (results));
        }
    );

};

/**
 * @param {string} table
 * @param {string} pk
 * @param {!Object<string,?>} values
 * @param {function(?,?)} callback (error, results)
 */
aurora.db.mysql.Pool.prototype.safeInsert = function(table, pk, values, callback) {
    let hasPk = values[pk] != undefined;
    let escape = this.mysql_.escape;
    let escapeId = this.mysql_.escapeId;
    if (hasPk) {
        let cols = [];
        let vals = [];
        for (let k in values) {
            cols.push(k);
            vals.push(values[k]);
        }
        this.query(
            'INSERT INTO ' + this.escapeId(table) + ' (' +
                cols.map(function(col) {return escapeId(col);}).join(',') + ') (SELECT DISTINCT ' +
                values.map(function(v) {return escape(v);}).join(',') + ' WHERE ' +
                escapeId(pk) + ' NOT IN (SELECT ' + escapeId(pk) + ' FROM ' + escapeId(table) + '))',
            function(error, results, fields) {
                callback(error, results);
            }
        );
    }
    else {
        this.insert(table, values, callback);
    }
};

/**
 * @param {string} table
 * @param {!Object<string,?>} values
 * @param {function(?,?)} callback (error, results)
 * @return {function(!aurora.db.Pool,function(?))}
 */
    aurora.db.mysql.Pool.prototype.insertSeq = function(table, values, callback) {
    return aurora.db.Pool.mkSeqFunc(this.insert, table, values, callback);
};


/**
 * @param {string} table
 * @param {!Object<string,?>} keys
 * @param {function(?,number)} callback first arg error second number of row effected
 */
aurora.db.mysql.Pool.prototype.delete = function(table, keys, callback) {
    let sql = 'DELETE FROM ' + this.escapeId(table);
    let keyNames = Object.keys(keys);
    let me = this;
    let values = {};
    if (keyNames.length > 0) {
        let i = 0;
        sql += ' WHERE ' + keyNames.map(function(k) {
            values[i] = keys[k];
            return me.escapeId(k) + ' = ?' + i;
        }).join(' AND ');
    }
    this.query(sql, values, function(err, results) {
        console.log('todo get effected', results);
        callback(err, 0);
    });
};

/**
 * @param {string} table
 * @param {!Object<string,?>} keys
 * @param {function(?,number)} callback first arg error second number of row effected
 * @return {function(!aurora.db.Pool,function(?))}
 */
aurora.db.mysql.Pool.prototype.deleteSeq = function(table, keys, callback) {
    return aurora.db.Pool.mkSeqFunc(this.delete, table, keys, callback);
};
/**
 * @param {string} table
 * @param {!Object<string,?>} keys
 * @param {!Object<string,?>} values
 * @param {function(?)} callback (error)
 */
aurora.db.mysql.Pool.prototype.update = function(table, keys, values, callback) {

    let whereList = [];
    for (let key in keys) {
        let v = keys[key];
        whereList.push(this.escapeId(key) + (v == null ? ' IS NULL' : ' = ' + this.escape(v)));
    }
    let sql = 'UPDATE ' + this.escapeId(table) + ' SET ?values ' + (whereList.length > 0 ? ' WHERE ' + whereList.join(' AND ') : '');
    this.query(sql, values, function(err, results) {
        callback(err);
    });

};

/**
 * @param {string} table
 * @param {!Object<string,?>} keys
 * @param {!Object<string,?>} values
 * @param {function(?,Array,?)} callback (error, results, fields)
 * @return {function(!aurora.db.Pool,function(?))}
 */

aurora.db.mysql.Pool.prototype.updateSeq = function(table, keys, values, callback) {
    return aurora.db.Pool.mkSeqFunc(this.update, table, values, keys, callback);
};


/**
 * similar to transaction but does not start a transaction
 * @param {!Array<function(!aurora.db.mysql.Pool,function(!aurora.db.Pool, ?))>} actions a sequence of actions to perfom, if an error occurs
 * and following actions are stopped and the transaction is rolled back
 * @param {function(?)} callback
 */
aurora.db.mysql.Pool.prototype.sequence = function(actions, callback) {
    let idx = 0;
    let doIt = function(con, connection) {
        return function(err) {
            if (idx < actions.length && err == undefined) {

                let action = actions[idx];
                idx++;
                try {
                    action(con, doIt(con, connection));
                    return;
                }
                catch (e) {
                    aurora.db.mysql.log.error('SQL SEQ', e);
                    err = e;
                }
            }

            if (connection) {
                connection.release();
            }
            callback(err);
        };
    };
    // we are already in a sequence no need to make a new connection
    if (this.connection_) {
        doIt(this, this.connection_)(null);
        return;
    }

    this.pool_.getConnection(function(err, connection) {
        if (err) {
            callback(err);
            return;
        }

        let con = new aurora.db.mysql.Pool(this.options_, connection);
        doIt(con, connection)(null);

    });
};
/**
 * starts and ends the transaction, calls doneFunc is called, the callback inside callback must be called when done
 * @param {function(!aurora.db.mysql.Pool,function(?,...))} callback no error here we go directly to doneFuncif we have an error opening the pool
 * @param {function(?,...)} doneFunc first arg is error
 */
aurora.db.mysql.Pool.prototype.transaction = function(callback, doneFunc) {
    let me = this;
    let makeArguments = function(args) {
        let res = [];
        for (let i = 0; i < args.length; i++) {
            res.push(args[i]);
        }
        return res;
    };
    if (this.transactionCount_) {
        this.transactionCount_++;
        callback(this, function(err) {
            let args = makeArguments(arguments);
            me.transactionCount_--;
            if (err) {
                doneFunc(err);
            }
            else {
                doneFunc.apply(null, args);
            }
        });
    }
    else {
        if (this.connection_) {
            let connection = this.connection_;
            connection.beginTransaction(function(err) {
                if (err) {
                    // do nothing we we haven't started
                    doneFunc(err);
                    return;
                }                 

                me.transactionCount_++;
                callback(me, function(err) {
                    let args = makeArguments(arguments);
                    me.transactionCount_--;
                    if (err) {
                        connection.rollback(function() {
                            doneFunc(err);
                        });
                    }
                    else {
                        connection.commit(function(err) {
                            if (err) {
                                connection.rollback(function() {
                                    doneFunc(err);
                                });
                            } else {
                                doneFunc.apply(null, args);
                            }
                        });
                    }
                });
            
            });
        }
        else {
            this.pool_.getConnection(function(err, connection) {

                if (err) {
                    doneFunc(err);
                }
                else {
                    let con = new aurora.db.mysql.Pool(me.options_, connection);
                    con.transaction(callback, function() {
                        connection.release();
                        let args = makeArguments(arguments);
                        doneFunc.apply(null, args);
                    });
                }
            });
        }
    }

};

/**
 * @param {!Object<string,aurora.db.type.ColumnDef>} field
 * @return {string}
 */
aurora.db.mysql.Pool.makeType = function (field) {
    if (field.type === aurora.db.type.types.bigint) {
        return 'BIGINT';
    }
    if (field.type === aurora.db.type.types.boolean) {
        return 'TINYINT';
    }
    
    if (field.type === aurora.db.type.types.varchar) {
        return 'VARCHAR(' + field.length + ')';
    }
    if (field.type === aurora.db.type.types.password) {
        return 'VARBINARY(' + aurora.db.Pool.passwordColSize() + ')';
    }
    
    if (field.type === aurora.db.type.types.int) {
        return 'INT';
    }

    if (field.type === aurora.db.type.types.json) {
        return 'JSON';
    }
    if (field.type === aurora.db.type.types.blob) {
        return 'BLOB';
    }
    
    throw 'Unknown type ' + field.type;
};


/**
 * @const
 * @private
 */
aurora.db.mysql.Pool.dbTypeMap_ = {
    'bigint': 'bigint(20)',
    'int': 'int(11)',
    'tinyint': 'tinyint(4)'
};

/**
 * @private
 * @param {!Object<string,aurora.db.type.ColumnDef>} field
 * @return {string}
 */
aurora.db.mysql.Pool.makeDbType_ = function (field) {
    let t = aurora.db.mysql.Pool.makeType(field).toLowerCase();
    let mapped = aurora.db.mysql.Pool.dbTypeMap_[t];
    return mapped == undefined ? t : mapped;
};

/**
 * @private
 * @param {!Object<string,aurora.db.type.ColumnDef>} field
 * @return {string}
 */
aurora.db.mysql.Pool.makeDbType1_ = function (field) {
    return aurora.db.mysql.Pool.makeType(field).toLowerCase();
};

/**
 * @private
 * @param {string} name
 * @param {!Object<string,aurora.db.type.ColumnDef>} field
 * @return {string}
 */

aurora.db.mysql.Pool.prototype.makeFieldDef_ = function (name, field) {
    let makeType = aurora.db.mysql.Pool.makeType;
    let sql = this.escapeId(name) + ' ' + makeType(field);
    sql += ' ' + (field.nullable ? '' : 'NOT ') + 'NULL';
    if (field.default != undefined) {
        sql += ' DEFAULT ' + this.escape(field.default);
    }
    if (field.pk) {
        if (field.auto === false) {
            sql += ' PRIMARY KEY';
        }
        else {
            sql += ' AUTO_INCREMENT PRIMARY KEY';
        }
    }
    return sql;
};
/**
 * @param {string} table
 * @param {!Object<string,aurora.db.type.ColumnDef>} fields
 * @param {!Array<!aurora.db.type.IndexDef>} indexes
 * @param {!aurora.db.type.TableOptions} options
 * @param {function(?, boolean, !aurora.db.Pool.TableChanges)} callback (error, existed, array of added columns)
 */

aurora.db.mysql.Pool.prototype.createTable = function(table, fields, indexes, options, callback) {

    let makeType = aurora.db.mysql.Pool.makeType;

    let sql = 'CREATE ' + (options.temp ? 'TEMPORARY ' : '') + 'TABLE ' + this.escapeId(table) + ' (';

    let first = true;
    for (let name in fields) {
        let field = fields[name];

        if (!first) {
            sql += ',';
        }
        sql += '\n  ' + this.makeFieldDef_(name, field);
        first = false;
    }
    let me = this;
    indexes.forEach(function(index) {
        let indexName = me.escapeId('idx_' + table + '_' + index.columns.join('_'));
        sql += ',\n   ';
        if (index.unique) {
            sql += 'CONSTRAINT UNIQUE ';
        }
        sql += 'INDEX ' + indexName + '(' + index.columns.map(me.escapeId.bind(me)).join(',') + ')';
    });
    sql += ')';
    if (options.start != undefined) {
        sql += ' AUTO_INCREMENT = ' + me.escape(options.start);
    }

    if (options.exists) {
        this.getTableChanges(table, fields, indexes, function (err, changes) {
            if (err) {
                callback(err, false, changes);
            }
            else if (changes.isNew) {
                // table does not exist just create it
                me.query(sql, function (err) {
                    callback(err, false, changes);
                });
            }
            else if (changes.hasChanges) {

                me.applyTableChanges(table, fields, changes, function (err) {
                    callback(err, true, changes);
                });
            }
            else {
                callback(null, true, changes);
            }
        });
            
    }
    else {
        this.query(sql, callback);
    }
};


/**
 * @param {string} table
 * @param {!Object<string,aurora.db.type.ColumnDef>} fields
 * @param {!aurora.db.Pool.TableChanges} changes
 * @param {function(?)} callback
*/
aurora.db.mysql.Pool.prototype.applyTableChanges = function(table, fields, changes, callback) {
    if (!changes.hasChanges) {
        callback(null);
        return;
    }
    const async = require('async');
    let me = this;
    async.waterfall([
        function doAdds (done) {

            async.eachSeries(changes.added, function (fieldName, eachCallback) {

                me.query('ALTER TABLE ' + me.escapeId(table) + ' ADD ' + me.makeFieldDef_(fieldName, fields[fieldName]) + '', eachCallback);

            },function (err) {
                done(err);
            });
        },

        function doModifies (done) {

            async.eachSeries(changes.modified, function (fieldName, eachCallback) {
                let name = fieldName['from']['name'];
                let to = fieldName['to'];                
                me.query('ALTER TABLE ' + me.escapeId(table) + ' CHANGE ' + me.escapeId(name) + ' ' +  me.makeFieldDef_(to.Field, fields[to.Field]), eachCallback);
                
            },function (err) {
                done(err);
            });
        },

        function doRemoves (done) {
            async.eachSeries(changes.removed, function (fieldName, eachCallback) {
                me.query('ALTER TABLE ' + me.escapeId(table) + ' DROP ' + me.escapeId(fieldName), eachCallback);
            },function (err) {
                done(err);
            });
        }],
        callback);
    
};

/**
 * @param {string} table
 * @param {!Object<string,aurora.db.type.ColumnDef>} fields
 * @param {!Array<!aurora.db.type.IndexDef>} indexes
 * @param {function(?, !aurora.db.Pool.TableChanges)} callback (error, changes)
 */
aurora.db.mysql.Pool.prototype.getTableChanges = function(table, fields, indexes, callback) {
    let me = this;
    let makeTypeDb = aurora.db.mysql.Pool.makeDbType_;
    let makeTypeDb1 = aurora.db.mysql.Pool.makeDbType1_;
    this.query('SHOW COLUMNS FROM ' + this.escapeId(table), function (err, curFields) {
        if (err && err.code === 'ER_NO_SUCH_TABLE') {
            callback(null, {isNew: true, hasChanges: true, added: [], modified: [], removed: []});
        }
        else if (err) {
            callback(err, {isNew: false, hasChanges: true, added: [], modified: [], removed: []});
        }
        else {
            let addFields = [];
            let modifyFields = [];
            let removeFields = [];
            let curFieldsObj = {};

            for (let i = 0; i < curFields.length; i++) {
                let curField = curFields[i];
                let newField = fields[curField.Field];

                curFieldsObj[curField.Field] = curField;

                if (newField) {
                    let defValue = newField.default == undefined ? null : '' + newField.default;
                    if ((curField.Null === 'YES') == !!newField.nullable
                        && (curField.Type == makeTypeDb(newField) || curField.Type == makeTypeDb1(newField))
                        && curField['Default'] === defValue) {
                        // do nothing
                    }
                    else {
                        modifyFields.push({from: {name: curField.Field, type: newField}, to: curField});
                    }
                    
                }
                else {
                    removeFields.push(curField.Field);
                }
            }

            for(let f in fields){
                
                if(!curFieldsObj[f]) {
                    addFields.push(f);
                }
            }

            if (addFields.length || modifyFields.length || removeFields.length) {

                let info = {isNew: false, hasChanges: true, added: addFields, modified: modifyFields, removed: removeFields};
                callback(null, info);
            }
            else {
                callback(null, {isNew: false, hasChanges: false, added: [], modified: [], removed: []});
            }
        }
    });
};

/**
 * @param {string} table
 * @param {!Object<string,?>} fields
 * @param {!Array<!aurora.db.type.IndexDef>} indexes
 * @param {!aurora.db.type.TableOptions} options
 * @param {function(?)} callback (error)
 * @return {function(!aurora.db.Pool,function(?))}
 */

aurora.db.mysql.Pool.prototype.createTableSeq = function(table, fields, indexes, options, callback) {
    return aurora.db.Pool.mkSeqFunc(this.createTable, table, fields, indexes, options, callback);
};


/**
 * @param {string} fromTable
 * @param {!Array<string>} fromFields
 * @param {string} toTable
 * @param {!Array<string>} toFields
 * @param {function(?)} callback (error)
 */
aurora.db.mysql.Pool.prototype.createForeignKey = function(fromTable, fromFields, toTable, toFields, callback) {
    let escapeId = this.escapeId.bind(this);
    let indexName = escapeId('fk_' + fromTable + '_' + fromFields.join('_') + '_to_' + toTable + '_' + toFields.join('_'));

    let sql = 'ALTER TABLE ' + escapeId(fromTable) + ' ADD FOREIGN KEY ' + indexName + '( ' + fromFields.map(escapeId).join(',') + ')';
    sql += ' REFERENCES ' + escapeId(toTable) + '(' + toFields.map(escapeId).join(',') + ')';

    this.query(sql, callback);
};

/**
 * @param {string} fromTable
 * @param {!Array<string>} fromFields
 * @param {string} toTable
 * @param {!Array<string>} toFields
 * @param {function(?)} callback (error)
 * @return {function(!aurora.db.Pool,function(?))}
 */
aurora.db.mysql.Pool.prototype.createForeignKeySeq = function(fromTable, fromFields, toTable, toFields, callback) {
    return aurora.db.Pool.mkSeqFunc(this.createForeignKey, fromTable, fromFields, toTable, toFields, callback);
};


/**
 * @param {string} str
 * @return {string}
 */
aurora.db.mysql.Pool.prototype.escapeId = function(str) {
    return this.mysql_.escapeId(str);
};

/**
 * @param {?} str
 * @return {string}
 */
aurora.db.mysql.Pool.prototype.escape = function(str) {
    return this.mysql_.escape(str);
};

/**
 * @param {?} str
 * @return {string}
 */
aurora.db.mysql.Pool.prototype.toJson = function(str) {
    return JSON.stringify(str);
};


/**
 * @param {?} str
 * @return {?}
 */
aurora.db.mysql.Pool.prototype.fromJson = function(str) {
    if (str == undefined) {
        return null;
    }
    return JSON.parse(str);
};

/**
 * @param {string} exp
 * @return {?}
 */

aurora.db.mysql.Pool.prototype.expression = function(exp) {
    return this.mysql_.raw(exp);
};
