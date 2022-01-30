goog.provide('aurora.recoil.frp');
goog.provide('aurora.recoil.widgets.inflate');
//goog.require("aurora.string");
//goog.require("aurora.websocket");

goog.require('aurora.WidgetScope');
goog.require('recoil.db.ReadWriteDatabase');
goog.require('recoil.frp.Frp');
//goog.require('recoil.mysql.DBComms');

/**
 * @final
 * @type {!recoil.frp.Frp}
 */
aurora.recoil.frp = new recoil.frp.Frp();

/**
 * @export
 * @param {!recoil.ui.WidgetScope} scope The scope context
 */
aurora.recoil.widgets.inflate = function(scope) {
    function domParse(html) {
        var element = document.createElement('div');
        element.innerHTML = html;
        return element.children;
    }


    //var comms = new recoil.mysql.DBComms();
    //var database = new recoil.db.ReadWriteDatabase(frp, comms);

    var widgetInstances = {};
    function inflateWidgets(element) {
        //console.log("Recoil Widget Loader inflateWidgets");
        let widget_name = element.getAttribute('data-recoil-widget');
        let widget_param = element.getAttribute('data-recoil-widget-param');
        if (widget_name) {
            if (widget_name.indexOf('.') !== -1) {
                if (element['$.widget.loaded']) {
                    return;
                }
                try {
                    var cls = eval(widget_name);
                    if (cls instanceof Function) {
                        if (widgetInstances[widget_name] === undefined) {
                            widgetInstances[widget_name] = [];
                        }

                        var args = undefined;
                        if (widget_param != undefined && widget_param.length > 0) {
                            try {args = JSON.parse(widget_param);}
                            catch (e) {console.log('Unable to parse JSON from widget title arguments');console.log(e);}
                        }

                        var widget = new cls(scope, args, element.innerHTML);
						element.innerHTML = "";
                        widget.getComponent().render(element);
                        element['$.widget.loaded'] = true;

                        var instanceId = 'recoil_' + widgetInstances[widget_name].length;
                        widgetInstances[widget_name].push({instanceId: instanceId, widget_name: widget_name, element: element, widget: widget, widgetDef: cls});
                        //console.log(widget_name, 'Loaded');
                    }
                }
                catch (e) {
                    console.error('unable to create widget', widget_name, e);
                }
            }
        }
        for (var i = 0; i < element.children.length; i++) {
            inflateWidgets(element.children[i]);
        }
    }
    //console.log('Recoil Widget Loader');
    inflateWidgets(document.body);
};
