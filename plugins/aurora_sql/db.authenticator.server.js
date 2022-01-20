goog.provide('aurora.db.Authenticator');

goog.require('aurora.auth.Auth');
goog.require('aurora.auth.DbSessionTable');
goog.require('aurora.db.access');
goog.require('aurora.db.schema.tables.base.user');
goog.require('aurora.log');



/**
 * @constructor
 * @implements {aurora.auth.Authenticator}
 * @param {!aurora.db.Reader} reader
 * @param {boolean} allowAnon if true will auto login anyone without password the user will be blank with no permissions
 */
aurora.db.Authenticator = function(reader, allowAnon) {
    this.reader_ = reader;
    this.allowAnon_ = allowAnon;
    this.log_ = aurora.log.createModule('DBAUTH');
    this.cachedSessionsExpiry_ = new goog.structs.AvlTree(function(x, y) {
        let res = y.expire - x.expire;
        if (res) {
            return res;
        }
        return (y.token + '').localeCompare(x.token + '');
    });
    this.cachedSessions_ = {};
    this.cacheTimer_ = null;


};

/**
 * @param {string} token
 * @param {Object} cred
 * @param {Object} data
 * @param {function(?)} cb
 */
aurora.db.Authenticator.prototype.validate = function(token, cred, data, cb) {
    let reader = this.reader_;
    let userT = aurora.db.schema.tables.base.user;
    let groupT = aurora.db.schema.tables.base.group;
    let permT = aurora.db.schema.tables.base.permission;
    let me = this;
    let columnFilter = [{prefix: ['groups'], result: true}, {subtable: false}];
    if (cred.anon) {
        data.permissions = {};
        data.ip = cred.srcAddr;
        data.user = cred.username;
        data.userid = null;
        cb(null);
        return;
    }
    reader.readObjectByKey({}, userT, [{col: userT.cols.username, value: cred.username}, {col: userT.cols.active, value: true}], null, function(err, user) {
        // hide errors
        let maxLocks = ((config['authentication'] || {})['maxTries'] || 3);
        let locktimeout = ((config['authentication'] || {})['lockoutMins'] || 15) * 60 * 1000;

        if (err || !user) {
            if (!err) {
                me.log_.warn('Invalid User', cred.username);
            }
            cb({message: 'Invalid User/Password'});
        }
        else if (maxLocks > 0 && user.lastinvalidtime && user.lockcount >= maxLocks && user.lastinvalidtime + locktimeout > new Date().getTime()) {
            cb({message: 'Account locked out try again in ' + Math.ceil(locktimeout / 60000) + ' Minutes'});
            me.log_.warn('Account Locked for', cred.username);
            let query = new recoil.db.Query();
            // do the increment in an expression as oposed to simply setting to lockcount + 1 an increment is never missed even if they happen at the same time
            reader.updateOneLevel({}, userT, {lockcount: reader.expression('lockcount + 1'), lastinvalidtime: new Date().getTime()}, query.eq(userT.info.pk, user.id), function(err) {});
        }
        else {
            aurora.db.Pool.checkPassword(cred.password, user.password, function(valid) {
                if (!valid) {
                    me.log_.warn('Invalid Password for', cred.username);
                    cb({message: 'Invalid User/Password'});
                    let query = new recoil.db.Query();
                    reader.updateOneLevel({}, userT, {lockcount: reader.expression('lockcount + 1'), lastinvalidtime: new Date().getTime()}, query.eq(userT.info.pk, user.id), function(err) {});
                }
                else {
                    let query = new recoil.db.Query();
                    let groups = user.groups.map(function(group) { return group.groupid; });
                    reader.updateOneLevel({}, userT, {lockcount: 0}, query.eq(userT.info.pk, user.id), function(err) {});
                    reader.readObjects({}, groupT, query.isIn(
                        query.field(groupT.cols.id.getName()), groups), null, function(err, groups) {
                            let permissions = {};
                            data.permissions = permissions;
                            data.ip = cred.srcAddr;
                            data.user = cred.username;
                            data.remember = cred.remember;
                            data.userid = user.id;
                            if (groups) {
                                let permMap = {};
                                groups.forEach(function(group) {
                                    (group.permission || []).forEach(function(perm) {
                                        permMap[perm.permissionid] = perm.permissionid;
                                    });
                                });
                                let permList = [];
                                for (let k in permMap) {
                                    permList.push(permMap[k]);
                                }
                                reader.readObjects({}, permT, query.isIn(permT.cols.id.getName(), permList), null, function(err, perms) {
                                    perms.forEach(function(p) {
                                        permissions[p.name] = true;
                                    });
                                    cb(null);
                                });


                            }
                            else {
                                cb(null);

                            }
                        });
                }
            });
        }
    }, new recoil.db.QueryOptions({columnFilters: columnFilter}));
};

/**
 *  strips out ::ffff: in ipv4 address
 * @param {string} addr
 * @return {string}
 */
aurora.db.Authenticator.formatIp = function(addr) {
    if (addr && addr.indexOf('::ffff:') === 0 && addr.indexOf('.') !== -1) {
        return addr.substring(7);
    }
    return addr;
};

/**
 * @param {aurora.http.RequestState} state
 * @param {function(?{response:function(?, aurora.http.RequestState, function(?))})} callback
 */
aurora.db.Authenticator.prototype.getCredentials = function(state, callback) {
    var auth = state.request.headers && state.request.headers['authorization'];
    var makeResponse = function(username, password, remember, anon) {
        var request = state.request;
        var srcAddr = aurora.db.Authenticator.formatIp(request.headers['x-forwarded-for'] || request.connection.remoteAddress);
        return {
            remember: remember,
            username: username,
            anon: anon,
            password: password,
            srcAddr: srcAddr,
            srcPort: request.socket.address().port,
            protocol: request.secure ? 'https' : 'http',
            response: function(message, state, d, doneCallback) {
                if (d) {
                    let ok = username && !message;
                    state.responseHeaders.set('Set-Cookie', [
                        'username=' + encodeURIComponent(ok ? username : '') + '; Path=/; SameSite=Strict;',
                        'userid=' + encodeURIComponent(ok ? d.userid : '') + '; Path=/; SameSite=Strict;',
                        'permissions=' + encodeURIComponent(JSON.stringify(d.permissions || {})) + '; Path=/; SameSite=Strict;']);
                }

                if (!anon) {
                    state.responseHeaders.set('Content-Type', 'application/json');
                    var res = {'status': true};
                    if (message) {
                        res = {'message': message.message};
                    }
                    state.response.writeHead(200, state.responseHeaders.toClient());
                    state.response.end(JSON.stringify(res), 'utf8');
                    doneCallback(false);
                }
                else {
                    // just continue as normal even though we have done a login
                    doneCallback(undefined);
                }

            }
        };
    };

    if (aurora.http.getPost(state.request, function(data) {
        callback(makeResponse(data['username'], data['password'], !!data['remember'], false));
    })) {
        return;
    }

    if (this.allowAnon_) {
        // just continue as if we don't login we should have just set the cookies
        callback(makeResponse(null, '', false, true));
        return;
    }
    // this is not the authenticator you are looking for
    callback(null);
};

/**
 * @param {string} token
 */

aurora.db.Authenticator.prototype.unregister = function(token) {

};

/**
 * @private
 * appdate the session cache expiry time
 */
aurora.db.Authenticator.prototype.updateExpire_ = function() {
    let me = this;
    if (me.cacheTimer_) {
        clearTimeout(me.cacheTimer_);
        me.cacheTimer_ = null;
    }

    me.cachedSessionsExpiry_.inOrderTraverse(function(e) {
        let now = process.hrtime()[0] * 1000;
        me.cacheTimer_ = setTimeout(function() {
            let toRemove = [];
            let now = process.hrtime()[0] * 1000;
            me.cachedSessionsExpiry_.inOrderTraverse(function() {
                if (now > e.expire) {
                    toRemove.push(e);
                }
            });
            toRemove.forEach(function(e) {
                delete me.cachedSessions_[e.token];
                me.cachedSessionsExpiry_.remove(e);
                });
            me.updateExpire_();
        }, Math.max(1, e.expire - now));
        return true;
    });

};

/**
 * @param {string} token
 * @param {?} socket
 * @param {!aurora.db.access.SecurityContext} context
 * @param {function(!aurora.db.access.SecurityContext)} callback
 */
aurora.db.Authenticator.prototype.cacheAndContinue_ = function(token, socket, context, callback) {

    let now = process.hrtime()[0] * 1000;
    let cached = {expire: now + 60000, context: context, token: token};
    this.cachedSessions_[token] = cached;
    this.cachedSessionsExpiry_.add(cached);
    this.updateExpire_();
    callback(this.makeServerInfo_(socket, cached.context));
};


/**
 * get permissions for mutiple users that may or may not be logged in
 * @param {!Array<number>} users
 * @param {function(!Array<!aurora.db.access.SecurityContext>)} callback
 */
aurora.db.Authenticator.prototype.getUserPermissions = function(users, callback) {
    let me = this;
    let reader = this.reader_;
    let query = new recoil.db.Query();

    let userT = aurora.db.schema.tables.base.user;
    let groupT = aurora.db.schema.tables.base.group;

    if (users.length === 0) {
        callback([]);
        return;
    }
    reader.selectReference(userT, [userT.groups.cols.groupid, groupT.permission.cols.permissionid], query.isIn(userT.cols.id, users.map(
        x => query.val(x)
    )), {distinct: true}, function(err, permRows) {
        if (err) {
            callback([]);
            return;
        }
        try {
            let users = {};
            permRows.forEach(function(row) {
                let context = recoil.util.map.safeRecGet(users, [row['userid']], {
                    userid: BigInt(row.userid),
                    '@user': row.username,
                    permissions: {}

                });
                context.permissions[row.name] = true;
            });
            let res = [];
            for (let k in users) {
                res.push(users[k]);
            }
            callback(res);
        }
        catch (e) {
            me.log_.error(e);
            callback([]);
        }
//        me.cacheAndContinue_(token, socket, {'@user': data.user, userid: data.userid, permissions: permission}, callback);
    }, [{col: userT.cols.id, name: 'userid'}, {col: userT.cols.username, name: 'username'}]);

};
/**
 * @param {string} token
 * @param {?} socket
 * @param {function(!aurora.db.access.SecurityContext)} callback
 */
aurora.db.Authenticator.prototype.getPermissions = function(token, socket, callback) {
    let me = this;
    let reader = this.reader_;

    let now = process.hrtime()[0] * 1000;

    let cached = me.cachedSessions_[token];

    if (cached && cached.expiry < now) {
        callback(me.makeServerInfo_(socket, cached.context));
    }
    else {
        aurora.auth.instance.getSessionData(token, function(data) {
            let userT = aurora.db.schema.tables.base.user;
            let groupT = aurora.db.schema.tables.base.group;
            let permT = aurora.db.schema.tables.base.permission;
            if (data.userid == null) {
                me.cacheAndContinue_(token, socket, {userid: null, permissions: {}}, callback);
                return;
            }

            let query = new recoil.db.Query();
            reader.selectReference(userT, [userT.groups.cols.groupid, groupT.permission.cols.permissionid], query.eq(userT.cols.id, query.val(data.userid)), {distinct: true}, function(err, permRows) {
                let permission = {};
                if (err) {
                    me.cacheAndContinue_(token, socket, {userid: data.userid, permissions: {}}, callback);
                    return;
                }
                permRows.forEach(function(row) {
                    permission[row.name] = true;
                });
                me.cacheAndContinue_(token, socket, {'@user': data.user, userid: data.userid, permissions: permission}, callback);
            });
        });
    }
};

/**
 * @private
 * @param {?} socket
 * @param {!aurora.db.access.SecurityContext} context
 * @return {!aurora.db.access.SecurityContext}
 */
aurora.db.Authenticator.prototype.makeServerInfo_ = function(socket, context) {
    let host = aurora.db.Authenticator.formatIp(socket['localAddress']);
    let protocol = socket['encrypted'] ? 'https' : 'http';
    let port = socket['localPort'];
    if ((port == 80 && protocol === 'http') || (port == 443 && protocol === 'https')) {
        port = '';
    }
    else {
        port = ':' + port;
    }
    let fullContext = goog.object.clone(context);
    fullContext['@base-url'] = protocol + '://' + host + port + '';
    return /** @type {!aurora.db.access.SecurityContext} */ (fullContext);
};

/**
 * like aurora.websocket.Server.getChannel however will also add permissions to the channel
 * so the can be checked
 * @param {string} pluginName The name of the plugin that creates the channel.
 * @param {number} channelId The id of the channel. This is managed by the plugin.
 * @param {function(!aurora.websocket.ChannelMessage,!aurora.db.access.SecurityContext)} messageCallback
 * @param {function(string,string)=} opt_clientCloseCallback passes the token and client id closed
 * @return {!aurora.websocket.Channel}
 */
aurora.db.Authenticator.prototype.getChannel = function(pluginName, channelId, messageCallback, opt_clientCloseCallback) {

    let me = this;
    let channel = aurora.websocket.getChannel(pluginName, channelId, function(message) {
        let token = message.token;
        me.getPermissions(token, message.connection.socket, function(context) {messageCallback(message, context);});
    }, opt_clientCloseCallback);

    channel.onAuthRegister = function(cb) {
        channel.onRegister(function(connection, token) {

            me.getPermissions(token, connection.socket, function(context) {
                if (channel.getRegistration()[connection.id]) {
                    cb(connection, token, context);
                }
            });

        });
    };
    return channel;
};
