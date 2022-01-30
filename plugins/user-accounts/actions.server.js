goog.provide('myapplication.actions');

goog.require('aurora.log');
goog.require('aurora.permissions');
goog.require('config');
goog.require('recoil.db.Query');

/**
 * @param {!aurora.db.Coms} coms
 * @param {!aurora.db.access.SecurityContext} context
 * @param {!aurora.db.Reader} reader
 * @param {!Array} inputs
 * @param {function (?, !Array)} callback (error, outputs)
 */
myapplication.actions.checkUsername = function(coms, context, reader, inputs, callback) {

};

/**
 * @param {!aurora.db.Coms} coms
 * @param {!aurora.db.access.SecurityContext} context
 * @param {!aurora.db.Reader} reader
 * @param {!Array} inputs
 * @param {function (?, !Array)} callback (error, outputs)
 */
myapplication.actions.suggestUsername = function(coms, context, reader, inputs, callback) {
    let failCb = function(err) {callback(err, []);};

    if (inputs instanceof Array) {
        let object = {};

        for (let i = 0; i < inputs.length; i++) {
            let input = inputs[i];
            for (let k in input) {
                object[k] = input[k];
            }
        }
        let userT = aurora.db.schema.tables.base.user;
        // don't allow specification of primary key

        let username = object[userT.cols.username.getName()];
        if (username && typeof(username) !== 'string') {
            callback('invalid username', []);
            // error here we use username length in sql
            return;
        }
        let firstName = object[userT.cols.firstName.getName()];
        let lastName = object[userT.cols.lastName.getName()];

        if (!username || username.trim().length === 0) {

            if (firstName && firstName.trim().length !== 0) {
                username = firstName.trim();
            }
            if (lastName && lastName.trim().length !== 0) {
                if (username && username.length > 0) {
                    username += '.' + lastName;
                }
                else {
                    username = lastName;
                }

            }
        }
        if (!username || username.trim().length === 0) {
            username = 'user1';
        }

        username = username.toLowerCase();
        // sanatize so username has no regex chars
        reader.query('SELECT username FROM `user` WHERE username = ?username', {'username': username}, function(err, result) {
            if (err) {
                callback(err, []);
                return;
            }
            else if (result.length === 0) {
                callback(null, username);
                return;
            }
            username = username.replace(/[0-9+]$/, '');
            username = username.replace(/\^|\$|\*|\+|\?|\||\(|\)|\\|\{|\}|\[|\]/g, '_');
            reader.query('SELECT max(cast(substring(username,?len) as UNSIGNED )) username FROM `user` WHERE username rlike ?username', {'len': (username.length + 1) , 'username': username.replace(/\./g, '\\.') + '[0-9]*'}, function(err, result) {
                if (err) {
                    callback(err, []);
                }
                else if (result.length === 0) {
                    callback(null, username);
                }
                else {
                    let max = result[0]['username'];
                    max = max == null ? 0 : max;
                    callback(null, username + (max + 1));
                }
            });
        });
    }
    else {
        callback('Invalid Parameters Passed', []);
    }

};

/**
 * will get email login details, if doesn't exist will create one
 * @param {?} secContext
 * @param {function (?, ?, ?, ?)} callback (error, transport, emailInfo, previewer)
 */
myapplication.actions.getEmailTransporterInfo_ = function(secContext, callback) {
    const nodemailer = require('nodemailer');

    let emailInfo = {
        from: '"No Reply" <no-reply@example.com>',
        to: null, // list of receivers
        replace: function(email, user, url) {
            let clone = goog.object.clone(emailInfo);
            clone.text = emailInfo.text.replaceAll('$url$', url).replaceAll('$user$', user);
            clone.html = emailInfo.html.replaceAll('$url$', url).replaceAll('$user$', goog.string.htmlEscape(user));
            clone.to = email;
            return clone;
        }
    };

    let mailInfo = aurora.SystemSettings.instance.getSettings('email', ((config.authentication) || {}).mail);

    if (mailInfo) {
        let url = secContext['@base-url'] + '/account/do-reset?id=$url$';
        emailInfo.from = mailInfo.from || '"No Reply" <no-reply@example.com>';
        emailInfo.text = mailInfo.text || 'Hello $user$\nTo reset your password go to ' + url + '.';
        emailInfo.html = mailInfo.html || '<body>Hello <b>$user$</b><br>To reset your password go to <a href="' + url + '">' + url + '.</a></body>';
        emailInfo.subject = mailInfo.subject || 'Password Reset Request';

    }
    if (mailInfo && mailInfo.auth) {
        callback(null, nodemailer.createTransport(mailInfo), emailInfo, function(info) {});
    }
    else {
        nodemailer.createTestAccount().then(
            function(testAccount) {
                // create reusable transporter object using the default SMTP transport
                callback(null, nodemailer.createTransport({
                    host: 'smtp.ethereal.email',
                    port: 587,
                    secure: false, // true for 465, false for other ports
                    auth: {
                        user: testAccount.user, // generated ethereal user
                        pass: testAccount.pass, // generated ethereal password
                    },
                }), emailInfo, function(info) {
                        // Preview only available when sending through an Ethereal account
                    aurora.log.createModule('RESET-PASSWORD').warn('EMAIL not configured test message:', nodemailer.getTestMessageUrl(info));
                });


            }, function(err) {
                callback(err, null, null, null);
            }

        );
    }
};

/**
 * @param {!aurora.db.Coms} coms
 * @param {!aurora.db.access.SecurityContext} context
 * @param {!aurora.db.Reader} reader
 * @param {!Array} inputs
 * @param {function (?, !Array)} callback (error, outputs)
 */
myapplication.actions.requestResetPassword = function(coms, context, reader, inputs, callback) {
    let fixError = function(err) {
        if (err && err.response) {
            return err.response;
        }
        else if (err && err.message) {
            return err.message;
        }
        return err;

    };
    const crypto = require('crypto');
    const async = require('async');
    const RESET_KEY_LEN = aurora.db.schema.getMeta(aurora.db.schema.tables.base.user.cols.resetcode).maxLength / 2; // 2 per byte

    // Generate test SMTP service account from ethereal.email
    // Only needed if you don't have a real mail account for testing
    let mod = 'RESET-PASSWORD';

    if (!(inputs instanceof Array) || inputs.length !== 1 || typeof(inputs[0]) != 'string') {
        aurora.log.createModule(mod).error('invalid password inputs', inputs);
        callback('invalid inputs', []);
        return;
    }
    let email = inputs[0];
    let query = new recoil.db.Query();
    let userT = aurora.db.schema.tables.base.user;
    myapplication.actions.getEmailTransporterInfo_(context, function(err, transporter, emailInfo, previewer) {
        if (err) {
            aurora.log.createModule(mod).error('unable to create email info', err);
            callback('Unable able to create email', []);
            return;
        }
        reader.readObjects(context, userT, query.eq(userT.cols.email, query.val(email)), null, function(err, data) {
            if (err) {
                aurora.log.createModule(mod).error('error reading db', err);
                callback(err, []);
            }
            else if (data.length == 0) {
                aurora.log.createModule(mod).warn('Attempt to reset invalid for', email);
                callback(null, []);
            }
            else {

                // multiple users may have same email reset them all but only respond to the first one non errored one
                let callbackDone = false;
                let errors = [];
                let successes = 0;
                async.eachSeries(data, function(user, cb) {
                    aurora.log.createModule(mod).info('Password Reset Requested for ', email);
                    let resetCode = crypto.randomBytes(RESET_KEY_LEN).toString('hex');
                    let resetId = resetCode + '_' + user.id;
                    let toSend = emailInfo.replace(email, user.username, resetId);
                    reader.updateOneLevel(context, userT, {resetcode: resetCode, resetcodetimeout: new Date().getTime()}, query.eq(user.id, query.val(user.id)), function(err) {
                        if (err) {
                            errors.push(err);
                            cb();
                            return;
                        }
                        transporter.sendMail(toSend).then(function(info) {
                            previewer(info);
                            successes++;
                            cb();
                        }, function(err) {
                            // Preview only available when sending through an Ethereal account
                            aurora.log.createModule(mod).error('failed to send email', err);
                            errors.push(err);
                            cb();
                        });
                    });

                }, function(err) {
                    if (successes || errors.length === 0) {
                        callback(null, []);
                    }
                    else {
                        callback(fixError(errors[0]), []);
                    }
                });

            }
        });
    });
};

/**
 * @param {!aurora.db.access.SecurityContext} context
 * @param {!aurora.db.Reader} reader
 * @param {!Array} groups
 * @param {function(!Object)} callback map of permissions to true
 *
 */
myapplication.actions.getGroupPermissions_ = function(context, reader, groups, callback) {
    let groupT = aurora.db.schema.tables.base.group;
    let permissionT = aurora.db.schema.tables.base.permission;
    let query = new recoil.db.Query();
    reader.readObjects(
        context, groupT,
        query.isIn(groupT.cols.id, groups), null, function(err, groups) {
            if (err) {
                callback({});
            }
            else {
                let permissions = [];
                for (let i = 0; i < groups.length; i++) {
                    let g = groups[i];
                    for (let j = 0; j < g.permission.length; j++) {
                        permissions.push(g.permission[j].permissionid);
                    }
                }

                reader.readObjects(
                    {}, permissionT,
                    query.isIn(permissionT.cols.id, permissions), null, function(err, perms) {
                        let res = {};
                        if (!err) {
                            perms.forEach(function(el) {
                                res[el.name] = true;
                            });
                        }
                        callback(res);
                    });

            }
        });

};


/**
 * @param {!aurora.db.Coms} coms
 * @param {!aurora.db.access.SecurityContext} context
 * @param {!aurora.db.Reader} reader
 * @param {number} userid
 * @param {?string} oldPassword
 * @param {?string} password
 * @param {function(?,!Array)} callback1 params are error, mentor user
 */
myapplication.actions.changePassword = function(coms, context, reader, userid, oldPassword, password, callback1) {
	let admin = context.userid != userid; // no admin level password change if changing own password
	if (!aurora.permissions.has('user-management')(context)) {
		admin = false;
        if (context.userid != userid) {
            callback1('Access Denied', []);
			return;
        }
    }

	if (password == '') {
		password = null;
	}
	if (context.userid == userid && password == null) {
        callback1('Access Denied', []);
    }

    let userT = aurora.db.schema.tables.base.user;
    let query = new recoil.db.Query();
	let userQuery = query.eq(userT.cols.id, query.val(userid));

	let updatePassword = function(password, reader, transCallback) {
		reader.updateOneLevel(
			{}, userT, {'password': password},
			userQuery, function(err) {
				if (err) {
					transCallback('Unable to  update password', []);
				}
				else {
					transCallback(null, []);
				}
			});
	};



    let update = function(value) {
        reader.transaction(function(reader, transCallback) {
            if (admin) {
			    updatePassword(value, reader, transCallback);
		    }
            else {
                let user = null;
		        reader.readLevel({}, userT, userQuery, null, function(entry, cb) {
                    user = entry;
                    cb();
                }, function(err) {
			        if (err) {
                        transCallback(err);
			        }
			        else if (user === null) {
				        transCallback('No such user');
			        }
			        else {
				        aurora.db.Pool.checkPassword(oldPassword, user.password, function(valid) {
					        if (valid) {
						        updatePassword(value, reader, transCallback);
					        }
					        else {
						        transCallback('Access Denied');
					        }

				        });
			        }
                });

		    }
        },function(err) {
            callback1(err, []);

        });
    };


    if (password) {
        aurora.db.Pool.hashPassword(password, function(err, value) {
		    if (err) {
			    callback1('Unable to hash password', []);
		    }
		    else {
                update(value);
            }
        });
    }
    else {
        update(password);
    }



};


/**
 * @param {!aurora.db.Coms} coms
 * @param {!aurora.db.access.SecurityContext} context
 * @param {!aurora.db.Reader} reader
 * @param {number} uid
 * @param {string} secret
 * @param {string} password
 * @param {function(?, !Array)} callback (error, outputs)
 */
myapplication.actions.doResetPassword = function(coms, context, reader, uid, secret, password, callback) {
    let mod = 'RESET-PASSWORD';
    let log = aurora.log.createModule(mod);

    log.info('resetting password for userid', uid);
    let userT = aurora.db.schema.tables.base.user;
    let query = new recoil.db.Query();
    let delay = ((config.authentication) || {}).resetTimeout || (24 * 3600000); // default 24 hours
    reader.readObjects(context, userT, query.and(
        query.eq(userT.cols.resetcode, query.val(secret)),
        query.eq(userT.cols.id, query.val(uid))), null, function(err, data) {
            if (err || data.length != 1) {
                callback('Unable to reset password', []);
            }
            else if (data[0].resetcodetimeout + delay < new Date().getTime()) {
                callback('Password reset password expired.', []);
            }
            else {
                let user = data[0];
                aurora.db.Pool.hashPasswordPromise(password).then(function(pword) {
                    reader.updateOneLevel(context, userT, {resetcode: null, resetcodetimeout: null, password: pword}, query.eq(user.id, query.val(user.id)), function(err) {
                        callback(err, []);
                    });
                }, function(err) {
                    callback(err, []);
                });
            }
        });
};