goog.provide('aurora.columns.Link');
goog.provide('aurora.ui.widgets.LinkWidget');

goog.require('goog.dom');
goog.require('goog.events.EventType');
goog.require('recoil.frp.Behaviour');
goog.require('recoil.ui.Widget');
goog.require('recoil.ui.message');
goog.require('recoil.ui.messages');
goog.require('ui.dom');

/**
 * @implements {recoil.ui.Widget}
 * @param {!recoil.ui.WidgetScope} scope
 * @constructor
 */
aurora.ui.widgets.LinkWidget = function(scope) {
    this.scope_ = scope;
    this.container_ = goog.dom.createDom('a', {class: 'aurora-link-widget'}, goog.dom.createDom('div', {}));
    this.component_ = recoil.ui.ComponentWidgetHelper.elementToNoFocusControl(this.container_);
    this.helper_ = new recoil.ui.ComponentWidgetHelper(scope, this.component_, this, this.updateValue_);
};
/**
 * attachable behaviours for widget
 */
aurora.ui.widgets.LinkWidget.options = recoil.ui.util.StandardOptions('value', {text: '', formatter: function(txt) {return txt;}});

/**
 * @param {!recoil.frp.Behaviour<Object>|Object} options if this is undefined then use attache
 */
aurora.ui.widgets.LinkWidget.prototype.attachStruct = function(options) {
    let frp = this.helper_.getFrp();
    let bound = aurora.ui.widgets.LinkWidget.options.bind(frp, options);
    this.valueB_ = bound.value();
    this.textB_ = bound.text();
    this.formatterB_ = bound.formatter();
    this.helper_.attach(this.valueB_, this.textB_, this.formatterB_);
};
/**
 * @return {!goog.ui.Component}
 */
aurora.ui.widgets.LinkWidget.prototype.getComponent = function() {
    return this.component_;
};

/**
 * @param {!recoil.ui.ComponentWidgetHelper} helper
 * @private
 */
aurora.ui.widgets.LinkWidget.prototype.updateValue_ = function(helper) {
    let value = helper.isGood() ? this.valueB_.get() : null;
    this.container_.href = value;
    let text = helper.isGood() ? this.formatterB_.get()(this.textB_.get()) : '';
    goog.dom.removeChildren(this.container_);
    if (text instanceof Element) {
        goog.dom.appendChild(this.container_, text);
    }
    else if (text && text != '') {
        this.container_.innerText = text;
    }
    else {
        this.container_.appendChild(goog.dom.createDom('div', {}));
    }
    goog.style.setElementShown(this.container_, !!value);
};

/**
 * all widgets should not allow themselves to be flatterned
 *
 * @type {!Object}
 */

aurora.ui.widgets.LinkWidget.prototype.flatten = recoil.frp.struct.NO_FLATTEN;

/**
 * @implements {recoil.ui.widgets.table.Column}
 * @template T
 * @constructor
 * @param {!recoil.structs.table.ColumnKey} key
 * @param {!recoil.ui.message.Message|string} name
 * @param {Object=} opt_meta
 */
aurora.columns.Link = recoil.ui.widgets.table.makeStructColumn(aurora.ui.widgets.LinkWidget);
