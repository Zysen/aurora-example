goog.provide('budget.widgets.Bookings');

goog.require('aurora.Client');
goog.require('aurora.db.schema.tables.base.user');
goog.require('budget.messages');
goog.require('goog.dom');
goog.require('goog.dom.classlist');
goog.require('goog.object');
goog.require('goog.positioning.Corner');
goog.require('goog.ui.MenuItem');
goog.require('goog.ui.PopupMenu');
goog.require('recoil.frp.logic');
goog.require('recoil.structs.table.Filter');
goog.require('recoil.ui.BoolWithExplanation');
goog.require('recoil.ui.columns.Expr');
goog.require('recoil.ui.frp.LocalBehaviour');
goog.require('recoil.ui.widgets.table.TableWidget');
goog.require('recoil.ui.widgets.table.TextAreaColumn');

/**
 * @constructor
 * @export
 * @param {!budget.WidgetScope} scope
 * @implements {recoil.ui.Widget}
 */
budget.widgets.Bookings = function(scope) {
    this.scope_ = scope;
    let me = this;
    let frp = scope.getFrp();
    let mess = budget.messages;
    let amess = aurora.messages;
    let cd = goog.dom.createDom;
    let siteT = aurora.db.schema.tables.base.site;
    let holidaysT = aurora.db.schema.tables.base.site_holidays;
    let appointmentsT = aurora.db.schema.tables.base.appointments;
    let mentorT = aurora.db.schema.tables.base.mentor;
    let availT = aurora.db.schema.tables.base.mentor_availablity;
    let milliPerDay = budget.widgets.BusinessHours.MILLI_PER_DAY;
    let today = new Date();
    today.setHours(0, 0, 0, 0);
    this.curDateB_ = frp.createB(recoil.ui.widgets.DateWidget2.convertDateToLocal(today));
    let mentorsB = scope.getDb().get(mentorT.key);
    this.appointmentsB_ = frp.switchB(frp.liftB(function(date) {
        let query = new recoil.db.Query();
        let startTime = recoil.ui.widgets.DateWidget2.convertLocaleDate(date).getTime();
        let endTime = budget.widgets.BusinessHours.addDays(startTime, 7);

        return scope.getDb().get(appointmentsT.key, query.and(
            query.gt(query.field(appointmentsT.cols.stop), query.val(startTime)),
            query.lt(query.field(appointmentsT.cols.start), query.val(endTime))
        ));

    }, this.curDateB_));

    this.holidaysB_ = frp.switchB(frp.liftB(function(date) {
        let query = new recoil.db.Query();
        let startTime = recoil.ui.widgets.DateWidget2.convertLocaleDate(date).getTime();
        let endTime = budget.widgets.BusinessHours.addDays(startTime, 7);

        return scope.getDb().get(holidaysT.key, query.and(
            query.gt(query.field(holidaysT.cols.stop), query.val(startTime)),
            query.lt(query.field(holidaysT.cols.start), query.val(endTime))
        ));

    }, this.curDateB_));

    this.availableB_ = frp.switchB(frp.liftB(function(date) {
        let query = new recoil.db.Query();
        let startTime = recoil.ui.widgets.DateWidget2.convertLocaleDate(date).getTime();
        let endTime = budget.widgets.BusinessHours.addDays(startTime, 7);
        return scope.getDb().get(
            availT.key,
            query.and(
                query.or(
                    query.gt(query.field(availT.cols.stop), query.val(startTime)),
                    query.null(query.field(availT.cols.stop))),
                query.lt(query.field(availT.cols.start), query.val(endTime)))
        );

    }, this.curDateB_));


    this.siteB_ = scope.getDb().get(siteT.key);
    let dateDiv = cd('div', 'budget-date');
    let bookingsDiv = cd('div', 'budget-bookings');
    let dateCol = new recoil.ui.columns.Date2(appointmentsT.cols.start, '');
    this.containerDiv_ = cd('div', {class: 'budget-bookings'}, dateDiv, bookingsDiv);

    this.container_ = budget.widgets.BusinessHours.createWidgetDom('div', {}, this.containerDiv_);

    this.dateWidget_ = new recoil.ui.widgets.DateWidget2(scope);
    this.dateWidget_.attachStruct({value: this.curDateB_, min: 19700105, step: 1});
    this.dateWidget_.getComponent().render(dateDiv);

    this.component_ = recoil.ui.ComponentWidgetHelper.elementToNoFocusControl(this.container_);
    this.tableWidget_ = new recoil.ui.widgets.table.TableWidget(scope);
    let mentorConverterB = frp.liftB(function(mentors) {
        let map = budget.widgets.Bookings.generateUniqueNameMap(mentors);
        return {
            convert: function(v) {
                return map[v] || 'Unknown Mentor ' + v;
            },
            unconvert: function(v) {
                return {error: null, value: null};

            }
        };
    }, mentorsB);
    let idMap = {};
    let getId = function(mentor, time) {
        let key = mentor + ':' + time;
        let res = idMap[key];
        if (!res) {
            res = appointmentsT.info.pk.getDefault();
            idMap[key] = res;
        }
        return res;

    };
    let tableB = frp.liftBI(function(site, holidays, appointments, avail, startDate, mentorConverter) {
        // this reuses the some columns so we can get the meta data
        let table = appointments.createEmpty();
        // make the key an array of [time, mentor] we get the right order


        let startTime = recoil.ui.widgets.DateWidget2.convertLocaleDate(startDate).getTime();
        let endTime = budget.widgets.BusinessHours.addDays(startTime, 7);

        let apptMap = budget.widgets.Bookings.makeAppointmentMap_(avail, holidays, appointments, startTime, endTime);

        let columns = new recoil.ui.widgets.TableMetaData();
        columns.add(appointmentsT.cols.showed, 'Came', {displayLength: 20});
        columns.addColumn(new recoil.ui.columns.Time(appointmentsT.cols.start, 'Time'));
        columns.add(appointmentsT.cols.mentorid, 'Mentor');
        columns.add(appointmentsT.cols.name, 'Client Name');
        columns.add(appointmentsT.cols.address, 'Client Address');
        columns.add(appointmentsT.cols.email, 'Client Email');
        columns.add(appointmentsT.cols.phone, mess.PHONE);
        columns.add(appointmentsT.cols.scheduled, 'Scheduled');
        table.addColumnMeta(appointmentsT.cols.start, {editable: false});
        table.addColumnMeta(appointmentsT.cols.mentorid, {editable: false, converter: mentorConverter});
        table.addColumnMeta(appointmentsT.cols.name, {displayLength: 20});
        table.addColumnMeta(appointmentsT.cols.address, {displayLength: 20});
        table.addColumnMeta(appointmentsT.cols.email, {displayLength: 20});

        let pos = 0;
        let prevDay = null;
        apptMap.inOrderTraverse(function(entry) {
            let today = new Date(entry.key[0]);
            let now = new Date(entry.key[0]);
            today.setHours(0, 0, 0, 0);
            if (prevDay !== today.getTime()) {
                let row = new recoil.structs.table.MutableTableRow(pos++);
                row.set(appointmentsT.cols.showed, false);

                row.addCellMeta(appointmentsT.cols.start, /** @type {!Object} */(dateCol.getMeta({
                    editable: false, cellDecorator: recoil.ui.widgets.TableMetaData.createSpanDecorator(8, {class: 'budget-seperator-row'})})));
                row.addRowMeta({cellDecorator: null});

                row.set(appointmentsT.cols.start, recoil.ui.widgets.DateWidget2.convertDateToLocal(today));
                row.set(appointmentsT.cols.stop, null);
                row.set(appointmentsT.cols.mentorid, entry.key[1]);
                row.set(appointmentsT.cols.name, '');
                row.set(appointmentsT.cols.address, '');
                row.set(appointmentsT.cols.email, '');
                row.set(appointmentsT.cols.phone, '');
                row.set(appointmentsT.cols.scheduled, false);
                row.set(appointmentsT.cols.userid, null);
                table.addRow(row);



            }
            prevDay = today.getTime();

            console.log('appointments', entry);
            if (entry.avail.length === 0) {
                let row = new recoil.structs.table.MutableTableRow(pos++);
                row.set(appointmentsT.cols.id, getId(entry.key[1], now));
                row.set(appointmentsT.cols.showed, false);
                row.set(appointmentsT.cols.start, recoil.ui.widgets.TimeWidget.convertTimeToLocal(now));
                row.set(appointmentsT.cols.stop, entry.stop);
                row.set(appointmentsT.cols.mentorid, entry.key[1]);
                row.set(appointmentsT.cols.name, '');
                row.set(appointmentsT.cols.address, '');
                row.set(appointmentsT.cols.email, '');
                row.set(appointmentsT.cols.phone, '');
                row.set(appointmentsT.cols.scheduled, false);
                row.set(appointmentsT.cols.userid, null);
                table.addRow(row);
            }
            else {
                entry.avail.forEach(function(inRow) {
                    let row = inRow.unfreeze();
                    row.set(appointmentsT.cols.start, recoil.ui.widgets.TimeWidget.convertTimeToLocal(row.get(appointmentsT.cols.start)));
                    row.set(appointmentsT.cols.start, recoil.ui.widgets.TimeWidget.convertTimeToLocal(row.get(appointmentsT.cols.start)));
                    row.setPos(pos++);
                    table.addRow(row);
                });
            }
        });
        return columns.applyMeta(table);

    }, function(site) {
        //me.siteB_.set(site);
    }, this.siteB_, this.holidaysB_, this.appointmentsB_, this.availableB_, this.curDateB_, mentorConverterB);
    this.tableWidget_.attachStruct(tableB);
    this.tableWidget_.getComponent().render(this.containerDiv_);

};

/**
 * @private
 * @param {!recoil.structs.table.Table} avail a table containing what time each mentor is available
 * @param {!recoil.structs.table.Table} holidays a table containing the periods holidays
 * @param {!recoil.structs.table.Table} appointments a table containing already scheduled appoinments
 * @param {number} startTime time in mill since epoch
 * @param {number} endTime time in mill since epoch
 * @return {!goog.structs.AvlTree}
 */
budget.widgets.Bookings.makeAppointmentMap_ = function(avail, holidays, appointments, startTime, endTime) {
    let holidaysT = aurora.db.schema.tables.base.site_holidays;
    let appointmentsT = aurora.db.schema.tables.base.appointments;
    let availT = aurora.db.schema.tables.base.mentor_availablity;
    let mentorDayUsage = {};
    let apptMap = new goog.structs.AvlTree(recoil.util.object.compareKey);

    let getAppointmentLength = function(lengths, start) {
        for (let i = 0; i < lengths.length; i++) {
            let item = lengths[i];
                if (start >= item.start && start < item.stop) {
                    return item.len;
                }
        }
        return null;
    };
    let inHoliday = function(start, stop) {
        let res = false;
        holidays.forEach(function(row) {
            let hStart = row.get(holidaysT.cols.start);
            let hStop = row.get(holidaysT.cols.stop);
            if (stop > hStart && start < hStop) {
                res = true;
            }

        });
        return res;
    };


    avail.forEach(function(row) {
        budget.widgets.BusinessHours.iterateOverPeriod(row, startTime, endTime, function(start, stop) {
            let len = row.get(availT.cols.appointmentLen) * 60000;
            let mentor = row.get(availT.cols.mentorid).db;
            let info = recoil.util.map.safeGet(mentorDayUsage, mentor, {free: [], lengths: []});
            if (!inHoliday(start, stop)) {
                info.free.push({start: start, stop: stop});
                info.lengths.push({start: start, stop: stop, len: len});
            }
        });
    });
    let mentorAppointments = budget.widgets.Bookings.makeMentorAppointmentMap_(appointments);

    for (let mentor in mentorDayUsage) {
        let usage = mentorDayUsage[mentor];
        budget.widgets.BusinessHours.mergeDayUsage(usage.free, true);
        usage.free.forEach(function(entry) {
            let start = entry.start;
            let len = getAppointmentLength(usage.lengths, start);
            while (len != null && start + len <= entry.stop) {
                apptMap.add({key: [start, mentor], stop: start + len, avail: mentorAppointments(mentor, start, start + len)});
                start += len;
                len = getAppointmentLength(usage.lengths, start);
            }

        });

    }
    return apptMap;
};

/**
 * @private
 * @param {!recoil.structs.table.Table} appointments a table containing already scheduled appoinments
 * @return {function(string, number,number):Array} return a function that can lookup what appointments are for a time period
 */
budget.widgets.Bookings.makeMentorAppointmentMap_ = function(appointments) {
    let map = {};
    let appointmentsT = aurora.db.schema.tables.base.appointments;

    appointments.forEach(function(row) {
        let mentor = row.get(appointmentsT.cols.mentorid).db;
        recoil.util.map.safeGet(map, mentor, []).push({start: row.get(appointmentsT.cols.start), stop: row.get(appointmentsT.cols.stop), row: row});

    });

    return function(mentor, start, stop) {
        let res = [];
        let list = map[mentor] || [];

        for (let i = 0; i < list.length; i++) {

            if (stop > list[i].start && start < list[i].stop) {
                res.push(list[i].row);
            }
        }
        return res;

    };


};
/**
 * @param {!recoil.structs.table.Table} mentors
 * @return {Object}
 */
budget.widgets.Bookings.generateUniqueNameMap = function(mentors) {
    let accepted = {};
    let seen = {}; // times an item is seen should never be more than 1
    let todo = {};
    let mentorT = aurora.db.schema.tables.base.mentor;


    function getName(row) {
        if ((row.get(mentorT.cols.firstName) || '').trim().length > 0) {
            return row.get(mentorT.cols.firstName);
        }
        else {
            return row.get(mentorT.cols.username);
        }
    }
    function getUser(row) {
        return row.get(mentorT.cols.username);
    }

    mentors.forEach(function(row) {
        todo[row.get(mentorT.cols.id).db] = row;
    });



    let genNames = function(nameGen) {
        let curSeen = goog.object.clone(seen);
        for (let id in todo) {
            let name = nameGen(todo[id]);
            curSeen[name] = (curSeen[name] || 0) + 1;
        }

        for (let id in todo) {
            let name = nameGen(todo[id]);
            if (curSeen[name] == 1) {
                accepted[id] = name;
            }
        }
        for (let id in accepted) {
            seen[accepted[id]] = 1;
            delete todo[id];
        }
    };
    genNames(getName);
    for (let id in todo) {
        let i = 1;
        let name = getName(id) + '(' + i + ')';
        while (seen[name]) {
            i++;
            name = getName(id) + '(' + i + ')';
        }
        seen[name] = 1;
        accepted[id] = name;
    }
    return accepted;
};
/**
 * @return {!goog.ui.Component}
 */
budget.widgets.Bookings.prototype.getComponent = function() {
    return this.component_;
};


/**
 * all widgets should not allow themselves to be flatterned
 *
 */
budget.widgets.Bookings.prototype.flatten = recoil.frp.struct.NO_FLATTEN;

