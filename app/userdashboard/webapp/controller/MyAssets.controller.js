sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/ui/core/format/DateFormat",
    "sap/base/i18n/Localization"
], function (Controller, JSONModel, Fragment, DateFormat, Localization) {
    "use strict";

    var DAY = 24 * 60 * 60 * 1000;

    function iso(d) {
        var m = d.getMonth() + 1, day = d.getDate();
        return d.getFullYear() + "-" + (m < 10 ? "0" + m : m) + "-" + (day < 10 ? "0" + day : day);
    }

    return Controller.extend("userdashboard.controller.MyAssets", {

        onInit: function () {
            var that = this;
            this._assets = [];
            this._dateFmt = DateFormat.getDateInstance({ style: "medium" });

            this.getView().setModel(new JSONModel({
                busy: false, error: "",
                language: Localization.getLanguage().slice(0, 2).toLowerCase() === "de" ? "de" : "en",
                employeeId: "", noProfile: "",
                me: { fullName: "", firstName: "", initials: "", subtitle: "" },
                kpi: { assigned: 0, openService: 0, lastAssignment: "-" },
                filters: { search: "", status: "", category: "" },
                options: { statuses: [], categories: [] },
                rows: [],
                notifications: [], notifCount: "0",
                history: { busy: false, assetTag: "", model: "", serialNumber: "", category: "", statusText: "", ledger: [], maintenance: [] }
            }), "my");

            // getResourceBundle() returns a Promise when the i18n model is loaded async
            Promise.resolve(this.getOwnerComponent().getModel("i18n").getResourceBundle()).then(function (bundle) {
                that._bundle = bundle;
                that._loadProfile();
            });
        },

        _t: function (key, args) {
            return this._bundle.getText(key, args);
        },

        // Translate a backend code value (status, action, type, ...) when a text exists, else show it as is.
        _tr: function (prefix, value) {
            var key = prefix + "_" + String(value || "").replace(/\s/g, "");
            return value && this._bundle.hasText(key) ? this._t(key) : (value || "");
        },

        _date: function (s) {
            return s ? this._dateFmt.format(new Date(s + (s.length === 10 ? "T00:00:00" : ""))) : "";
        },

        _serviceUrl: function () {
            var uri = this.getOwnerComponent().getManifestEntry("/sap.app/dataSources/mainService/uri") || "/odata/v4/catalog/";
            return uri.slice(-1) === "/" ? uri : uri + "/";
        },

        _get: function (path) {
            return fetch(this._serviceUrl() + path, {
                headers: { Accept: "application/json", "Accept-Language": Localization.getLanguage() },
                credentials: "same-origin"
            }).then(function (r) {
                if (!r.ok) {
                    return r.text().then(function (t) {
                        var msg = t;
                        try { msg = JSON.parse(t).error.message; } catch (e) { /* keep raw text */ }
                        throw new Error(r.status + " on " + path.split("?")[0] + ": " + msg);
                    });
                }
                return r.json();
            }).then(function (j) { return j.value || []; });
        },

        _fail: function (e) {
            var m = this.getView().getModel("my");
            m.setProperty("/error", this._t("loadError", [e.message]));
            m.setProperty("/busy", false);
        },

        // The signed-in employee is resolved on the server from the login (MyProfileSrv: email = $user).
        _loadProfile: function () {
            var that = this, m = this.getView().getModel("my");
            m.setProperty("/busy", true);
            m.setProperty("/error", "");

            this._get("MyProfileSrv?$select=employee_ID,fullName,email,location,departmentName&$top=1").then(function (res) {
                var emp = res[0];
                if (!emp) {
                    that._resetMine();
                    m.setProperty("/employeeId", "");
                    m.setProperty("/noProfile", that._t("noProfile"));
                    m.setProperty("/busy", false);
                    return;
                }
                m.setProperty("/employeeId", emp.employee_ID);
                return that._loadMine(emp);
            }).catch(this._fail.bind(this));
        },

        _loadMine: function (emp) {
            var that = this, m = this.getView().getModel("my");
            var id = emp.employee_ID;
            var names = String(emp.fullName || "").trim().split(/\s+/);
            m.setProperty("/me", {
                fullName: emp.fullName || "",
                firstName: names[0] || "",
                initials: names.slice(0, 2).map(function (n) { return n.charAt(0).toUpperCase(); }).join(""),
                subtitle: [emp.departmentName, emp.location, emp.email].filter(Boolean).join(" · ")
            });
            m.setProperty("/busy", true);
            m.setProperty("/error", "");

            // Keep notifications outside the Promise callback so they remain available
            // when the maintenance request finishes in the next callback.
            var savedNotifications = [];

            // The service already limits users to their own assets; the holder filter keeps the page
            // personal for admins and managers too.
            return Promise.all([
                this._get("AssetOverviewSrv?$select=asset_ID,assetTag,model,serialNumber,status,warrantyExpiry,categoryName,vendorName,holderLocation" +
                    "&$filter=holderId eq '" + id + "'&$orderby=assetTag&$top=1000"),
                this._get("AssetHistorySrv?$select=transitionDate&$filter=toId eq '" + id +
                    "'&$orderby=transitionDate desc&$top=1"),
                // Persistent approval/rejection/assignment notifications for the signed-in user.
                // CAP applies recipientEmail = $user on NotificationSrv.
                this._get("NotificationSrv?$select=notification_ID,title,message,isRead,createdAt&$orderby=createdAt desc&$top=100")
                    .catch(function () { return []; })
            ]).then(function (res) {
                savedNotifications = res[2] || [];
                that._assets = res[0].map(function (a) {
                    a._category = a.categoryName || that._t("noCategory");
                    a._vendor = a.vendorName || "";
                    a._location = a.holderLocation || that._t("unknownLocation");
                    a._statusText = that._tr("status", a.status);
                    a._statusState = a.status === "Maintenance" ? "Warning" : (a.status === "Assigned" ? "Information" : "None");
                    a._statusIcon = a.status === "Maintenance" ? "sap-icon://wrench" : (a.status === "Assigned" ? "sap-icon://employee" : "");
                    a._warranty = that._warrantyText(a.warrantyExpiry);
                    return a;
                });
                m.setProperty("/kpi/lastAssignment", res[1].length ? that._date(res[1][0].transitionDate) : "-");

                var ids = that._assets.map(function (a) { return a.asset_ID; });
                return ids.length ? that._get("MaintenanceOverviewSrv?$select=maintenance_ID,assetId,status" +
                    "&$filter=assetId in (" + ids.map(function (i) { return "'" + i + "'"; }).join(",") + ") and (status eq 'Open' or status eq 'In Progress')&$top=1000") : [];
            }).then(function (open) {
                m.setProperty("/kpi/assigned", that._assets.length);
                m.setProperty("/kpi/openService", open.length);
                that._buildOptions();
                that._refresh();
                that._buildNotifications(open, savedNotifications);
                m.setProperty("/busy", false);
            }).catch(this._fail.bind(this));
        },

        _warrantyText: function (expiry) {
            if (!expiry) { return ""; }
            return expiry < iso(new Date()) ? this._t("warrantyExpired", [this._date(expiry)]) : this._date(expiry);
        },

        _buildOptions: function () {
            var that = this, m = this.getView().getModel("my"), seenS = {}, seenC = {};
            var statuses = [], cats = [];
            this._assets.forEach(function (a) {
                if (!seenS[a.status]) { seenS[a.status] = true; statuses.push({ key: a.status, text: a._statusText }); }
                if (!seenC[a._category]) { seenC[a._category] = true; cats.push({ key: a._category, text: a._category }); }
            });
            statuses.unshift({ key: "", text: that._t("allStatuses") });
            cats.sort(function (x, y) { return x.text.localeCompare(y.text); });
            cats.unshift({ key: "", text: that._t("allCategories") });
            m.setProperty("/options/statuses", statuses);
            m.setProperty("/options/categories", cats);
        },

        _refresh: function () {
            var m = this.getView().getModel("my"), f = m.getProperty("/filters");
            var q = String(f.search || "").trim().toLowerCase();
            m.setProperty("/rows", this._assets.filter(function (a) {
                if (f.status && a.status !== f.status) { return false; }
                if (f.category && a._category !== f.category) { return false; }
                if (q && [a.assetTag, a.serialNumber, a.model, a._vendor].join(" ").toLowerCase().indexOf(q) < 0) { return false; }
                return true;
            }));
        },

        _buildNotifications: function (open, savedNotifications) {
            var that = this, today = iso(new Date()), soon = iso(new Date(Date.now() + 30 * DAY)), list = [];
            // Show saved workflow notifications first (request approved/rejected, asset assigned).
            (savedNotifications || []).forEach(function (n) {
                list.push({
                    title: n.title || that._t("notifications"),
                    desc: n.message || "",
                    icon: "sap-icon://bell",
                    state: n.isRead ? "None" : "Information",
                    time: n.createdAt ? that._dateFmt.format(new Date(n.createdAt)) : ""
                });
            });
            var byId = {};
            this._assets.forEach(function (a) { byId[a.asset_ID] = a; });

            open.forEach(function (r) {
                var a = byId[r.assetId];
                if (a) {
                    list.push({ title: that._t("notifService", [a.assetTag]), desc: that._tr("mstatus", r.status),
                        icon: "sap-icon://wrench", state: "Warning", time: "" });
                }
            });
            this._assets.forEach(function (a) {
                if (a.warrantyExpiry && a.warrantyExpiry >= today && a.warrantyExpiry <= soon) {
                    list.push({ title: that._t("notifWarranty", [a.assetTag]), desc: that._date(a.warrantyExpiry),
                        icon: "sap-icon://shield", state: "Warning", time: "" });
                }
            });

            var m = this.getView().getModel("my");
            m.setProperty("/notifications", list);
            m.setProperty("/notifCount", String(list.length));
        },

        _resetMine: function () {
            var m = this.getView().getModel("my");
            this._assets = [];
            m.setProperty("/me", { fullName: "", firstName: "", initials: "", subtitle: "" });
            m.setProperty("/kpi", { assigned: 0, openService: 0, lastAssignment: "-" });
            m.setProperty("/rows", []);
            m.setProperty("/notifications", []);
            m.setProperty("/notifCount", "0");
        },

        onFilterChange: function () { this._refresh(); },

        onClear: function () {
            this.getView().getModel("my").setProperty("/filters", { search: "", status: "", category: "" });
            this._refresh();
        },

        onKpiServicePress: function () {
            this.getView().getModel("my").setProperty("/filters", { search: "", status: "Maintenance", category: "" });
            this._refresh();
        },

        onRefresh: function () { this._loadProfile(); },

        onLanguageChange: function (oEvent) {
            var url = new URL(window.location.href);
            url.searchParams.set("sap-language", oEvent.getSource().getSelectedKey());
            window.location.href = url.toString();
        },

        _openFragment: function (prop, name) {
            var that = this;
            if (!this[prop]) {
                this[prop] = Fragment.load({ id: this.getView().getId(), name: name, controller: this })
                    .then(function (ctrl) { that.getView().addDependent(ctrl); return ctrl; });
            }
            return this[prop];
        },

        onOpenNotifications: function (oEvent) {
            var source = oEvent.getSource();
            this._openFragment("_notifPopover", "userdashboard.view.Notifications").then(function (pop) { pop.openBy(source); });
        },

        // Read-only lifecycle history (FR-015): ownership ledger and maintenance records of one asset.
        onAssetPress: function (oEvent) {
            var that = this, m = this.getView().getModel("my");
            var a = oEvent.getSource().getBindingContext("my").getObject();

            m.setProperty("/history", { busy: true, assetTag: a.assetTag, model: a.model, serialNumber: a.serialNumber,
                category: a._category, statusText: a._statusText, ledger: [], maintenance: [] });
            this._openFragment("_historyDialog", "userdashboard.view.History").then(function (dlg) { dlg.open(); });

            Promise.all([
                this._get("AssetHistorySrv?$select=transitionDate,action,fromName,toName,notes,createdAt" +
                    "&$filter=assetId eq '" + a.asset_ID + "'&$orderby=transitionDate desc,createdAt desc&$top=500"),
                this._get("MaintenanceOverviewSrv?$select=reportedDate,completedDate,type,status,outcome" +
                    "&$filter=assetId eq '" + a.asset_ID + "'&$orderby=reportedDate desc&$top=500")
            ]).then(function (res) {
                m.setProperty("/history/ledger", res[0].map(function (l) {
                    return { date: that._date(l.transitionDate), action: that._tr("action", l.action),
                        from: l.fromName || "-", to: l.toName || "-", notes: l.notes || "" };
                }));
                m.setProperty("/history/maintenance", res[1].map(function (r) {
                    return { reported: that._date(r.reportedDate), completed: that._date(r.completedDate),
                        type: that._tr("mtype", r.type), status: that._tr("mstatus", r.status), outcome: that._tr("moutcome", r.outcome) };
                }));
            }).catch(this._fail.bind(this)).finally(function () {
                m.setProperty("/history/busy", false);
            });
        },

        onCloseHistory: function () {
            this._historyDialog.then(function (dlg) { dlg.close(); });
        }
    });
});
