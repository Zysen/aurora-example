goog.provide('myapplication.widgets.Login');

goog.require('goog.dom');
goog.require('goog.net.XhrIo');
goog.require('goog.net.cookies');
goog.require('myapplication.messages');
goog.require('recoil.ui.BoolWithExplanation');
goog.require('recoil.ui.frp.LocalBehaviour');
goog.require('recoil.ui.widgets.ButtonWidget');
goog.require('recoil.ui.widgets.CheckboxWidget');
goog.require('recoil.ui.widgets.InputWidget');
goog.require('recoil.ui.widgets.PasswordWidget');


/**
 * @constructor
 * @export
 * @param {!myapplication.WidgetScope} scope
 * @param {{groups:!Array<string>, searchOnly:(boolean|undefined)}} options
 * @param {string} htmlTemplate
 * @implements {recoil.ui.Widget}
 */
myapplication.widgets.Login = function(scope, options, htmlTemplate) {
	this.scope_ = scope;
    let frp = scope.getFrp();
    let mess = myapplication.messages;
    let cd = goog.dom.createDom;
    let uname = cd('div');
    let password = cd('div');
    let login = cd('div');
    let remember = cd('div', {class: 'goog-inline-block'});
    let loginButton = new recoil.ui.widgets.ButtonWidget(scope);
    let usernameWidget = new recoil.ui.widgets.InputWidget(scope, true);
    let passwordWidget = new recoil.ui.widgets.PasswordWidget(scope, true);
    let rememberB = recoil.ui.frp.LocalBehaviour.create(frp, myapplication.Client.VERSION, 'myapplication-remember-me', false, localStorage);
    let rememberCheck = new recoil.ui.widgets.CheckboxWidget(scope);
    let usernameB = frp.createB('');
    let passwordB = frp.createB('');
    rememberCheck.attachStruct({value: rememberB});
    usernameWidget.attachStruct({value: usernameB, immediate: true});
    passwordWidget.attachStruct({value: passwordB, immediate: true});

    usernameWidget.getComponent().render(uname);
    passwordWidget.getComponent().render(password);

    usernameWidget.focus();

    let busyB = frp.createB(false);
    let BWE = recoil.ui.BoolWithExplanation;

    let loginEnabledB = frp.liftB(function(busy, username, password) {
        if (busy) {
            return new BWE(false, undefined, mess.LOGGING_IN);
        }
        if (!username) {
            // this is to deal with a bug that seems not to populate the username if it auto poplated, until the user does something
            //return new BWE(false, undefined, mess.MUST_SPECIFY.resolve({field: mess.USERNAME.toString()}));
            return BWE.TRUE;
        }
        if (!password) {
            return new BWE(false, undefined, mess.MUST_SPECIFY.resolve({field: mess.PASSWORD.toString()}));
        }

        return BWE.TRUE;
    }, busyB, usernameB, passwordB);
    let message = cd('div', {class: 'myapplication-login-message'});

    let loginActionB = frp.createCallback(function(e) {
        let content = 'username=' + encodeURIComponent(usernameB.get())
            + '&password=' + encodeURIComponent(passwordB.get());

        if (rememberB.get()) {
            content += '&remember=true';
        }
        goog.dom.setTextContent(message, '');
        busyB.set(true);
        goog.net.XhrIo.send('/login', function(e) {
            frp.accessTrans(function() {
                busyB.set(false);
                let xhr = e.target;
                let obj = xhr.getResponseJson();
                if (xhr.isSuccess()) {
                    if (obj.status) {

                        let loginLoc = '/';
                        try {
                            let perms = JSON.parse(decodeURIComponent(/** @type {string}*/(goog.net.cookies.get('permissions'))));
                            if (perms['user-management']) {
                                loginLoc = '/admin/users';
                            } else if (perms.client) {
                                loginLoc = '/client';
                            }
                            console.log('login response', perms);

                        } catch (e) {}
                        console.log('logged in', obj);
                        window.location.replace(loginLoc);
                    }
                    else {
                        console.log('not logged in', obj);
                        goog.dom.setTextContent(message, obj.message);
                    }
                }
            }, busyB);
        }, 'POST', content);
    }, busyB, rememberB, passwordB, usernameB);

    loginButton.attachStruct({
        action: loginActionB,
        text: mess.LOGIN,
        enabled: loginEnabledB
    });

    loginButton.getComponent().render(login);
    rememberCheck.getComponent().render(remember);
	
	let container = cd('div', {});
	container.innerHTML = htmlTemplate;
	
	myapplication.widgets.Login.processTemplate(container, {
		"{USERNAME_INPUT}":uname,
		"{PASSWORD_INPUT}":password,
		"{REMEMBERME_INPUT}":remember,
		"{LOGIN_BUTTON}":login	
	});

    goog.events.listen(container, goog.events.EventType.KEYDOWN, function(e) {

        if (e.keyCode === goog.events.KeyCodes.ENTER) {
            frp.accessTrans(function() {
                loginActionB.set(e);
            }, loginActionB);
        }
    });

    let alreadyLoggedIn = cd('div', {}, 'You are already logged in');

    let loggedIn = goog.net.cookies.get('username');

    this.component_ = recoil.ui.ComponentWidgetHelper.elementToNoFocusControl(loggedIn ? alreadyLoggedIn : container);

    usernameWidget.focus();


};

/**
 * @param {string} templateElement
 * @param {Object.<string,Element>=} widgetMap
 * @implements {recoil.ui.Widget}
 */
myapplication.widgets.Login.processTemplate = function(templateElement, widgetMap) {
	for(let search in widgetMap){
		if(templateElement.innerHTML.trim()===search){			//This only works when the template tag has no siblings.
			templateElement.innerHTML = "";
			templateElement.appendChild(widgetMap[search]);
			return;
		}
	}
	for(let child of templateElement.children){
		myapplication.widgets.Login.processTemplate(child, widgetMap);
	}
};


/**
 * @return {!goog.ui.Component}
 */
myapplication.widgets.Login.prototype.getComponent = function() {
    return this.component_;
};


/**
 * all widgets should not allow themselves to be flatterned
 *
 */

myapplication.widgets.Login.prototype.flatten = recoil.frp.struct.NO_FLATTEN;

